import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { JSDOM } from "jsdom";
const html = await readFile(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
const source = await readFile(
  new URL("../public/experience.js", import.meta.url),
  "utf8",
);
const cinemaSource = await readFile(
  new URL("../public/experience/hero-cinema.js", import.meta.url),
  "utf8",
);
const flush = async () => {
  for (let i = 0; i < 5; i++)
    await new Promise((resolve) => setImmediate(resolve));
};
async function setup({
  reduced = false,
  saveData = false,
  catalog = null,
  cinema = false,
} = {}) {
  const dom = new JSDOM(html, {
      url: "https://local.test",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    }),
    w = dom.window;
  const observers = [],
    requests = [];
  const motion = new w.EventTarget();
  motion.matches = reduced;
  w.matchMedia = () => motion;
  Object.defineProperty(w.navigator, "connection", {
    value: Object.assign(new w.EventTarget(), { saveData }),
  });
  w.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
    disconnect() {}
  };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = async function () {
    this._paused = false;
    this.dispatchEvent(new w.Event("play"));
  };
  w.HTMLMediaElement.prototype.pause = function () {
    this._paused = true;
    this.dispatchEvent(new w.Event("pause"));
  };
  Object.defineProperty(w.HTMLMediaElement.prototype, "paused", {
    get() {
      return this._paused !== false;
    },
  });
  w.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  w.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => ({ vehicles: [] }) };
  };
  if (catalog)
    w.addEventListener("vtts:catalog-request", () =>
      w.dispatchEvent(new w.CustomEvent("vtts:catalog", { detail: catalog })),
    );
  w.eval(source);
  if (cinema) w.eval(cinemaSource.replace("export function", "function"));
  await flush();
  return { dom, w, observers, requests, motion };
}
test("reduced motion and data saving do not autoplay or fetch films", async () => {
  for (const options of [{ reduced: true }, { saveData: true }]) {
    const h = await setup(options),
      v = h.w.document.querySelector(".ambient-video");
    h.observers[0].callback([{ target: v, isIntersecting: true }]);
    await flush();
    assert.equal(v.getAttribute("src"), null);
    assert.equal(v.paused, true);
    v.parentElement.querySelector("button").click();
    await flush();
    assert.equal(v.paused, false);
    assert.match(v.src, /exterior.mp4$/);
    h.dom.window.close();
  }
});
test("visible films play and pause offscreen; user pause is respected", async () => {
  const h = await setup(),
    v = h.w.document.querySelector(".ambient-video"),
    observe = h.observers[0].callback;
  observe([{ target: v, isIntersecting: true }]);
  await flush();
  assert.equal(v.paused, false);
  v.parentElement.querySelector("button").click();
  assert.equal(v.paused, true);
  observe([{ target: v, isIntersecting: false }]);
  observe([{ target: v, isIntersecting: true }]);
  await flush();
  assert.equal(v.paused, true);
  h.dom.window.close();
});
test("fleet controls update image, accessible label and selected state", async () => {
  const h = await setup();
  const b = h.w.document.querySelector('[data-fleet-view="2"]');
  b.click();
  assert.equal(b.getAttribute("aria-pressed"), "true");
  assert.match(h.w.document.getElementById("fleetImage").alt, /flags/);
  assert.equal(
    h.w.document
      .querySelector('[data-fleet-view="0"]')
      .getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(h.w.document.getElementById("modelControls").hidden, true);
  assert.equal(h.requests.length, 1);
  h.dom.window.close();
});
test("late experience module receives existing catalog and updates guide fares", async () => {
  const h = await setup({
    catalog: {
      trips: [
        {
          route: { origin: "Johannesburg", destination: "Bulawayo" },
          baseFareMinor: 95000,
          currency: "ZAR",
        },
      ],
    },
  });
  assert.match(
    h.w.document.querySelector('[data-live-fare="jhb-byo"]').textContent,
    /950/,
  );
  assert.equal(
    h.w.document.querySelector('[data-live-fare="byo-jhb"]').textContent,
    "See departures",
  );
  assert.match(
    h.w.document.getElementById("liveRouteSummary").textContent,
    /Johannesburg → Bulawayo/,
  );
  h.dom.window.close();
});
test("all local page assets exist and IDs are unique", async () => {
  const dom = new JSDOM(html),
    doc = dom.window.document;
  const ids = [...doc.querySelectorAll("[id]")].map((e) => e.id);
  assert.equal(ids.length, new Set(ids).size);
  for (const el of doc.querySelectorAll("[src],[href],[poster],[data-src]")) {
    for (const attr of ["src", "href", "poster", "data-src"]) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      if (value.startsWith("#")) {
        if (value.length > 1)
          assert.ok(doc.getElementById(value.slice(1)), value);
        continue;
      }
      if (/^(https?:|tel:)/.test(value)) continue;
      await access(new URL("../public/" + value, import.meta.url));
    }
  }
  dom.window.close();
});

test("hero timeline reveals cabin before logo and replay restarts exterior", async () => {
  const h = await setup({ cinema: true });
  const video = h.w.document.getElementById("heroJourney");
  const hero = h.w.document.getElementById("cinemaHero");
  h.observers[1].callback([{ isIntersecting: true }]);
  await flush();
  assert.match(video.src, /hero-journey.mp4$/);
  video.currentTime = 10;
  video.dispatchEvent(new h.w.Event("timeupdate"));
  assert.equal(hero.dataset.scene, "entrance");
  video.currentTime = 14;
  video.dispatchEvent(new h.w.Event("timeupdate"));
  assert.equal(hero.dataset.scene, "cabin");
  video.dispatchEvent(new h.w.Event("ended"));
  assert.equal(hero.dataset.scene, "brand");
  assert.equal(h.w.document.getElementById("heroReplay").hidden, false);
  h.w.document.getElementById("heroReplay").click();
  await flush();
  assert.equal(hero.dataset.scene, "exterior");
  assert.equal(video.currentTime, 0);
  h.dom.window.close();
});
test("hero respects reduced motion and does not restart after manual pause", async () => {
  const h = await setup({ cinema: true, reduced: true }),
    video = h.w.document.getElementById("heroJourney");
  const observe = h.observers[1].callback;
  observe([{ isIntersecting: true }]);
  await flush();
  assert.equal(video.getAttribute("src"), null);
  h.w.document.getElementById("heroPlay").click();
  await flush();
  assert.equal(video.paused, false);
  h.w.document.getElementById("heroPlay").click();
  assert.equal(video.paused, true);
  observe([{ isIntersecting: false }]);
  observe([{ isIntersecting: true }]);
  await flush();
  assert.equal(video.paused, true);
  h.dom.window.close();
});

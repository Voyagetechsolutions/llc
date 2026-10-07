import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const html = await readFile(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
const script = await readFile(
  new URL("../public/script.js", import.meta.url),
  "utf8",
);
const trip = {
  id: "trip1",
  route: { origin: "Johannesburg", destination: "Bulawayo" },
  departureAt: "2026-10-20T15:00:00Z",
  branch: { timezone: "Africa/Johannesburg", name: "Power House" },
  serviceNumber: "LLC1",
  baseFareMinor: 80000,
  currency: "ZAR",
};
const seat = {
  id: "seat1",
  code: "1A",
  rowNumber: 1,
  columnNumber: 1,
  availability: "AVAILABLE",
};
const catalog = {
  trips: [trip],
  bookingPolicy: { seatHoldMinutes: 5, requirePassengerId: true },
  paymentProviders: [{ id: "provider1", displayName: "Test checkout" }],
};
const flush = async () => {
  for (let i = 0; i < 8; i++)
    await new Promise((resolve) => setImmediate(resolve));
};
async function harness(options = {}) {
  const dom = new JSDOM(html, {
    url: "https://local.test",
    runScripts: "outside-only",
  });
  const w = dom.window;
  const calls = [];
  const intervals = [];
  w.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  w.matchMedia = () => ({ matches: false });
  w.console.warn = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.setInterval = (callback) => {
    intervals.push(callback);
    return intervals.length;
  };
  w.clearInterval = () => {};
  const form = w.document.getElementById("bookingForm");
  // JSDOM lacks browser form named properties.
  for (const field of form.elements)
    if (field.name)
      Object.defineProperty(form, field.name, {
        value: field,
        configurable: true,
      });
  w.fetch = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    let body;
    if (url === "/api/config")
      body = options.offline
        ? { vttsApiUrl: null, channelKey: null }
        : {
            vttsApiUrl: "https://vtts.test/api/v1",
            channelKey: "test-publishable",
          };
    else if (url.endsWith("/catalog"))
      body = options.empty ? { ...catalog, trips: [] } : catalog;
    else if (url.endsWith("/availability"))
      body = {
        seats: [
          seat,
          {
            ...seat,
            id: "seat2",
            code: "1B",
            columnNumber: 2,
            availability: "SOLD",
          },
        ],
      };
    else if (url.endsWith("/seat-holds")) {
      if (options.conflict)
        return {
          ok: false,
          status: 409,
          json: async () => ({ message: "Seat sold" }),
        };
      body = {
        seat,
        holdToken: "test-hold",
        expiresAt: options.expired
          ? "2000-01-01T00:00:00Z"
          : new Date(Date.now() + 300000).toISOString(),
      };
    } else if (url.endsWith("/bookings")) {
      if (
        options.retry &&
        calls.filter((c) => c.url.endsWith("/bookings")).length === 1
      )
        throw new Error("Simulated network loss");
      body = {
        booking: { reference: "TEST-001", totalMinor: 80000, currency: "ZAR" },
        checkoutUrl: options.unsafeCheckout
          ? "javascript:alert(1)"
          : "https://checkout.test/pay",
      };
    } else throw new Error(`Unexpected URL ${url}`);
    return { ok: true, status: 200, json: async () => body };
  };
  w.eval(script);
  await flush();
  const click = async (selector) => {
    w.document.querySelector(selector).click();
    await flush();
  };
  return { dom, w, calls, intervals, click, form };
}
async function passenger(h) {
  await h.click(".trip-option");
  await h.click(".seat.available");
  Object.assign(h.form.firstName, { value: "Test" });
  Object.assign(h.form.lastName, { value: "Passenger" });
  h.form.phone.value = "+27000000000";
  h.form.idNumber.value = "TEST-ID";
}
test("missing configuration keeps phone and WhatsApp fallback usable", async () => {
  const h = await harness({ offline: true });
  assert.equal(h.w.document.getElementById("bookingUnavailable").hidden, false);
  assert.equal(h.calls.length, 1);
  assert.match(
    h.w.document.querySelector("#bookingUnavailable a").href,
    /wa.me/,
  );
  h.dom.window.close();
});
test("catalog to seat hold to payment retains booking contract", async () => {
  const h = await harness();
  await h.click(".trip-option");
  assert.equal(h.w.document.querySelector(".seat.sold").disabled, true);
  await h.click(".seat.available");
  assert.equal(h.form.hidden, false);
  assert.equal(h.form.idNumber.required, true);
  h.form.firstName.value = "Test";
  h.form.lastName.value = "Passenger";
  h.form.phone.value = "+27000000000";
  h.form.idNumber.value = "TEST-ID";
  h.form.dispatchEvent(
    new h.w.Event("submit", { bubbles: true, cancelable: true }),
  );
  await flush();
  const call = h.calls.find((c) => c.url.endsWith("/bookings"));
  assert.equal(call.body.holdToken, "test-hold");
  assert.equal(call.body.paymentProviderId, "provider1");
  assert.ok(call.body.idempotencyKey);
  assert.equal(
    h.w.document.getElementById("successRef").textContent,
    "TEST-001",
  );
  assert.equal(
    h.w.document.getElementById("payNow").href,
    "https://checkout.test/pay",
  );
  h.dom.window.close();
});
test("network retry reuses idempotency key", async () => {
  const h = await harness({ retry: true });
  await passenger(h);
  const submit = async () => {
    h.form.dispatchEvent(new h.w.Event("submit", { cancelable: true }));
    await flush();
  };
  await submit();
  await submit();
  const calls = h.calls.filter((c) => c.url.endsWith("/bookings"));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.idempotencyKey, calls[1].body.idempotencyKey);
  h.dom.window.close();
});
test("seat conflict returns to usable seat selection", async () => {
  const h = await harness({ conflict: true });
  await h.click(".trip-option");
  await h.click(".seat.available");
  assert.equal(h.form.hidden, true);
  assert.match(
    h.w.document.getElementById("formError").textContent,
    /pick another seat/,
  );
  assert.ok(h.w.document.querySelector(".seat.available"));
  h.dom.window.close();
});
test("expired hold blocks passenger checkout", async () => {
  const h = await harness({ expired: true });
  await h.click(".trip-option");
  await h.click(".seat.available");
  assert.equal(h.form.hidden, true);
  assert.equal(h.intervals.length, 0);
  assert.match(h.w.document.getElementById("formError").textContent, /expired/);
  h.dom.window.close();
});
test("unsafe checkout URL is never offered", async () => {
  const h = await harness({ unsafeCheckout: true });
  await passenger(h);
  h.form.dispatchEvent(new h.w.Event("submit", { cancelable: true }));
  await flush();
  assert.equal(h.w.document.getElementById("payNow").hidden, true);
  h.dom.window.close();
});
test("empty catalog offers supported fallback", async () => {
  const h = await harness({ empty: true });
  assert.equal(h.w.document.getElementById("bookingUnavailable").hidden, false);
  assert.match(
    h.w.document.getElementById("unavailableMessage").textContent,
    /no departures/,
  );
  h.dom.window.close();
});

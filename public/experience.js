// Presentation only: no booking state or VTTS writes belong in this module.
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const constrained = () => reduced.matches || navigator.connection?.saveData;
document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: "instant" });
});
const videos = [...document.querySelectorAll(".ambient-video")];
const manual = new WeakSet();
function syncButton(video) {
  const button = video.parentElement.querySelector(".media-toggle");
  button.textContent = video.paused ? "Play film" : "Pause film";
  button.setAttribute(
    "aria-label",
    `${video.paused ? "Play" : "Pause"} ${video.getAttribute("aria-label")}`,
  );
}
function load(video) {
  if (!video.getAttribute("src")) {
    video.src = video.dataset.src;
    video.load();
  }
}
async function play(video) {
  load(video);
  try {
    await video.play();
  } catch {
    syncButton(video);
  }
}
const mediaObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const video = entry.target;
      video.dataset.visible = String(entry.isIntersecting);
      if (!entry.isIntersecting) video.pause();
      else if (!constrained() && !manual.has(video) && !document.hidden)
        play(video);
    }
  },
  { threshold: 0.25 },
);
for (const video of videos) {
  mediaObserver.observe(video);
  video.addEventListener("play", () => syncButton(video));
  video.addEventListener("pause", () => syncButton(video));
  video.addEventListener("error", () => {
    const button = video.parentElement.querySelector(".media-toggle");
    button.textContent = "Film unavailable";
    button.disabled = true;
  });
  video.parentElement
    .querySelector(".media-toggle")
    .addEventListener("click", () => {
      manual.add(video);
      if (video.paused) play(video);
      else video.pause();
    });
}
function stopAutomatic() {
  if (constrained()) videos.forEach((video) => video.pause());
}
reduced.addEventListener("change", stopAutomatic);
navigator.connection?.addEventListener("change", stopAutomatic);
document.addEventListener("visibilitychange", () => {
  videos.forEach((video) => {
    if (document.hidden) video.pause();
    else if (
      video.dataset.visible === "true" &&
      !constrained() &&
      !manual.has(video)
    )
      play(video);
  });
});
const views = [
  {
    src: "assets/experience/fleet-depot.webp",
    label: "01 / Depot portrait",
    alt: "Lazarus coach at the depot, viewed from the front three-quarter angle",
  },
  {
    src: "assets/experience/fleet-pair.webp",
    label: "02 / Together on the road",
    alt: "Two real Lazarus coaches parked together",
  },
  {
    src: "assets/experience/fleet-flags.webp",
    label: "03 / Two countries",
    alt: "Lazarus coaches shown with South African and Zimbabwean flags",
  },
];
const fleetImage = document.getElementById("fleetImage");
document.querySelectorAll("[data-fleet-view]").forEach((button) =>
  button.addEventListener("click", () => {
    const view = views[Number(button.dataset.fleetView)];
    fleetImage.src = view.src;
    fleetImage.alt = view.alt;
    document.getElementById("fleetViewLabel").textContent = view.label;
    document
      .querySelectorAll("[data-fleet-view]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
  }),
);
const fullscreen = document.getElementById("fleetFullscreen");
if (!document.fullscreenEnabled) fullscreen.hidden = true;
fullscreen.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.getElementById("fleetViewer").requestFullscreen();
  } catch {
    fullscreen.textContent = "Fullscreen unavailable";
  }
});
document.addEventListener(
  "fullscreenchange",
  () =>
    (fullscreen.textContent = document.fullscreenElement
      ? "Close view ↙"
      : "Expand view ↗"),
);
const journey = document.getElementById("journey");
let queued = false;
function updateJourney() {
  queued = false;
  if (constrained() || innerWidth <= 860) {
    journey.style.removeProperty("--film-shift");
    return;
  }
  const rect = journey.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > innerHeight) return;
  const progress = Math.max(
    0,
    Math.min(1, -rect.top / Math.max(1, rect.height - innerHeight)),
  );
  journey.style.setProperty("--journey-progress", progress);
  journey.style.setProperty("--film-shift", `${(progress - 0.5) * -45}px`);
}
addEventListener(
  "scroll",
  () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(updateJourney);
    }
  },
  { passive: true },
);
addEventListener("resize", updateJourney);
updateJourney();

// Marketing prices follow published trips when the catalog is available.
window.addEventListener("vtts:catalog", ({ detail: catalog }) => {
  const trips = catalog.trips || [];
  const prices = trips.filter((trip) => Number.isFinite(trip.baseFareMinor));
  const format = (trip) =>
    new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: trip.currency || "ZAR",
      maximumFractionDigits: 2,
    }).format(trip.baseFareMinor / 100);
  const hints = {
    "jhb-byo": /^(johannesburg|jhb)/i,
    "byo-jhb": /^(bulawayo|byo)/i,
  };
  document.querySelectorAll("[data-live-fare]").forEach((node) => {
    const matching = prices.filter((trip) =>
      hints[node.dataset.liveFare].test(trip.route.origin),
    );
    const currencies = new Set(matching.map((trip) => trip.currency || "ZAR"));
    node.textContent =
      matching.length && currencies.size === 1
        ? format(
            matching.reduce((a, b) =>
              a.baseFareMinor < b.baseFareMinor ? a : b,
            ),
          )
        : "See departures";
  });
  document.getElementById("fareSource").textContent =
    "From published departures. Select your trip for its final fare.";
  const from = document.getElementById("fromFare");
  if (
    prices.length &&
    new Set(prices.map((trip) => trip.currency || "ZAR")).size === 1
  ) {
    from.textContent = format(
      prices.reduce((a, b) => (a.baseFareMinor < b.baseFareMinor ? a : b)),
    );
    document.getElementById("fromFareLabel").textContent =
      "Published fares from";
  } else {
    from.textContent = "Live fares";
    document.getElementById("fromFareLabel").textContent = "Choose a departure";
  }
  const routes = [
    ...new Set(
      trips.map((trip) => `${trip.route.origin} → ${trip.route.destination}`),
    ),
  ];
  const summary = document.getElementById("liveRouteSummary");
  summary.textContent = `Currently on sale: ${routes.join(" · ")}. See booking for departure times.`;
  summary.hidden = !routes.length;
});

window.dispatchEvent(new Event("vtts:catalog-request"));

// True 3D is optional and only advertised when a verified asset is configured.
let modelViewer;
async function prepareModel() {
  try {
    const response = await fetch("/assets/experience/fleet.json");
    if (!response.ok) return;
    const manifest = await response.json();
    const asset = manifest.vehicles.find(
      (vehicle) => vehicle.model?.url && vehicle.model.status === "verified",
    );
    if (!asset) return;
    document.getElementById("modelControls").hidden = false;
    const open = document.getElementById("openModel");
    const close = document.getElementById("closeModel");
    const status = document.getElementById("modelStatus");
    open.addEventListener("click", async () => {
      open.disabled = true;
      status.textContent = "Loading the fleet model…";
      try {
        const { mountBusModel } = await import("./experience/model-viewer.js");
        modelViewer = await mountBusModel(
          document.getElementById("fleetViewer"),
          asset.model,
        );
        fleetImage.hidden = true;
        document.querySelector(".fleet-image-meta").hidden = true;
        document.querySelector(".fleet-controls").hidden = true;
        close.hidden = false;
        open.hidden = true;
        status.textContent =
          "Drag to orbit. Use arrow keys to rotate, + or − to zoom. Scroll the page normally.";
      } catch {
        status.textContent =
          "3D is unavailable on this device. Fleet photographs are still available.";
      } finally {
        open.disabled = false;
      }
    });
    close.addEventListener("click", () => {
      modelViewer?.dispose();
      modelViewer = null;
      fleetImage.hidden = false;
      document.querySelector(".fleet-image-meta").hidden = false;
      document.querySelector(".fleet-controls").hidden = false;
      close.hidden = true;
      open.hidden = false;
      status.textContent = "";
      open.focus();
    });
  } catch {
    /* The photography experience remains complete without a model. */
  }
}
prepareModel();
addEventListener("pagehide", () => modelViewer?.dispose());



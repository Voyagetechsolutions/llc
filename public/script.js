// ===== Mobile nav =====
const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("mainNav");

navToggle.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  navToggle.classList.toggle("open", open);
  navToggle.setAttribute("aria-expanded", String(open));
});

mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    navToggle.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

// ===== Reveal on scroll =====
const revealTargets = document.querySelectorAll(
  ".section .container > *, .band-inner, .route-card, .fare-card, .feature, .contact-card, .gallery-item"
);
revealTargets.forEach((el) => el.classList.add("reveal"));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
revealTargets.forEach((el) => observer.observe(el));

// ===== Footer year =====
document.getElementById("year").textContent = new Date().getFullYear();

// ===== Booking (live trips, seats and bookings from VTTS) =====
const bookingCard = document.getElementById("book");
const bookingTitle = bookingCard.querySelector("h2");
const bookingSub = document.getElementById("bookingSub");
const formError = document.getElementById("formError");
const stepTrip = document.getElementById("stepTrip");
const directionSelect = document.getElementById("direction");
const tripList = document.getElementById("tripList");
const stepSeat = document.getElementById("stepSeat");
const seatTripLabel = document.getElementById("seatTripLabel");
const seatMap = document.getElementById("seatMap");
const form = document.getElementById("bookingForm");
const holdBanner = document.getElementById("holdBanner");
const submitBtn = document.getElementById("submitBtn");
const paymentNote = document.getElementById("paymentNote");
const successPanel = document.getElementById("bookingSuccess");
const unavailablePanel = document.getElementById("bookingUnavailable");

const WHATSAPP_NUMBER = "263777955373";
const booking = { config: null, catalog: null, trip: null, hold: null, holdTimer: null, idempotencyKey: null };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showError(message) {
  formError.textContent = message || "";
  formError.hidden = !message;
}

const money = (minor, currency) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: currency || "ZAR" }).format(minor / 100);

function when(iso, timeZone) {
  const options = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat("en-ZA", { ...options, timeZone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-ZA", options).format(new Date(iso));
  }
}

const directionOf = (trip) => `${trip.route.origin} → ${trip.route.destination}`;
const departureOf = (trip) => when(trip.departureAt, trip.branch?.timezone);

async function vtts(path, init = {}) {
  const headers = { "x-vtts-channel-key": booking.config.channelKey };
  if (init.body) headers["content-type"] = "application/json";
  const res = await fetch(`${booking.config.vttsApiUrl}/channel-api/v1${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const issues = Array.isArray(body?.issues) ? body.issues.map((issue) => issue.message).filter(Boolean) : [];
    const detail = issues.length ? issues.join("\n") : Array.isArray(body?.message) ? body.message.join("\n") : body?.message;
    const error = new Error(detail || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return body;
}

// Customers see a WhatsApp/phone fallback; the technical reason goes to the
// console so the owner can diagnose a misconfigured key or origin.
function showUnavailable(ownerDetail, customerMessage) {
  if (ownerDetail) console.warn(`Online booking unavailable: ${ownerDetail}`);
  abandonHold();
  stepTrip.hidden = true;
  stepSeat.hidden = true;
  form.hidden = true;
  successPanel.hidden = true;
  showError("");
  bookingSub.textContent = "Book instantly with our team on WhatsApp or by phone.";
  document.getElementById("unavailableMessage").textContent =
    customerMessage || "Online booking is temporarily unavailable.";
  unavailablePanel.hidden = false;
}

async function initBooking() {
  try {
    const res = await fetch("/api/config", { cache: "no-store" });
    booking.config = await res.json();
  } catch {
    return showUnavailable("could not load /api/config from the website server");
  }
  if (!booking.config.vttsApiUrl || !booking.config.channelKey) {
    return showUnavailable("VTTS_API_URL and VTTS_CHANNEL_KEY are not both set on the website host");
  }
  await loadCatalog();
}

async function loadCatalog() {
  tripList.replaceChildren(el("p", "booking-status", "Loading departures…"));
  try {
    booking.catalog = await vtts("/catalog");
  } catch (error) {
    return showUnavailable(`VTTS catalog request failed (${error.status ?? "network error"}): ${error.message}`);
  }
  if (!booking.catalog.trips.length) {
    return showUnavailable(
      "VTTS has no published trips inside the sales window",
      "There are no departures on sale online right now."
    );
  }
  buildDirections();
}

function buildDirections() {
  const previous = directionSelect.value;
  const cheapest = new Map();
  for (const trip of booking.catalog.trips) {
    const key = directionOf(trip);
    const current = cheapest.get(key);
    if (!current || trip.baseFareMinor < current.baseFareMinor) cheapest.set(key, trip);
  }
  directionSelect.replaceChildren(
    ...[...cheapest].map(([key, trip]) => {
      const option = el("option", "", `${key} · from ${money(trip.baseFareMinor, trip.currency)}`);
      option.value = key;
      return option;
    })
  );
  if (cheapest.has(previous)) directionSelect.value = previous;
  renderTrips();
}

function renderTrips() {
  const trips = booking.catalog.trips.filter((trip) => directionOf(trip) === directionSelect.value);
  tripList.replaceChildren(
    ...trips.map((trip) => {
      const button = el("button", "trip-option");
      button.type = "button";
      const info = el("span");
      info.append(
        el("span", "trip-when", departureOf(trip)),
        el("span", "trip-meta", `Service ${trip.serviceNumber} · from ${trip.branch?.name ?? trip.route.origin}`)
      );
      button.append(info, el("span", "trip-fare", money(trip.baseFareMinor, trip.currency)));
      button.addEventListener("click", () => chooseTrip(trip));
      return button;
    })
  );
}
directionSelect.addEventListener("change", renderTrips);

async function chooseTrip(trip) {
  showError("");
  abandonHold();
  booking.trip = trip;
  seatTripLabel.textContent = `${directionOf(trip)} · ${departureOf(trip)}`;
  stepTrip.hidden = true;
  form.hidden = true;
  stepSeat.hidden = false;
  await loadSeats();
}

async function loadSeats() {
  seatMap.setAttribute("aria-busy", "true");
  try {
    const { seats } = await vtts(`/trips/${booking.trip.id}/availability`);
    renderSeats(seats);
  } catch (error) {
    seatMap.replaceChildren();
    showError(error.status === 404 ? "This departure is no longer on sale. Please choose another." : error.message);
  } finally {
    seatMap.removeAttribute("aria-busy");
  }
}

function renderSeats(seats) {
  if (!seats.length) {
    seatMap.style.gridTemplateColumns = "";
    seatMap.replaceChildren(el("p", "booking-status", "Seat selection isn't available for this departure."));
    return;
  }
  const minRow = Math.min(...seats.map((seat) => seat.rowNumber));
  const minCol = Math.min(...seats.map((seat) => seat.columnNumber));
  const columns = Math.max(...seats.map((seat) => seat.columnNumber)) - minCol + 1;
  seatMap.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 2.6rem))`;
  const labels = { available: "available", held: "being booked", sold: "taken" };
  seatMap.replaceChildren(
    ...seats.map((seat) => {
      const state = seat.availability.toLowerCase();
      const button = el("button", `seat ${state}`, seat.code);
      button.type = "button";
      button.style.gridRow = String(seat.rowNumber - minRow + 1);
      button.style.gridColumn = String(seat.columnNumber - minCol + 1);
      button.disabled = seat.availability !== "AVAILABLE";
      button.setAttribute("aria-label", `Seat ${seat.code}, ${labels[state] ?? state}`);
      button.addEventListener("click", () => chooseSeat(seat));
      return button;
    })
  );
}

async function chooseSeat(seat) {
  showError("");
  seatMap.setAttribute("aria-busy", "true");
  try {
    const minutes = booking.catalog.bookingPolicy?.seatHoldMinutes ?? 5;
    const ttlSeconds = Math.min(900, Math.max(60, Math.round(minutes * 60)));
    booking.hold = await vtts("/seat-holds", {
      method: "POST",
      body: JSON.stringify({ tripId: booking.trip.id, seatId: seat.id, ttlSeconds }),
    });
    // One key per hold, so a retried submit replays the same booking instead of creating a second one.
    booking.idempotencyKey = crypto.randomUUID();
    openPassengerForm();
  } catch (error) {
    showError(error.status === 409 ? `${error.message}. Please pick another seat.` : error.message);
    await loadSeats();
  } finally {
    seatMap.removeAttribute("aria-busy");
  }
}

function setFieldVisible(name, visible) {
  form.querySelector(`[data-field="${name}"]`).hidden = !visible;
}

function openPassengerForm() {
  const policy = booking.catalog.bookingPolicy || {};
  const providers = booking.catalog.paymentProviders || [];
  stepSeat.hidden = true;
  form.hidden = false;

  setFieldVisible("idNumber", Boolean(policy.requirePassengerId));
  form.idNumber.required = Boolean(policy.requirePassengerId);
  setFieldVisible("promoCode", Boolean(policy.allowPromoCodes));

  form.provider.replaceChildren(
    ...providers.map((provider) => {
      const option = el("option", "", provider.displayName);
      option.value = provider.id;
      return option;
    })
  );
  setFieldVisible("provider", providers.length > 1);
  submitBtn.disabled = providers.length === 0;
  paymentNote.textContent = providers.length
    ? "You'll pay securely on the next step. Your ticket is issued once payment is confirmed."
    : "Online payment isn't available yet — please book this seat with us on WhatsApp.";

  startHoldTimer();
  form.firstName.focus();
}

function startHoldTimer() {
  stopHoldTimer();
  const tick = () => {
    const remaining = new Date(booking.hold.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      abandonHold();
      form.hidden = true;
      stepSeat.hidden = false;
      showError("Your seat hold expired before checkout finished. Please choose a seat again.");
      loadSeats();
      return;
    }
    const minutes = Math.floor(remaining / 60000);
    const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
    holdBanner.textContent = `Seat ${booking.hold.seat.code} is held for you — ${minutes}:${seconds} left to finish booking.`;
  };
  tick();
  booking.holdTimer = setInterval(tick, 1000);
}

function stopHoldTimer() {
  clearInterval(booking.holdTimer);
  booking.holdTimer = null;
}

// VTTS has no release call for channel holds; an abandoned hold simply expires
// at the end of the operator's hold window.
function abandonHold() {
  stopHoldTimer();
  booking.hold = null;
  booking.idempotencyKey = null;
}

document.getElementById("backToTrips").addEventListener("click", () => {
  showError("");
  abandonHold();
  stepSeat.hidden = true;
  stepTrip.hidden = false;
});

document.getElementById("backToSeats").addEventListener("click", () => {
  showError("");
  abandonHold();
  form.hidden = true;
  stepSeat.hidden = false;
  loadSeats();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  if (!booking.hold) return;

  const value = (name) => form[name].value.trim();
  const problems = [];
  if (!value("firstName")) problems.push("First name is required.");
  if (!value("lastName")) problems.push("Last name is required.");
  if (value("phone").replace(/\D/g, "").length < 7) problems.push("A valid phone number is required.");
  if (value("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email"))) {
    problems.push("That email address doesn't look right.");
  }
  if (form.idNumber.required && value("idNumber").length < 3) problems.push("Passport or ID number is required.");
  if (problems.length) return showError(problems.join("\n"));

  const { hold, trip } = booking;
  submitBtn.disabled = true;
  submitBtn.textContent = "Securing your booking…";
  try {
    const result = await vtts("/bookings", {
      method: "POST",
      body: JSON.stringify({
        tripId: trip.id,
        seatId: hold.seat.id,
        holdToken: hold.holdToken,
        paymentProviderId: form.provider.value,
        promoCode: value("promoCode") || undefined,
        idempotencyKey: booking.idempotencyKey,
        customer: {
          firstName: value("firstName"),
          lastName: value("lastName"),
          phone: value("phone"),
          email: value("email") || undefined,
        },
        passenger: { firstName: value("firstName"), lastName: value("lastName"), idNumber: value("idNumber") || undefined },
      }),
    });
    showSuccess(result, trip, hold);
  } catch (error) {
    if (error.status === 409 && /hold|sold|not available/i.test(error.message)) {
      abandonHold();
      form.hidden = true;
      stepSeat.hidden = false;
      showError(`${error.message}. Please choose a seat again.`);
      loadSeats();
    } else {
      showError(
        error.status ? error.message : "We couldn't reach the booking system. Please try again — you won't be booked twice."
      );
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Continue to payment";
  }
});

function safeCheckoutUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function showSuccess(result, trip, hold) {
  const created = result.booking;
  const passengerName = `${form.firstName.value.trim()} ${form.lastName.value.trim()}`;
  abandonHold();
  form.hidden = true;
  bookingTitle.textContent = "Thank you!";
  bookingSub.hidden = true;

  document.getElementById("successRef").textContent = created.reference;
  document.getElementById("successDetail").textContent =
    `${directionOf(trip)} · ${departureOf(trip)} · Seat ${hold.seat.code} · ${money(created.totalMinor, created.currency)}`;

  const checkout = safeCheckoutUrl(result.checkoutUrl);
  const payNow = document.getElementById("payNow");
  payNow.hidden = !checkout;
  if (checkout) payNow.href = checkout;
  document.getElementById("successNext").textContent = checkout
    ? "Complete payment to confirm your booking and receive your ticket."
    : "Our team will contact you to complete payment and issue your ticket.";

  const text = encodeURIComponent(
    `Hello Lazarus Luxury Coaches! I just booked online.\n` +
      `Reference: ${created.reference}\n` +
      `Route: ${directionOf(trip)}\n` +
      `Departure: ${departureOf(trip)}\n` +
      `Seat: ${hold.seat.code}\n` +
      `Name: ${passengerName}`
  );
  document.getElementById("whatsappConfirm").href = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  successPanel.hidden = false;
}

document.getElementById("bookAnother").addEventListener("click", async () => {
  successPanel.hidden = true;
  form.reset();
  bookingTitle.textContent = "Book your seat";
  bookingSub.hidden = false;
  booking.trip = null;
  stepTrip.hidden = false;
  await loadCatalog();
});

// "Book this route" buttons preselect the matching direction and scroll up to the card
const ROUTE_HINTS = { "jhb-byo": /^(johannesburg|jhb)/i, "byo-jhb": /^(bulawayo|byo)/i };
document.querySelectorAll(".book-route").forEach((btn) => {
  btn.addEventListener("click", () => {
    const hint = ROUTE_HINTS[btn.dataset.route];
    const match = hint && [...directionSelect.options].find((option) => hint.test(option.value));
    if (match && !stepTrip.hidden) {
      directionSelect.value = match.value;
      renderTrips();
    }
    bookingCard.scrollIntoView({ behavior: "smooth" });
  });
});

initBooking();

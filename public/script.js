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

// ===== Booking form =====
const form = document.getElementById("bookingForm");
const formError = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");
const successPanel = document.getElementById("bookingSuccess");
const dateInput = document.getElementById("travelDate");

// earliest selectable date = today
dateInput.min = new Date().toISOString().split("T")[0];

const ROUTE_LABELS = {
  "jhb-byo": "Johannesburg → Bulawayo",
  "byo-jhb": "Bulawayo → Johannesburg",
};

// "Book this route" buttons prefill the form and scroll up to it
document.querySelectorAll(".book-route").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("route").value = btn.dataset.route;
    document.getElementById("book").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => document.getElementById("travelDate").focus(), 600);
  });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;

  const payload = {
    route: form.route.value,
    travelDate: form.travelDate.value,
    seats: form.seats.value,
    fullName: form.fullName.value,
    phone: form.phone.value,
    notes: form.notes.value,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Reserving...";

  try {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      formError.textContent = (data.errors || ["Something went wrong. Please try again."]).join("\n");
      formError.hidden = false;
      return;
    }

    // Success
    document.getElementById("successRef").textContent = data.reference;
    document.getElementById("successDetail").textContent =
      `${data.route} · ${data.travelDate} · ${data.seats} seat(s) · R${data.fare * data.seats}`;

    const waText = encodeURIComponent(
      `Hello Lazarus Luxury Coaches! I just made a booking request.\n` +
      `Reference: ${data.reference}\n` +
      `Route: ${data.route}\n` +
      `Date: ${data.travelDate}\n` +
      `Seats: ${data.seats}\n` +
      `Name: ${payload.fullName}`
    );
    document.getElementById("whatsappConfirm").href = `https://wa.me/263777955373?text=${waText}`;

    form.hidden = true;
    document.querySelector(".booking-card h2").textContent = "Thank you!";
    document.querySelector(".booking-card-sub").hidden = true;
    successPanel.hidden = false;
  } catch {
    formError.textContent =
      "We couldn't reach the booking server. Please try again, or book directly on WhatsApp: +263 777 955 373.";
    formError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Reserve My Seat";
  }
});

document.getElementById("bookAnother").addEventListener("click", () => {
  successPanel.hidden = true;
  form.reset();
  form.hidden = false;
  document.querySelector(".booking-card h2").textContent = "Book your seat";
  document.querySelector(".booking-card-sub").hidden = false;
});

# Passenger and seat booking

Start the existing application with `npm install` then `npm start`. Open
`http://localhost:8765/booking.html`. The home hero, header, footer and mobile
booking links open this page. The existing inline single-seat booking remains
available for compatibility.

## Journey

1. Choose a published departure and 1–60 passengers. Enter each traveller's
   first/last name, passport/ID when required by provider policy, and a primary
   contact phone/email.
2. Select one distinct seat per passenger. The layout is 15 rows, numbered
   left-to-right 1–60: two seats, centre aisle, two seats. Seats are assigned in
   selection order. This geometry is the layout requested by the owner; it does
   not infer provider seat identifiers. Live availability maps only exact numeric
   provider seat labels 1–60; missing/held/sold seats are disabled. Non-matching
   provider layouts are blocked rather than silently remapped.
3. Review one separate QR-coded record per passenger, then create bookings or
   contact the team if online service is unavailable. Print / save PDF uses the
   browser print dialog and keeps each passenger card together. **Download ticket
   PDF** saves one passenger directly, while **Download all tickets (PDF)** saves
   one PDF with a separate page for every passenger, without a print dialog.

## Departure and check-in times

The selected published trip's `departureAt` is authoritative for online bookings.
The operator confirmed these check-in offsets on 2026-10-29:

- Johannesburg origin: 60 minutes before departure.
- Bulawayo origin: 30 minutes before departure.

`public/booking-schedule.js` calculates check-in from that timestamp and displays
both dates if check-in falls on the previous day. Times use the trip branch's
time zone, falling back to Africa/Johannesburg or Africa/Harare for the known
origins. An unknown origin does not inherit a guessed check-in policy.

Offline previews use the existing advertised 17:00 daily departure (16:00
Johannesburg check-in or 16:30 Bulawayo check-in), labelled as planning information.
They do not override live departures or confirm service availability.

PDF generation is lazy-loaded from the locally vendored jsPDF 4.2.1 build (MIT);
passenger data stays in the browser. Names outside PDF core font coverage use
browser-font rasterization so Unicode names are preserved. The QR is embedded
as a lossless image with a four-module quiet zone. Preview/payment-pending status
is retained on every downloaded page. Downloads do not turn a pending record into
a valid boarding ticket. Refresh vendors after a dependency update using
`npm run assets:booking`.

The missing-config/offline path collects a requested route/date and preferred
seats for a **preview**, not live inventory. It never creates reservations.

## Booking contract and tickets

This uses the existing `/api/config` and VTTS channel API contract: `/catalog`,
`/trips/:id/availability`, `/seat-holds` and `/bookings`. The verified integration
creates **one passenger booking and payment checkout per API call**; it has no
known atomic group endpoint. The primary customer contact is included on each
booking, with that traveller's own passenger details and selected seat ID.

Submission is sequential; partial success is possible. Successful responses stay
visible. Each attempted passenger has a stable idempotency key and frozen request
payload, so retrying after an uncertain network response replays exactly the same
request. Editing is disabled after submission begins. An expired or sold seat
requires operator assistance; existing references remain visible. Channel holds
have no documented release endpoint and expire according to provider policy.

**Final boarding-ticket issuance remains a provider dependency.** This site has
no verified payment-status lookup, webhook, signed ticket payload, or boarding
validation endpoint. It therefore labels cards as previews or booking records,
never confirmed boarding passes. Each QR encodes a version, issuer marker,
unique record ID and, after booking creation, the actual provider booking reference.
This is a working QR for identifying a record, not a secure boarding credential.
The final provider integration must deliver authoritative paid status and an
opaque signed per-passenger ticket token, plus a staff validation endpoint, before
these cards can become valid boarding tickets. Do not use client-side flags or
checkout-return query parameters to assert paid status.

QR generation happens locally using qrcode-generator 2.0.4 (MIT), vendored at
`public/assets/vendor/qrcode`. QR payloads exclude names, contact details, ID
numbers and hold tokens. Passenger IDs are masked on printed cards. No personal
details are persisted in localStorage, sessionStorage or URL query parameters.
Unsubmitted data remains in memory and is lost on reload. WhatsApp handoff includes
route/date, group size and preferred seats, but no passenger identities.

## Validation

`npm test` includes layout, passenger validation, provider mapping, group payloads,
partial-failure idempotence, expired holds/conflicts and independently decoded QR
codes. Existing single-passenger and cinematic experience checks remain intact.
Browser smoke verification uses mocked provider data; never real bookings.

Verified locally on 2026-10-29: all 29 automated tests passed; three-passenger
offline preview and mocked online booking each rendered three separate QR cards.
The mocked online flow sent three distinct passenger/seat payloads with the same
primary customer contact, blocked sold seat 60, and displayed three checkout links.
At 1440px desktop and 390px mobile widths, no horizontal overflow was observed.
Print media hides the form and seat-selection controls. Live payment, production
inventory and provider-issued boarding ticket validation were not tested because
the local environment has no configured VTTS connection.

Direct browser downloads were verified for a three-page group PDF and a one-page
individual PDF. Extracted text and rendered pages show the correct passenger,
route, travel date, check-in/departure times, seat and preview status. Tests cover
different departure times, previous-day check-in, unknown origins and safe filenames.

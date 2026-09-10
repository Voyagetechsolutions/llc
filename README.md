# Lazarus Luxury Coaches — Website & Booking System

Premium website with a real booking backend for Lazarus Luxury Coaches (LLC),
the daily Johannesburg ⇄ Bulawayo luxury coach service.

## Run it

```
npm install
npm start
```

Then open:

- **Website:** http://localhost:8765
- **Admin dashboard:** http://localhost:8765/admin

## Admin access

The default admin key is `lazarus-admin-2026`.

**Change it before going live** by setting the `ADMIN_KEY` environment variable:

```powershell
$env:ADMIN_KEY = "your-secret-key"; npm start
```

## How bookings work

1. A customer fills in the booking form on the homepage (route, date, seats, name, phone).
2. The request is saved to a SQLite database (`data/bookings.db`) with a unique
   reference like `LLC-A1B2C3` and status `pending`.
3. The customer is shown their reference and a one-tap **Confirm on WhatsApp**
   button that sends the full booking details to your ZW WhatsApp line.
4. Your team opens `/admin`, signs in with the admin key, and sees every request
   with stats. Each booking has the passenger's phone as a WhatsApp link and
   **Confirm / Cancel** buttons.

## Tech

- **Backend:** Node.js (>= 22.5) + Express + built-in `node:sqlite` — no native
  build tools needed.
- **Frontend:** static HTML/CSS/JS in `public/` — no framework, loads fast.
- **Database:** `data/bookings.db` (SQLite). Back this file up regularly.

## Key business details on the site

- Departures daily at **17:00**, check-in **16:00** (per the official LLC flyer)
- Fares: JHB → BYO **R800** · BYO → JHB **R600**
- JHB departure point: Power House · BYO: Watering Hole Yard, G Silundika St
- Booking office: 1st Floor Norval House, Shop 15, Cnr Fife St & 6th Ave, Bulawayo
- Phones: ZW +263 777 955 373 · SA +27 74 641 2345

## Deploying

Any Node host works (Railway, Render, a VPS, etc.):

1. Upload the project (or push to GitHub and connect the host).
2. Set `ADMIN_KEY` (and optionally `PORT`) in the host's environment settings.
3. Ensure the `data/` folder is on persistent storage so bookings survive restarts.
4. Point the `lazarusluxurycoaches.co.za` domain at the host.

# Lazarus Luxury Coaches — Website & Booking System

Premium website with a real booking backend for Lazarus Luxury Coaches (LLC),
the daily Johannesburg ⇄ Bulawayo luxury coach service.

## Run it

```powershell
npm install
$env:ADMIN_KEY = "your-secret-key"; npm start
```

Then open:

- **Website:** http://localhost:8765
- **Admin dashboard:** http://localhost:8765/admin

## Admin access

There is no default admin key. The server **refuses to start** unless `ADMIN_KEY`
is set, so the dashboard can never be left open with a key that is published in
this repository. Pick your own value and set it in the environment — locally as
above, and on the host via its environment settings.

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ADMIN_KEY` | **yes** | — | Key for the `/admin` dashboard and admin API |
| `DB_PATH` | no | `./data/bookings.db` | Where the SQLite database lives — point this at a persistent volume in production |
| `PORT` | no | `8765` | Port to listen on (hosts usually set this for you) |

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

- **Backend:** Node.js (>= 24) + Express + built-in `node:sqlite` — no native
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

This app keeps bookings in a SQLite file on disk, so it needs a host that gives
it a **long-running process and persistent storage** — Railway, Render, Fly.io,
or a VPS. It will **not** work on serverless platforms such as Vercel or Netlify
Functions: their filesystems are read-only apart from a temporary directory that
is wiped between invocations, so bookings would be lost. Moving to one of those
would mean replacing SQLite with a hosted database first.

### Railway (recommended)

```bash
railway init
railway volume add --mount-path /data
railway variables --set ADMIN_KEY=your-secret-key --set DB_PATH=/data/bookings.db
railway up
```

The volume is what makes bookings survive restarts and redeploys; `DB_PATH`
points the database at it. Railway supplies `PORT` automatically.

Finally, point the `lazarusluxurycoaches.co.za` domain at the host and **back up
the database file regularly** — it is the only copy of your bookings.

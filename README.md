# Lazarus Luxury Coaches — Website

Marketing and online booking website for Lazarus Luxury Coaches (LLC), the daily
Johannesburg ⇄ Bulawayo luxury coach service.

The website keeps no bookings of its own. Trips, fares, seat plans, availability,
bookings, payments and tickets all live in **VTTS**, the bus management system.
The booking card on the homepage is a sales channel into VTTS through its public
channel API, so a seat sold online, at the counter or through a reseller comes
out of the same inventory and cannot be sold twice.

## How online booking works

1. The page loads `/api/config` from this server to learn the VTTS API address
   and the website's publishable channel key.
2. The browser then calls VTTS directly:
   - `GET /channel-api/v1/catalog` — published departures, fares, booking policy
     and payment methods.
   - `GET /channel-api/v1/trips/:tripId/availability` — the live seat map.
   - `POST /channel-api/v1/seat-holds` — holds the chosen seat for the operator's
     hold window (five minutes by default), shown to the customer as a countdown.
   - `POST /channel-api/v1/bookings` — creates the pending booking and payment
     checkout against that hold.
3. The customer receives a VTTS booking reference and, when the payment provider
   returns one, a secure payment link. VTTS confirms the booking and issues the
   ticket only after the provider reports the payment.

Staff manage trips, seat plans, fares, bookings and check-in in VTTS. If VTTS is
not configured or cannot be reached, the booking card switches to WhatsApp and
phone booking and writes the technical reason to the browser console.

Each online booking is for one seat, because VTTS holds and charges every seat
individually. Groups book one seat at a time or through WhatsApp.

## Connecting the website to VTTS

In VTTS, signed in as a Lazarus company administrator:

1. **Company settings** — turn on public booking. The catalog is refused until
   this is enabled.
2. **Routes and trips** — set up Johannesburg → Bulawayo and
   Bulawayo → Johannesburg and publish departures on a bus that has a seat
   layout. Trips on a bus without a seat layout are not offered online.
3. **Payment providers** — add and activate at least one. Without one, customers
   can choose a seat but cannot check out.
4. **Channels** — create a `WEBSITE` channel, activate it, and issue a
   `PUBLISHABLE` credential whose allowed origins include every address the site
   is served from, for example `https://llc-umber.vercel.app`,
   `https://lazarusluxurycoaches.co.za` and `http://localhost:8765`. The key is
   shown only once.

Then set these on the website host:

| Variable | Example | Purpose |
| --- | --- | --- |
| `VTTS_API_URL` | `https://dvfyf668filek.cloudfront.net/api/v1` | VTTS API base, including `/api/v1` |
| `VTTS_CHANNEL_KEY` | `ch_…` | The publishable website credential |
| `PORT` | `8765` | Local port; hosts usually set this |

A publishable key is meant to reach the browser: VTTS accepts it only from the
allowed origins, and it can only read the published catalog and create holds and
bookings. It is set per environment rather than committed so it can be rotated
or revoked without a code change.

## Run it locally

```powershell
npm install
$env:VTTS_API_URL = "https://dvfyf668filek.cloudfront.net/api/v1"
$env:VTTS_CHANNEL_KEY = "ch_your_publishable_key"
npm start
```

Open http://localhost:8765. That origin must be on the key's allowed origins, or
VTTS rejects the requests with 403.

## Deploying (Vercel)

The site is stateless, so it runs on Vercel unchanged: static files are served
from the CDN and only `/api/config` runs as a function. Set `VTTS_API_URL` and
`VTTS_CHANNEL_KEY` in the Vercel project's environment variables and redeploy.
Add each new domain to the credential's allowed origins before pointing the
domain at the site.

## Tech

- **Backend:** Node.js + Express, serving the static site and `/api/config`.
- **Frontend:** static HTML/CSS/JS in `public/`, no framework.
- **Booking system:** VTTS public channel API.

## Key business details on the site

- Departures daily at **17:00**, check-in **16:00** (per the official LLC flyer)
- Fares: JHB → BYO **R800** · BYO → JHB **R600**
- JHB departure point: Power House · BYO: Watering Hole Yard, G Silundika St
- Booking office: 1st Floor Norval House, Shop 15, Cnr Fife St & 6th Ave, Bulawayo
- Phones: ZW +263 777 955 373 · SA +27 74 641 2345

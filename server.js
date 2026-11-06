import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8765;
const SERVERLESS = Boolean(process.env.VERCEL);

// Trips, seats and bookings live in VTTS. The browser calls its public channel
// API directly with a publishable key, which VTTS honours only from the origins
// allowlisted on that key — so handing it to the page is the intended design.
const VTTS_API_URL = (process.env.VTTS_API_URL || "").replace(/\/+$/, "");
const VTTS_CHANNEL_KEY = process.env.VTTS_CHANNEL_KEY || "";

const WEBSITE_ORIGIN = process.env.WEBSITE_ORIGIN || "http://localhost:8765";
const bookingEnabled = Boolean(VTTS_API_URL && VTTS_CHANNEL_KEY);

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ bookingEnabled });
});

app.use("/api/booking", express.json({ limit: "16kb" }), async (req, res) => {
  const readable = /^\/(?:catalog|trips\/[a-f0-9-]{36}\/availability|bookings\/(?:BK|LLC)-[a-z0-9-]{3,57})$/i;
  const writable = /^\/(?:seat-holds|bookings)$/;
  if (!bookingEnabled) return res.status(503).json({ message: "Online booking is unavailable." });
  if (!(req.method === "GET" && readable.test(req.path)) &&
      !(req.method === "POST" && writable.test(req.path))) {
    return res.status(404).json({ message: "Booking endpoint not found." });
  }
  if (req.method === "POST" && req.get("origin") !== WEBSITE_ORIGIN) {
    return res.status(403).json({ message: "Booking origin is not allowed." });
  }
  try {
    const upstream = await fetch(VTTS_API_URL + "/channel-api/v1" + req.path, {
      method: req.method,
      headers: { "x-vtts-channel-key": VTTS_CHANNEL_KEY, origin: WEBSITE_ORIGIN, "content-type": "application/json" },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    return res.status(upstream.status).set("Cache-Control", "no-store").json(await upstream.json());
  } catch {
    return res.status(502).json({ message: "VTTS booking service is temporarily unavailable." });
  }
});

if (!VTTS_API_URL || !VTTS_CHANNEL_KEY) {
  console.warn(
    "VTTS_API_URL and VTTS_CHANNEL_KEY are not both set — the booking card will\n" +
      "offer WhatsApp and phone booking until they are."
  );
}

// Serverless hosts import the app and handle listening themselves.
if (!SERVERLESS) {
  app.listen(PORT, () => {
    console.log(`Lazarus Luxury Coaches running on http://localhost:${PORT}`);
    console.log(`Booking backend: ${VTTS_API_URL || "not configured"}`);
  });
}

export default app;

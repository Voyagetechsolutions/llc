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

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ vttsApiUrl: VTTS_API_URL || null, channelKey: VTTS_CHANNEL_KEY || null });
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

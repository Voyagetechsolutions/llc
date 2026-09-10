import express from "express";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8765;

// Serverless hosts (Vercel) give us a read-only bundle and a scratch /tmp that
// is wiped between invocations. Good enough to demo the flow, useless as a
// record of real bookings — see EPHEMERAL below.
const SERVERLESS = Boolean(process.env.VERCEL);

// There is deliberately no fallback key: a default committed here would be
// public. Without ADMIN_KEY the site still runs, but /admin stays locked.
const ADMIN_KEY = process.env.ADMIN_KEY;

// ===== Database =====
// DB_PATH lets the host point this at a persistent volume (Railway mounts one
// at /data). The default keeps local development working with no config.
const DB_PATH =
  process.env.DB_PATH || (SERVERLESS ? "/tmp/bookings.db" : path.join(__dirname, "data", "bookings.db"));
const EPHEMERAL = DB_PATH.startsWith("/tmp");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    route TEXT NOT NULL,
    travel_date TEXT NOT NULL,
    seats INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const ROUTES = {
  "jhb-byo": { label: "Johannesburg → Bulawayo", fare: 800 },
  "byo-jhb": { label: "Bulawayo → Johannesburg", fare: 600 },
};

function makeReference() {
  return "LLC-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

// ===== App =====
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) {
    return res.status(503).json({ error: "Admin dashboard is disabled. Set ADMIN_KEY on the host to enable it." });
  }
  if (req.get("x-admin-key") !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Create a booking request
app.post("/api/bookings", (req, res) => {
  const { fullName, phone, email, route, travelDate, seats, notes } = req.body || {};

  const errors = [];
  if (!fullName || String(fullName).trim().length < 2) errors.push("Full name is required.");
  if (!phone || String(phone).replace(/\D/g, "").length < 9) errors.push("A valid phone number is required.");
  if (!ROUTES[route]) errors.push("Please choose a route.");
  if (!travelDate || isNaN(Date.parse(travelDate))) errors.push("Please choose a travel date.");
  else if (new Date(travelDate) < new Date(new Date().toDateString())) errors.push("Travel date cannot be in the past.");
  const seatCount = parseInt(seats, 10);
  if (!seatCount || seatCount < 1 || seatCount > 10) errors.push("Seats must be between 1 and 10.");
  if (errors.length) return res.status(400).json({ errors });

  let reference = makeReference();
  const insert = db.prepare(`
    INSERT INTO bookings (reference, full_name, phone, email, route, travel_date, seats, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // retry on the (unlikely) chance of a duplicate reference
  for (let attempt = 0; ; attempt++) {
    try {
      insert.run(
        reference,
        String(fullName).trim(),
        String(phone).trim(),
        email ? String(email).trim() : null,
        route,
        travelDate,
        seatCount,
        notes ? String(notes).trim().slice(0, 500) : null
      );
      break;
    } catch (err) {
      if (attempt < 3 && String(err).includes("UNIQUE")) {
        reference = makeReference();
        continue;
      }
      console.error(err);
      return res.status(500).json({ errors: ["Something went wrong. Please try again or contact us on WhatsApp."] });
    }
  }

  res.status(201).json({
    reference,
    route: ROUTES[route].label,
    fare: ROUTES[route].fare,
    travelDate,
    seats: seatCount,
  });
});

// Admin: list bookings
app.get("/api/bookings", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM bookings ORDER BY created_at DESC").all();
  res.json(rows.map((r) => ({ ...r, routeLabel: ROUTES[r.route]?.label || r.route })));
});

// Admin: update booking status
app.patch("/api/bookings/:id", requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!["pending", "confirmed", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const result = db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Booking not found." });
  res.json({ ok: true });
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Tells the front end when it is running against throwaway storage.
app.get("/api/status", (req, res) => {
  res.json({ ok: true, ephemeral: EPHEMERAL, adminEnabled: Boolean(ADMIN_KEY) });
});

if (EPHEMERAL) {
  console.warn(
    "DEMO MODE: bookings are stored in /tmp and will be lost when the instance\n" +
      "recycles. Do not take real bookings here — set DB_PATH to a persistent\n" +
      "volume (or move to a host that has one) before going live."
  );
}
if (!ADMIN_KEY) {
  console.warn("ADMIN_KEY is not set — /admin is disabled until you set it on the host.");
}

// Serverless hosts import the app and handle listening themselves.
if (!SERVERLESS) {
  app.listen(PORT, () => {
    console.log(`Lazarus Luxury Coaches running on port ${PORT}`);
    console.log(`Bookings database: ${DB_PATH}`);
    console.log(`Admin dashboard: /admin (sign in with your ADMIN_KEY)`);
  });
}

export default app;

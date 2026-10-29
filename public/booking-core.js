export const CAPACITY = 60;
export function seatLayout() {
  return Array.from({ length: CAPACITY }, (_, i) => ({ number: i + 1, row: Math.floor(i / 4) + 1, column: [1, 2, 4, 5][i % 4] }));
}
export function validatePassengers(passengers, contact, requireId = false) {
  const errors = [];
  if (!passengers.length || passengers.length > CAPACITY) errors.push('Choose between 1 and 60 passengers.');
  if (contact.phone.replace(/\D/g, '').length < 7) errors.push('Enter a valid primary contact phone number.');
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) errors.push('Enter a valid email address.');
  passengers.forEach((p, i) => {
    if (!p.firstName?.trim() || !p.lastName?.trim()) errors.push(`Enter the full name of passenger ${i + 1}.`);
    if (requireId && (p.idNumber?.trim().length || 0) < 3) errors.push(`Enter the passport or ID number of passenger ${i + 1}.`);
  });
  return errors;
}
// Never infer provider seat IDs from geometry; only exact numeric seat labels map.
export function mapAvailability(seats) {
  const map = new Map();
  for (const seat of seats) {
    if (!/^([1-9]|[1-5][0-9]|60)$/.test(String(seat.code))) continue;
    const number = Number(seat.code);
    if (map.has(number)) throw new Error('The booking provider returned duplicate seat numbers. Please book with our team.');
    map.set(number, seat);
  }
  return map;
}
export function safeCheckoutUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
export function ticketPayload(recordId, reference) {
  // No names, phone numbers, passport/ID numbers or hold tokens in QR data.
  return JSON.stringify({ v: 1, issuer: 'LLC', type: reference ? 'booking-reference' : 'booking-preview', id: recordId, ...(reference ? { reference } : {}) });
}
export class GroupBooking {
  constructor(api, trip, passengers, selected, contact, provider, makeId = () => crypto.randomUUID()) {
    if (passengers.length !== selected.length || new Set(selected.map(s => s.id)).size !== passengers.length) throw new Error('Select one different seat for every passenger.');
    this.api = api;
    this.trip = trip;
    this.records = passengers.map((passenger, i) => ({
      passenger: { ...passenger }, seat: selected[i], id: makeId(), key: makeId(), result: null, hold: null,
      customer: { ...contact, firstName: passengers[0].firstName, lastName: passengers[0].lastName }, provider,
    }));
  }
  async submit(ttlSeconds, onChange = () => {}) {
    // Freeze payloads, keys and successful results so a retry cannot double book.
    for (const record of this.records) {
      if (record.result) continue;
      if (!record.hold) {
        record.hold = await this.api('/seat-holds', { method: 'POST', body: JSON.stringify({ tripId: this.trip.id, seatId: record.seat.id, ttlSeconds }) });
      }
      if (!record.payload) {
        const expiry = new Date(record.hold.expiresAt).getTime();
        if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error('A seat hold expired. Contact our team before retrying.');
        record.payload = {
          tripId: this.trip.id, seatId: record.seat.id, holdToken: record.hold.holdToken,
          paymentProviderId: record.provider, idempotencyKey: record.key,
          customer: { ...record.customer, email: record.customer.email || undefined },
          passenger: { ...record.passenger, idNumber: record.passenger.idNumber || undefined },
        };
      }
      const result = await this.api('/bookings', { method: 'POST', body: JSON.stringify(record.payload) });
      if (!result?.booking?.reference) throw new Error('The booking provider did not return a booking reference. Contact our team or retry with the same booking key.');
      record.result = result;
      onChange(record);
    }
    return this.records;
  }
}

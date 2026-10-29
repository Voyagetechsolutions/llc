// Operator-confirmed check-in offsets (29 October 2026). Departure always comes
// from the selected published trip; a daily fallback is used only for previews.
export const ROUTE_SCHEDULES = {
  johannesburg: { checkInMinutes: 60, timeZone: 'Africa/Johannesburg' },
  bulawayo: { checkInMinutes: 30, timeZone: 'Africa/Harare' },
};
export function originKey(trip) {
  const origin = typeof trip.route === 'string' ? trip.route.split('→')[0] : trip.route?.origin;
  const key = String(origin || '').trim().toLowerCase();
  return key === 'jhb' ? 'johannesburg' : key;
}
const validDate = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date : null;
};
export function ticketSchedule(trip) {
  const route = ROUTE_SCHEDULES[originKey(trip)];
  let zone = trip.branch?.timezone || route?.timeZone || 'Africa/Johannesburg';
  try { new Intl.DateTimeFormat('en-ZA', { timeZone: zone }); } catch { zone = route?.timeZone || 'Africa/Johannesburg'; }
  // Both existing daily services are listed at 17:00 on the site. A preview is
  // explicitly labelled; it never substitutes for a published trip's timestamp.
  const departure = trip.preview && route && /^\d{4}-\d{2}-\d{2}$/.test(trip.date)
    ? validDate(`${trip.date}T17:00:00+02:00`) : validDate(trip.departureAt);
  const checkIn = departure && route ? new Date(departure.getTime() - route.checkInMinutes * 60000) : null;
  const format = date => date ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', hour: '2-digit', minute:'2-digit' }).format(date) : 'To be confirmed';
  const date = departure ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, day:'2-digit', month:'short', year:'numeric' }).format(departure) : (trip.date || 'To be confirmed');
  const checkInDate = checkIn ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, day:'2-digit', month:'short', year:'numeric' }).format(checkIn) : null;
  return { date, checkInDate, checkIn:format(checkIn), departure:format(departure), checkInAt:checkIn?.toISOString() || null, departureAt:departure?.toISOString() || null, timeZone:zone, minutes:route?.checkInMinutes ?? null, preview:!!trip.preview };
}

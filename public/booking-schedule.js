// Operator-confirmed check-in offsets. Departure always comes
// from the selected published trip; a daily fallback is used only for previews.
export const ROUTE_SCHEDULES = {
  johannesburg: { checkInMinutes: 60, previewDeparture: '17:00', timeZone: 'Africa/Johannesburg' },
  bulawayo: { checkInMinutes: 45, previewDeparture: '16:00', timeZone: 'Africa/Harare' },
};
const TICKET_STOPS = {
  johannesburg: { city: 'Johannesburg', country: 'South Africa', boardingPoint: 'Power House, Johannesburg' },
  bulawayo: { city: 'Bulawayo', country: 'Zimbabwe', boardingPoint: 'Norvaal House, Shop 8, corner of 6th Avenue and Fife Street' },
};
const stopKey = city => {
  const key = String(city || '').trim().toLowerCase();
  return { jhb: 'johannesburg', byo: 'bulawayo' }[key] || key;
};
export function ticketRoute(trip) {
  const [origin, destination] = typeof trip.route === 'string'
    ? trip.route.split('→') : [trip.route?.origin, trip.route?.destination];
  const stop = city => Object.hasOwn(TICKET_STOPS, stopKey(city))
    ? TICKET_STOPS[stopKey(city)] : { city: city?.trim() || 'To be confirmed' };
  return { origin: stop(origin), destination: stop(destination) };
}
export function originKey(trip) {
  return stopKey(typeof trip.route === 'string' ? trip.route.split('→')[0] : trip.route?.origin);
}
const validDate = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date : null;
};
export function ticketSchedule(trip) {
  const route = ROUTE_SCHEDULES[originKey(trip)];
  let zone = trip.branch?.timezone || route?.timeZone || 'Africa/Johannesburg';
  try { new Intl.DateTimeFormat('en-ZA', { timeZone: zone }); } catch { zone = route?.timeZone || 'Africa/Johannesburg'; }
  // Previews use the advertised daily departure for the route.
  const departure = trip.preview && route && /^\d{4}-\d{2}-\d{2}$/.test(trip.date)
    ? validDate(`${trip.date}T${route.previewDeparture}:00+02:00`) : validDate(trip.departureAt);
  const checkIn = departure && route ? new Date(departure.getTime() - route.checkInMinutes * 60000) : null;
  const format = date => date ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', hour: '2-digit', minute:'2-digit' }).format(date) : 'To be confirmed';
  const date = departure ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, day:'2-digit', month:'short', year:'numeric' }).format(departure) : (trip.date || 'To be confirmed');
  const checkInDate = checkIn ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, day:'2-digit', month:'short', year:'numeric' }).format(checkIn) : null;
  return { date, checkInDate, checkIn:format(checkIn), departure:format(departure), checkInAt:checkIn?.toISOString() || null, departureAt:departure?.toISOString() || null, timeZone:zone, minutes:route?.checkInMinutes ?? null, preview:!!trip.preview };
}

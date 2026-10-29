import qrcode from './assets/vendor/qrcode/qrcode.mjs';
import { seatLayout, validatePassengers, mapAvailability, safeCheckoutUrl, ticketPayload, GroupBooking } from './booking-core.js';
const $ = id => document.getElementById(id);
const state = { config: null, catalog: null, trip: null, live: false, passengers: [], selected: [], available: new Map(), records: [], group: null, contact: null, busy: false };
const steps = ['passengerStep', 'seatStep', 'reviewStep'];
const node = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
const nameOf = p => `${p.firstName} ${p.lastName}`;
const money = (minor, currency) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR' }).format(minor / 100);
const departure = trip => {
  const options = { dateStyle: 'medium', timeStyle: 'short', timeZone: trip.branch?.timezone || 'Africa/Johannesburg' };
  return new Intl.DateTimeFormat('en-ZA', options).format(new Date(trip.departureAt));
};
function error(message = '') { $('error').textContent = message; $('error').hidden = !message; if (message) $('error').scrollIntoView({ block: 'center' }); }
function showStep(index) {
  steps.forEach((id, i) => $(id).hidden = i !== index);
  document.querySelectorAll('.steps li').forEach((item, i) => i === index ? item.setAttribute('aria-current', 'step') : item.removeAttribute('aria-current'));
  error();
  (index === 1 ? $('seatHeading') : index === 2 ? $('reviewHeading') : $('passengerHeading')).focus();
  document.querySelector('.steps').scrollIntoView({ block:'start', behavior:'instant' });
}
async function api(path, init = {}) {
  const response = await fetch(`${state.config.vttsApiUrl.replace(/\/+$/, '')}/channel-api/v1${path}`, {
    ...init, headers: { 'x-vtts-channel-key': state.config.channelKey, ...(init.body ? { 'content-type': 'application/json' } : {}) },
  });
  const body = await response.json();
  if (!response.ok) {
    const details = Array.isArray(body?.issues) ? body.issues.map(i => i.message).join(' ') : body?.message;
    throw new Error(typeof details === 'string' ? details : `Booking service returned ${response.status}. Please try again.`);
  }
  return body;
}
function saveFields() {
  const old = state.passengers;
  document.querySelectorAll('.passenger-card').forEach((card, i) => {
    old[i] = Object.fromEntries([...card.querySelectorAll('input')].map(input => [input.dataset.field, input.value.trim()]));
  });
}
function renderPassengerFields() {
  const count = Number($('passengerCount').value);
  $('passengerFields').replaceChildren(...Array.from({ length: count }, (_, i) => {
    const fieldset = node('fieldset', undefined, 'passenger-card');
    fieldset.append(node('legend', `${i === 0 ? 'Primary passenger' : `Passenger ${i + 1}`} · ${i + 1} of ${count}`));
    const grid = node('div', undefined, 'field-grid');
    for (const [key, title] of [['firstName','First name'], ['lastName','Last name'], ['idNumber','Passport / ID number']]) {
      const label = node('label', title + (key === 'idNumber' && !state.catalog?.bookingPolicy?.requirePassengerId ? ' (optional)' : ''));
      const input = node('input'); input.name = `passenger-${i}-${key}`; input.dataset.field = key;
      input.id = `passenger-${i}-${key}`; input.maxLength = key === 'idNumber' ? 50 : 80;
      input.required = key !== 'idNumber' || !!state.catalog?.bookingPolicy?.requirePassengerId;
      input.autocomplete = i === 0 ? (key === 'firstName' ? 'given-name' : key === 'lastName' ? 'family-name' : 'off') : 'off';
      input.value = state.passengers[i]?.[key] || ''; label.append(input); grid.append(label);
    }
    fieldset.append(grid); return fieldset;
  }));
}
$('passengerCount').append(...Array.from({ length: 60 }, (_, i) => { const option = node('option', `${i + 1} passenger${i ? 's' : ''}`); option.value = String(i + 1); return option; }));
$('passengerCount').addEventListener('change', () => { saveFields(); renderPassengerFields(); });
renderPassengerFields();
function offline(message) {
  state.live = false;
  $('connectionStatus').textContent = `${message} You can still add passengers, plan seats and print a preview, then book with our team.`;
  $('trip').replaceChildren(node('option', 'Online departures unavailable — plan with our team'));
  $('trip').disabled = true;
  $('previewJourney').hidden = false; $('preferredDate').disabled = false;
  if (new URLSearchParams(location.search).get('route') === 'byo-jhb') $('preferredRoute').selectedIndex = 1;
}
async function init() {
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone:'Africa/Johannesburg', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  $('preferredDate').min = localDate;
  try {
    const response = await fetch('/api/config', { cache:'no-store' });
    if (!response.ok) throw new Error('Connection unavailable.');
    state.config = await response.json();
    if (!state.config.vttsApiUrl || !state.config.channelKey) return offline('Online booking is currently unavailable.');
    state.catalog = await api('/catalog');
    if (!state.catalog.trips?.length) return offline('No published departures are currently on sale.');
    state.live = true;
    $('trip').replaceChildren(...state.catalog.trips.map(trip => {
      const option = node('option', `${trip.route.origin} → ${trip.route.destination} · ${departure(trip)}`); option.value = trip.id; return option;
    }));
    const hint = new URLSearchParams(location.search).get('route');
    const match = state.catalog.trips.find(t => hint === 'jhb-byo' ? /^(johannesburg|jhb)/i.test(t.route.origin) : hint === 'byo-jhb' ? /^bulawayo/i.test(t.route.origin) : false);
    if (match) $('trip').value = match.id;
    $('trip').disabled = false;
    $('connectionStatus').textContent = 'Choose a published departure. Live seats are checked before selection; seats are held when you submit your bookings.';
    saveFields(); renderPassengerFields();
  } catch { offline('We could not connect to online booking.'); }
}
$('journeyForm').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy) return;
  saveFields();
  const count = Number($('passengerCount').value);
  state.contact = { phone:$('phone').value.trim(), email:$('email').value.trim() };
  const problems = validatePassengers(state.passengers.slice(0, count), state.contact, !!state.catalog?.bookingPolicy?.requirePassengerId);
  if (problems.length) return error(problems.join('\n'));
  if (state.live) {
    state.trip = state.catalog.trips.find(t => t.id === $('trip').value);
    if (!state.trip) return error('Choose a published departure.');
  } else {
    if (!$('preferredDate').value) return error('Choose a preferred travel date.');
    state.trip = { preview:true, route:$('preferredRoute').value, date:$('preferredDate').value };
  }
  state.busy = true; event.submitter.disabled = true; error();
  try {
    if (state.live) {
      const response = await api(`/trips/${encodeURIComponent(state.trip.id)}/availability`);
      state.available = mapAvailability(response.seats);
      if (!state.available.size) throw new Error('This departure does not use the numbered 1–60 layout. Please book it with our team.');
    }
    state.selected = []; state.records = []; state.group = null;
    renderSeats(); showStep(1);
  } catch (e) { error(e.message); }
  finally { state.busy = false; event.submitter.disabled = false; }
});
function renderSeats() {
  const count = Number($('passengerCount').value);
  $('seatMap').replaceChildren(...seatLayout().map(seat => {
    const live = state.available.get(seat.number);
    const unavailable = state.live && (!live || live.availability !== 'AVAILABLE');
    const selected = state.selected.includes(seat.number);
    const button = node('button', String(seat.number), 'coach-seat'); button.type = 'button';
    button.dataset.seat = seat.number; button.style.gridRow = seat.row; button.style.gridColumn = seat.column;
    button.disabled = unavailable;
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `Seat ${seat.number}, ${unavailable ? 'unavailable' : selected ? 'selected' : state.live ? 'available' : 'preview only'}`);
    button.addEventListener('click', () => {
      if (state.selected.includes(seat.number)) state.selected = state.selected.filter(n => n !== seat.number);
      else if (state.selected.length < count) state.selected.push(seat.number);
      else return error(`You have selected ${count} seats. Remove a seat before choosing another.`);
      error(); renderSeats(); $('seatMap').querySelector(`[data-seat="${seat.number}"]`).focus();
    }); return button;
  }));
  $('selectionCount').textContent = `${state.selected.length} of ${count} seats selected`;
  $('seatMode').textContent = state.live ? '60 seats · 2 + aisle + 2. Availability may change until a hold is accepted.' : '60 seats · 2 + aisle + 2. Preview only: these seats are not reserved and do not represent live availability.';
  $('assignments').replaceChildren(...state.passengers.slice(0,count).map((p,i) => node('li', `${nameOf(p)} — ${state.selected[i] ? `Seat ${state.selected[i]}` : 'Choose a seat'}`)));
  $('reviewButton').disabled = state.selected.length !== count;
  $('fareSummary').textContent = state.live ? `Estimated total: ${money(state.trip.baseFareMinor * count,state.trip.currency)} · Final amounts set by the booking provider.` : 'Our team will confirm the fare and seat availability.';
}
$('backPassengers').addEventListener('click', () => showStep(0));
$('backSeats').addEventListener('click', () => { if (!state.group) showStep(1); });
$('reviewButton').addEventListener('click', () => {
  const count = Number($('passengerCount').value);
  if (state.selected.length !== count) return;
  state.records = state.passengers.slice(0,count).map((passenger,i) => ({ passenger:{ ...passenger }, seat:state.selected[i], id:crypto.randomUUID(), result:null }));
  $('provider').replaceChildren(...(state.catalog?.paymentProviders || []).map(p => { const option = node('option',p.displayName); option.value = p.id; return option; }));
  const canSubmit = state.live && !!state.catalog?.paymentProviders?.length;
  $('paymentSelection').hidden = !canSubmit; $('submitBooking').hidden = !canSubmit; $('teamBooking').hidden = canSubmit;
  $('submitBooking').disabled = false; $('submitBooking').textContent = `Create ${count} passenger booking${count === 1 ? '' : 's'} →`;
  $('submissionStatus').textContent = '';
  $('ticketNotice').textContent = canSubmit ? 'Preview only — not valid for boarding. Create the bookings, then complete each passenger’s payment. Confirmed boarding tickets are issued by the booking provider after payment.' : 'Preview only — no seats are reserved. Contact our team to confirm this journey, make payment and receive your valid boarding tickets.';
  const route = state.trip.preview ? `${state.trip.route} · requested ${state.trip.date}` : `${state.trip.route.origin} → ${state.trip.route.destination} · ${departure(state.trip)}`;
  $('reviewJourney').textContent = `${route} · ${count} passenger${count === 1 ? '' : 's'}`;
  // Passenger identities stay on this page; no personal data in the WhatsApp URL.
  $('teamBooking').href = `https://wa.me/263777955373?text=${encodeURIComponent(`Hello Lazarus Luxury Coaches. I'd like to book ${count} passenger(s). ${route}. Preferred seats: ${state.selected.join(', ')}. Please confirm availability and fare.`)}`;
  renderTickets(); showStep(2);
});
function detail(list, title, value) { const wrapper = node('div'); wrapper.append(node('dt',title), node('dd',value)); list.append(wrapper); }
function renderTickets() {
  $('tickets').replaceChildren(...state.records.map((record, i) => {
    const result = record.result;
    const reference = result?.booking?.reference;
    const ticket = node('article', undefined, 'ticket'); ticket.setAttribute('aria-label', `Passenger ${i + 1}: ${nameOf(record.passenger)}`);
    const head = node('div',undefined,'ticket-head'); head.append(node('span','LAZARUS LUXURY COACHES'),node('span',`${reference ? 'BOOKING RECORD' : 'TICKET PREVIEW'} · ${i + 1} / ${state.records.length}`));
    const body = node('div',undefined,'ticket-body'); const information = node('div'); information.append(node('h3',nameOf(record.passenger)));
    const dl = node('dl');
    detail(dl,'Passenger',i === 0 ? 'Primary passenger' : `Passenger ${i + 1}`);
    detail(dl,'Seat',String(typeof record.seat === 'number' ? record.seat : record.seat.code));
    detail(dl,'Route',state.trip.preview ? state.trip.route : `${state.trip.route.origin} → ${state.trip.route.destination}`);
    detail(dl,state.trip.preview ? 'Requested date' : 'Departure', state.trip.preview ? state.trip.date : departure(state.trip));
    detail(dl,reference ? 'Booking reference' : 'Status', reference || 'Preview · not reserved');
    detail(dl,'Contact',state.contact.phone);
    if (record.passenger.idNumber) detail(dl,'Passport / ID', `••••${record.passenger.idNumber.slice(-4)}`);
    if (result?.booking?.totalMinor !== undefined) detail(dl,'Amount',money(result.booking.totalMinor,result.booking.currency));
    information.append(dl);
    const checkout = safeCheckoutUrl(result?.checkoutUrl);
    if (checkout) { const pay = node('a',`Pay for ${record.passenger.firstName} ↗`,'outline-button'); pay.href=checkout; pay.target='_blank'; pay.rel='noopener'; information.append(pay); }
    const qrPanel = node('div',undefined,'ticket-qr'); const qr = qrcode(0,'M'); qr.addData(ticketPayload(record.id,reference)); qr.make();
    // Generated SVG comes exclusively from the local QR library, never user HTML.
    qrPanel.innerHTML=qr.createSvgTag(4,16); const svg=qrPanel.querySelector('svg'); svg.setAttribute('role','img'); svg.setAttribute('aria-label',`QR ${reference ? 'booking reference' : 'preview identifier'} for passenger ${i+1}`);
    qrPanel.append(node('small', reference || `Preview ${record.id.slice(0,8)}`));
    body.append(information,qrPanel);
    ticket.append(head,body,node('div',reference ? 'Booking created · Payment / ticket confirmation must be checked with the booking provider. This QR identifies the booking; it is not a validated boarding pass.' : 'PREVIEW ONLY · Not a confirmed ticket. No seat has been reserved.','ticket-foot'));
    return ticket;
  }));
}
$('printTickets').addEventListener('click', () => window.print());
$('submitBooking').addEventListener('click', async () => {
  if (state.busy || !state.live) return;
  state.busy=true; $('submitBooking').disabled=true; document.body.classList.add('submitting'); error();
  if (!state.group) {
    state.group = new GroupBooking(api,state.trip,state.records.map(r=>r.passenger),state.selected.map(n=>state.available.get(n)),state.contact,$('provider').value);
    state.records = state.group.records;
  }
  // Once a request has been sent, retain its immutable payload for safe retries.
  $('backSeats').disabled=true; $('provider').disabled=true;
  $('submissionStatus').textContent='Creating passenger bookings. Keep this page open until every result is shown.';
  try {
    const ttl = Math.min(900, Math.max(60,Math.round((state.catalog.bookingPolicy?.seatHoldMinutes || 5)*60)));
    await state.group.submit(ttl, () => { renderTickets(); $('submissionStatus').textContent=`${state.records.filter(r=>r.result).length} of ${state.records.length} passenger bookings created.`; });
    $('submitBooking').hidden=true;
    $('ticketNotice').textContent='Passenger booking records created. Complete each payment link below. The booking provider must confirm payment and issue your final boarding tickets.';
    $('submissionStatus').textContent=`All ${state.records.length} passenger booking records created. Print or save this page before closing it.`;
  } catch(e) {
    renderTickets();
    const created = state.records.filter(r=>r.result).length;
    error(`${created} of ${state.records.length} bookings created. ${e.message} Retry uses the same booking keys and keeps successful bookings. For a seat conflict or expired hold, contact our team with any references shown; do not start another booking for the same passengers.`);
    $('submitBooking').disabled=false; $('submitBooking').textContent='Retry remaining bookings →';
    $('teamBooking').hidden=false;
  } finally { state.busy=false; document.body.classList.remove('submitting'); }
});
window.addEventListener('beforeunload',event=>{ if(state.busy || state.group?.records.some(r=>!r.result)){event.preventDefault();event.returnValue='';} });
init().finally(() => { $('chooseSeats').disabled = false; });

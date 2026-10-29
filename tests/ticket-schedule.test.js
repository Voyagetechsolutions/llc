import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketSchedule } from '../public/booking-schedule.js';
import { filenameFor } from '../public/ticket-download.js';
const trip = origin => ({ route:{origin,destination:origin==='Johannesburg'?'Bulawayo':'Johannesburg'}, departureAt:'2026-12-15T15:00:00Z' });
test('Johannesburg check-in is 60 minutes before the selected departure',()=>{
  const schedule=ticketSchedule(trip('Johannesburg'));
  assert.equal(schedule.departure,'17:00');assert.equal(schedule.checkIn,'16:00');assert.equal(schedule.date,'15 Dec 2026');assert.equal(schedule.minutes,60);
});
test('Bulawayo check-in is 30 minutes before the selected departure',()=>{
  const schedule=ticketSchedule(trip('Bulawayo'));
  assert.equal(schedule.departure,'17:00');assert.equal(schedule.checkIn,'16:30');assert.equal(schedule.timeZone,'Africa/Harare');
});
test('uses actual trip time rather than hardcoding every ticket to 17:00',()=>{
  const schedule=ticketSchedule({...trip('Bulawayo'),departureAt:'2026-12-15T12:15:00Z'});
  assert.equal(schedule.departure,'14:15');assert.equal(schedule.checkIn,'13:45');
});
test('check-in can fall on the previous date',()=>{
  const schedule=ticketSchedule({...trip('Johannesburg'),departureAt:'2026-12-14T22:15:00Z'});
  assert.equal(schedule.departure,'00:15');assert.equal(schedule.checkIn,'23:15');assert.equal(schedule.checkInDate,'14 Dec 2026');assert.equal(schedule.date,'15 Dec 2026');
});
test('unknown origin never guesses a check-in offset and invalid times remain unconfirmed',()=>{
  assert.equal(ticketSchedule(trip('Unknown')).checkIn,'To be confirmed');
  const schedule=ticketSchedule({...trip('Johannesburg'),departureAt:'invalid',branch:{timezone:'Invalid/Zone'}});
  assert.equal(schedule.checkIn,'To be confirmed');assert.equal(schedule.departure,'To be confirmed');
});
test('offline previews use the advertised daily schedule and route-specific offsets',()=>{
  const jhb=ticketSchedule({preview:true,route:'Johannesburg → Bulawayo',date:'2026-12-15'});
  const byo=ticketSchedule({preview:true,route:'Bulawayo → Johannesburg',date:'2026-12-15'});
  assert.equal(jhb.checkIn,'16:00');assert.equal(byo.checkIn,'16:30');assert.equal(jhb.departure,'17:00');assert.equal(jhb.preview,true);
});
test('download filenames distinguish previews, records and group PDFs safely',()=>{
  const preview={seat:3,id:'12345678-0000'};
  assert.equal(filenameFor([preview]),'Lazarus-preview-seat-3-12345678.pdf');
  assert.equal(filenameFor([{...preview,result:{booking:{reference:'LLC/001'}}}]),'Lazarus-booking-LLC-001.pdf');
  assert.equal(filenameFor([preview,preview,preview]),'Lazarus-preview-3-passengers.pdf');
});

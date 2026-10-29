import test from 'node:test';
import assert from 'node:assert/strict';
import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';
import { seatLayout, validatePassengers, mapAvailability, ticketPayload, GroupBooking, safeCheckoutUrl } from '../public/booking-core.js';
const passengers = Array.from({length:3},(_,i)=>({firstName:`Passenger ${i+1}`,lastName:'Test',idNumber:`TEST-${i}`}));
const seats = passengers.map((_,i)=>({id:`seat-${i+1}`,code:String(i+1),availability:'AVAILABLE'}));
const contact = {phone:'+27000000000',email:'primary@example.com'};
test('60-seat layout has 15 complete rows, unique numbers and a centre aisle',()=>{
  const layout=seatLayout(); assert.equal(layout.length,60); assert.deepEqual(layout.map(s=>s.number),Array.from({length:60},(_,i)=>i+1));
  for(let row=1;row<=15;row++) assert.deepEqual(layout.filter(s=>s.row===row).map(s=>s.column),[1,2,4,5]);
});
test('validates every passenger and the primary contact',()=>{
  assert.deepEqual(validatePassengers(passengers,contact,true),[]);
  assert.match(validatePassengers([passengers[0],{firstName:'',lastName:''}],{phone:'123',email:'invalid'},true).join(' '),/passenger 2/);
  assert.ok(validatePassengers([],contact).length); assert.ok(validatePassengers(Array(61).fill(passengers[0]),contact).length);
});
test('availability maps provider IDs only from exact 1–60 labels',()=>{
  const map=mapAvailability([...seats,{id:'wrong',code:'1A'},{id:'outside',code:'61'},{id:'zero',code:'01'}]);
  assert.equal(map.size,3);assert.equal(map.get(1).id,'seat-1');assert.throws(()=>mapAvailability([seats[0],seats[0]]),/duplicate/);
});
test('three passengers create three distinct payloads, with the primary customer on each',async()=>{
  const submitted=[];let serial=0;
  const api=async(path,{body})=>{const b=JSON.parse(body);if(path==='/seat-holds')return {holdToken:`hold-${b.seatId}`,expiresAt:new Date(Date.now()+60000).toISOString()};submitted.push(b);return {booking:{reference:`LLC-${b.seatId}`}};};
  const group=new GroupBooking(api,{id:'trip'},passengers,seats,contact,'provider',()=>`uuid-${serial++}`);
  await group.submit(300);await group.submit(300);
  assert.equal(submitted.length,3);assert.equal(new Set(submitted.map(b=>b.idempotencyKey)).size,3);
  submitted.forEach((body,i)=>{assert.deepEqual(body.passenger,passengers[i]);assert.equal(body.seatId,seats[i].id);assert.equal(body.customer.firstName,passengers[0].firstName);assert.equal(body.customer.phone,contact.phone);});
});
test('partial failure retains successful results and replays exactly the uncertain payload',async()=>{
  const calls=[];let failed=false;let holds=0;
  const api=async(path,{body})=>{const b=JSON.parse(body);if(path==='/seat-holds'){holds++;return{holdToken:`hold-${b.seatId}`,expiresAt:new Date(Date.now()+60000).toISOString()};}calls.push(b);if(b.seatId==='seat-2'&&!failed){failed=true;throw new Error('network loss');}return{booking:{reference:b.seatId}};};
  const group=new GroupBooking(api,{id:'trip'},passengers,seats,contact,'provider');
  await assert.rejects(group.submit(300),/network loss/);assert.ok(group.records[0].result);assert.equal(group.records[1].result,null);
  await group.submit(300);assert.equal(calls.filter(b=>b.seatId==='seat-1').length,1);assert.deepEqual(calls[1],calls[2]);assert.equal(holds,3);assert.ok(group.records.every(r=>r.result));
});
test('rejects duplicate seat assignment and stops on expired holds or conflicts',async()=>{
  assert.throws(()=>new GroupBooking(()=>{},{id:'trip'},passengers,[seats[0],seats[0],seats[2]],contact,'provider'),/different seat/);
  let bookings=0;
  const group=new GroupBooking(async(path)=>{if(path==='/seat-holds')return{holdToken:'old',expiresAt:'2000-01-01T00:00:00Z'};bookings++;},{id:'trip'},[passengers[0]],[seats[0]],contact,'provider');
  await assert.rejects(group.submit(300),/expired/);assert.equal(bookings,0);
  const conflict=new GroupBooking(async()=>{throw new Error('Seat sold');},{id:'trip'},[passengers[0]],[seats[0]],contact,'provider');await assert.rejects(conflict.submit(300),/Seat sold/);
});
test('QR codes decode to distinct records without passenger personal data',()=>{
  const decoded=[];
  passengers.forEach((p,i)=>{
    const payload=ticketPayload(`record-${i}`,i?'REF-123':undefined);
    assert.ok(!payload.includes(p.firstName));assert.ok(!payload.includes(p.idNumber));assert.ok(!payload.includes(contact.phone));
    const qr=qrcode(0,'M');qr.addData(payload);qr.make();
    const count=qr.getModuleCount(),scale=5,margin=4,size=(count+margin*2)*scale;
    const image=new Uint8ClampedArray(size*size*4).fill(255);
    for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))for(let y=0;y<scale;y++)for(let x=0;x<scale;x++){
      const index=(((r+margin)*scale+y)*size+(c+margin)*scale+x)*4;image[index]=image[index+1]=image[index+2]=0;
    }
    const result=jsQR(image,size,size);assert.equal(result.data,payload);decoded.push(JSON.parse(result.data));
  });
  assert.equal(new Set(decoded.map(r=>r.id)).size,3);assert.equal(decoded[0].type,'booking-preview');assert.equal(decoded[1].type,'booking-reference');
});
test('checkout links only accept HTTPS',()=>{assert.equal(safeCheckoutUrl('javascript:alert(1)'),null);assert.equal(safeCheckoutUrl('http://example.com'),null);assert.equal(safeCheckoutUrl('https://example.com/pay'),'https://example.com/pay');});

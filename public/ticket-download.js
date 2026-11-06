import qrcode from './assets/vendor/qrcode/qrcode.mjs';
import { ticketPayload } from './booking-core.js';
import { ticketRoute, ticketSchedule } from './booking-schedule.js';
let libraryPromise;
function loadPdfLibrary() {
  if (globalThis.jspdf?.jsPDF) return Promise.resolve(globalThis.jspdf.jsPDF);
  if (!libraryPromise) {
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/assets/vendor/jspdf/jspdf.umd.min.js';
      script.onload = () => globalThis.jspdf?.jsPDF ? resolve(globalThis.jspdf.jsPDF) : reject(new Error('PDF library unavailable. Please try again.'));
      script.onerror = () => { script.remove(); reject(new Error('Could not load PDF downloads. Please check your connection and try again.')); };
      document.head.append(script);
    }).catch(error => { libraryPromise = null; throw error; });
  }
  return libraryPromise;
}
export function filenameFor(records) {
  const reference = records.length === 1 ? records[0].result?.booking?.reference || `seat-${typeof records[0].seat === 'number' ? records[0].seat : records[0].seat.code}-${records[0].id.slice(0,8)}` : `${records.length}-passengers`;
  return `Lazarus-${records.every(r => r.result?.booking?.reference) ? 'booking' : 'preview'}-${String(reference).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80)}.pdf`;
}
function drawQr(doc, record, y) {
  const qr = qrcode(0, 'M');
  qr.addData(ticketPayload(record.id, record.result?.booking?.reference));
  qr.make();
  const modules = qr.getModuleCount();
  const scale = 34 / (modules + 8);
  doc.setFillColor(255, 255, 255);
  doc.rect(23, y, 34, 34, 'F');
  doc.setFillColor(0, 0, 0);
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.isDark(row, col)) doc.rect(23 + (col + 4) * scale, y + (row + 4) * scale, scale, scale, 'F');
    }
  }
}
function drawText(doc, text, x, y, width, size = 11, bold = false) {
  text = String(text);
  doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
  if (/[^\x20-\x7e\xa0-\xff]/.test(text)) {
    // Preserve all passenger scripts using browser fonts without transmitting
    // personal details to a font service or relying on PDF's limited core fonts.
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width*6);
    const context = canvas.getContext('2d'); const pxSize = size*2.1;
    context.font = `${bold ? 'bold ' : ''}${pxSize}px Arial, sans-serif`;
    const lines = [''];
    for (const letter of text) {
      const last = lines.length-1;
      if (context.measureText(lines[last]+letter).width > canvas.width-8) lines.push(letter); else lines[last]+=letter;
    }
    canvas.height = Math.ceil(lines.length * pxSize*1.4 + 8);
    context.fillStyle='white'; context.fillRect(0,0,canvas.width,canvas.height); context.fillStyle='#17352d'; context.font=`${bold ? 'bold ' : ''}${pxSize}px Arial, sans-serif`;
    lines.forEach((line,i)=>context.fillText(line,0,(i+1)*pxSize*1.4-5));
    const height = canvas.height/6;
    doc.addImage(canvas,'PNG',x,y-size*.35,width,height,undefined,'FAST');
    return height;
  }
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines,x,y);
  return lines.length*size*.42;
}
function drawRoute(doc, trip, logo) {
  const { origin, destination } = ticketRoute(trip);
  doc.setFillColor(22, 35, 27);
  doc.rect(0, 0, 80, 38, 'F');
  doc.setDrawColor(149, 119, 67);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(5, 18, 34, 18);
  doc.line(46, 18, 75, 18);
  doc.setLineDashPattern([], 0);
  doc.setFillColor(203, 164, 81);
  doc.circle(5, 18, 1, 'F');
  doc.circle(75, 18, 1, 'F');
  doc.addImage(logo, 'PNG', 35, 13, 10, 10, 'route-logo', 'FAST');

  const endpoint = (stop, x, align) => {
    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    const city = doc.splitTextToSize(stop.city, 33).slice(0, 2);
    doc.text(city, x, 28, { align });
    doc.setTextColor(232, 190, 112);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    if (stop.country) doc.text(stop.country.toUpperCase(), x, 36, { align });
  };
  endpoint(origin, 5, 'left');
  endpoint(destination, 75, 'right');
}
function drawTicket(doc, record, trip, contact, index, total, logo) {
  const reference = record.result?.booking?.reference;
  const schedule = ticketSchedule(trip);
  // 80 mm thermal-ticket width. Content determines height so long passenger
  // names and references stay on the same compact ticket as their QR code.
  drawRoute(doc, trip, logo);
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('LAZARUS LUXURY COACHES',5,8);
  doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.text(`${index+1}/${total}`,75,8,{align:'right'});
  doc.setTextColor(119,83,34);
  let y=44;
  y+=drawText(doc,reference ? 'PASSENGER BOOKING RECORD' : 'PREVIEW - NOT VALID FOR BOARDING',5,y,70,6.5,true)+5;
  doc.setTextColor(23,53,45);
  const passengerName=`${record.passenger.firstName} ${record.passenger.lastName}`;
  y+=drawText(doc,passengerName,5,y,70,10,true)+3;
  const rule=()=>{doc.setDrawColor(190,201,187);doc.setLineDashPattern([1,1],0);doc.line(5,y,75,y);doc.setLineDashPattern([],0);};
  rule();y+=6;
  const field=(label,value,x,rowY,width=33)=>{
    doc.setTextColor(99,112,105);doc.setFont('helvetica','normal');doc.setFontSize(6);doc.text(label.toUpperCase(),x,rowY);
    doc.setTextColor(23,53,45);return drawText(doc,value,x,rowY+4,width,8)+4;
  };
  const pair=(a,b)=>{y+=Math.max(field(...a,5,y),field(...b,42,y))+5;};
  pair(['Travel date',schedule.date],['Seat',String(typeof record.seat==='number'?record.seat:record.seat.code)]);
  pair(['Check-in',`${schedule.checkIn}${schedule.checkInDate && schedule.checkInDate !== schedule.date ? ` (${schedule.checkInDate})` : ''}`],['Departure',schedule.departure]);
  y+=field('Check-in location',ticketRoute(trip).origin.boardingPoint || 'Confirm with the booking provider',5,y,70)+5;
  const passengerIndex=record.passengerIndex ?? index;
  pair(['Primary contact',contact.phone],['Passenger',passengerIndex===0?'Primary passenger':`Passenger ${passengerIndex+1}`]);
  y+=field(reference?'Booking reference':'Preview reference',reference||record.id.slice(0,8),5,y,70)+4;
  if(record.passenger.idNumber)y+=field('Passport / ID',`****${record.passenger.idNumber.slice(-4)}`,5,y,70)+4;
  y+=drawText(doc,`Local times: ${schedule.timeZone}`,5,y,70,6)+3;
  rule();y+=3;
  y+=drawText(doc,reference ? 'CHECK-IN LOOKUP QR' : 'SAMPLE CHECK-IN QR',5,y+2,70,7,true)+4;
  drawQr(doc, record, y); y+=39;
  y+=drawText(doc,schedule.preview?'Daily schedule for planning. Confirm departure with our team.':`Check in ${schedule.minutes===null?'before departure':`${schedule.minutes} minutes before departure`}.`,5,y,70,6.5)+4;
  doc.setTextColor(119,83,34);
  y+=drawText(doc,reference?'BOOKING RECORD - Payment confirmation and a provider-issued boarding ticket are required.':'PREVIEW ONLY - Not a confirmed ticket. No seat has been reserved.',5,y,70,6.5,true)+5;
  return Math.ceil(y);
}
export const TICKET_WIDTH_MM = 80;
export async function createTicketPdf(records, trip, contact) {
  if (!records.length) throw new Error('No passenger tickets to download.');
  const [jsPDF, logo] = await Promise.all([
    loadPdfLibrary(),
    fetch('/assets/logo.png').then(async response => {
      if (!response.ok) throw new Error('Could not load the ticket logo. Please try again.');
      return new Uint8Array(await response.arrayBuffer());
    }),
  ]);
  const measure = new jsPDF({orientation:'portrait',unit:'mm',format:[TICKET_WIDTH_MM,500],compress:true});
  const heights=records.map((record,i)=>drawTicket(measure,record,trip,contact,i,records.length,logo));
  const doc = new jsPDF({ orientation:'portrait',unit:'mm',format:[TICKET_WIDTH_MM,heights[0]],compress:true });
  doc.setProperties({ title:'Lazarus passenger ticket records', subject:'Passenger journey and seat details', creator:'Lazarus Luxury Coaches' });
  for(let i=0;i<records.length;i++) { if(i) doc.addPage([TICKET_WIDTH_MM,heights[i]],'portrait'); drawTicket(doc,records[i],trip,contact,i,records.length,logo); }
  return doc;
}
export async function downloadTickets(records,trip,contact) {
  const pdf=await createTicketPdf(records,trip,contact);
  pdf.save(filenameFor(records));
}

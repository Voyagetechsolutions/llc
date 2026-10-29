import qrcode from './assets/vendor/qrcode/qrcode.mjs';
import { ticketPayload } from './booking-core.js';
import { ticketSchedule } from './booking-schedule.js';
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
function qrCanvas(record) {
  const qr = qrcode(0, 'M'); qr.addData(ticketPayload(record.id, record.result?.booking?.reference)); qr.make();
  const modules = qr.getModuleCount(), scale = 8, margin = 4;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = (modules + margin*2)*scale;
  const context = canvas.getContext('2d'); context.fillStyle = 'white'; context.fillRect(0,0,canvas.width,canvas.height); context.fillStyle = 'black';
  for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(qr.isDark(row,col))context.fillRect((col+margin)*scale,(row+margin)*scale,scale,scale);
  return canvas;
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
function drawTicket(doc, record, trip, contact, index, total) {
  const reference = record.result?.booking?.reference;
  const schedule = ticketSchedule(trip);
  doc.setFillColor(23,53,45); doc.rect(0,0,210,32,'F'); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.text('LAZARUS LUXURY COACHES',18,17);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text('YOUR JOURNEY. OUR COMMITMENT.',18,24);doc.text(`${index+1} / ${total}`,178,24);
  doc.setTextColor(119,83,34); doc.setFontSize(10); doc.text(reference ? 'PASSENGER BOOKING RECORD' : 'TICKET PREVIEW - NOT VALID FOR BOARDING',18,44);
  doc.setTextColor(23,53,45);
  const passengerName=`${record.passenger.firstName} ${record.passenger.lastName}`;
  const nameHeight=drawText(doc,passengerName,18,57,174,passengerName.length>120?13:passengerName.length>80?16:20,true);
  let y = 64 + Math.max(0,nameHeight-8);
  doc.setDrawColor(210,218,207); doc.line(18,y,192,y);
  const field=(label,value,x,rowY,width=78)=>{
    doc.setTextColor(99,112,105);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(label.toUpperCase(),x,rowY);
    doc.setTextColor(23,53,45);return drawText(doc,value,x,rowY+7,width,11);
  };
  y+=13;
  const route = trip.preview ? trip.route.replace('→','to') : `${trip.route.origin} to ${trip.route.destination}`;
  y+=Math.max(18,field('Route',route,18,y,174)+10);
  field('Travel date',schedule.date,18,y);field('Seat',String(typeof record.seat==='number'?record.seat:record.seat.code),112,y);y+=22;
  field('Check-in time',`${schedule.checkIn}${schedule.checkInDate && schedule.checkInDate !== schedule.date ? ` (${schedule.checkInDate})` : ''}`,18,y);
  field('Departure time',schedule.departure,112,y);y+=22;
  field('Times shown in',schedule.timeZone,18,y);field(reference?'Booking reference':'Preview reference',reference||record.id.slice(0,8),112,y);y+=22;
  const passengerIndex=record.passengerIndex ?? index;
  field('Primary contact',contact.phone,18,y);field('Passenger',passengerIndex===0?'Primary passenger':`Passenger ${passengerIndex+1}`,112,y);y+=22;
  if(record.passenger.idNumber){field('Passport / ID',`****${record.passenger.idNumber.slice(-4)}`,18,y);y+=20;}
  // Long names can increase the page height; keep the QR and status together.
  const qrY=Math.max(192,y);
  if(qrY>214) { doc.addPage(); y=22; } else y=qrY;
  doc.addImage(qrCanvas(record),'PNG',18,y,46,46,undefined,'FAST');
  drawText(doc,reference?'QR identifies this booking record. Payment and boarding eligibility must be confirmed by the booking provider.':'Preview QR only. No reservation or payment has been confirmed.',76,y+9,116,10);
  drawText(doc,schedule.preview?'Daily schedule shown for planning; confirm the selected departure with our team.':`Please be at check-in ${schedule.minutes===null?'before departure':`${schedule.minutes} minutes before departure`}.`,76,y+31,116,10);
  doc.setDrawColor(210,218,207);doc.line(18,270,192,270);doc.setTextColor(119,83,34);
  drawText(doc,reference?'BOOKING RECORD - Payment confirmation and a provider-issued boarding ticket are required.':'PREVIEW ONLY - Not a confirmed ticket. No seat has been reserved.',18,278,174,9,true);
}
export async function createTicketPdf(records, trip, contact) {
  if (!records.length) throw new Error('No passenger tickets to download.');
  const jsPDF = await loadPdfLibrary();
  const doc = new jsPDF({ orientation:'portrait',unit:'mm',format:'a4',compress:true });
  doc.setProperties({ title:'Lazarus passenger ticket records', subject:'Passenger journey and seat details', creator:'Lazarus Luxury Coaches' });
  for(let i=0;i<records.length;i++) { if(i) doc.addPage(); drawTicket(doc,records[i],trip,contact,i,records.length); }
  return doc;
}
export async function downloadTickets(records,trip,contact) {
  const pdf=await createTicketPdf(records,trip,contact);
  pdf.save(filenameFor(records));
}

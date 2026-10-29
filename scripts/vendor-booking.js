import { copyFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
for (const folder of ['qrcode','jspdf']) await mkdir(new URL(`public/assets/vendor/${folder}/`,root),{recursive:true});
for (const [source,target] of [
  ['node_modules/qrcode-generator/dist/qrcode.mjs','public/assets/vendor/qrcode/qrcode.mjs'],
  ['node_modules/jspdf/dist/jspdf.umd.min.js','public/assets/vendor/jspdf/jspdf.umd.min.js'],
  ['node_modules/jspdf/LICENSE','public/assets/vendor/jspdf/LICENSE'],
]) await copyFile(new URL(source,root),new URL(target,root));
console.log('Local QR and PDF browser libraries updated. QR license retained.');

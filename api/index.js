// Vercel entrypoint. Static files in public/ are served straight from the CDN;
// only /api/* (the VTTS connection config) reaches this function.
export { default } from "../server.js";

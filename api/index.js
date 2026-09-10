// Vercel entrypoint. Vercel's filesystem check runs before rewrites, so the
// static site in public/ is served straight from the CDN and only the paths
// that need Express (the /api/* endpoints) reach this function.
export { default } from "../server.js";

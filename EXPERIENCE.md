# Lazarus cinematic experience

## Implemented

The existing Express / static HTML / CSS / vanilla JavaScript architecture is retained. The presentation is in `public/experience.css` and `public/experience.js`; booking remains in `public/script.js`. No booking API payloads, server configuration, authentication or payment integration were replaced. A discovered expired-hold timer issue was fixed so an already-expired hold cannot schedule another countdown.

Homepage: real fleet portrait → pinned daylight film on desktop → night driving → fleet photography selector → real cabin film → route and fares → existing booking flow → contact. Mobile uses normal document scrolling, portrait footage and a fixed booking link. Fleet choices are photographs, not separate identified bus records or 360-degree views.

Video only loads when a scene enters view. Offscreen and background-tab video pauses. Reduced-motion and Save-Data visitors receive posters and explicit playback controls. User pause is respected when re-entering a scene. No WebGL or Three.js code loads in the current asset configuration. Video requires no WebGL.

Guide fares remain from the original project when VTTS is unavailable. Once a catalog loads, published trip data updates route summaries and marketing fare labels. Mixed currencies are not compared numerically. The booking catalog remains the source for actual checkout prices and departure times.

## Asset inventory and identity limits

All five videos are portrait 720×1280 H.264 at 30fps. Original sources are preserved.

| Source | Length | Evidence | Use |
| --- | --- | --- | --- |
| AQNamO… | 22.45s | Parked coaches, front/three-quarter/side, brief rear, entrance and cabin | Cabin excerpt approximately 17.7–22.2s; fleet references |
| AQMQhj… | 21.41s | Night driving, front three-quarter and side | Arrival excerpt 0–9s |
| AQOeAt… | 14.02s | Daytime turn, front three-quarter and close side | Exterior excerpt approximately 3–13s |
| fleet-video.mp4 | 21.87s | Street turn and approach with obstructions | Retained original, not loaded on new homepage |
| hero.mp4 | 13.93s | Front/side moving footage and promotional flyer | Retained original, not loaded on new homepage |

The existing depot portrait, paired photograph and flag composition are converted to WebP. The original LLC logo is retained. Generated contact sheets are in `discovery/`.

At least two physical coaches appear together in photographs. Do not equate photo selection with individual bus selection: registration/fleet-number matching is still required. Exact chassis, body variant, dimensions and per-coach amenities have not been independently established. No new specifications or amenities were invented.

Optimized MP4 sizes: arrival approximately 0.998MB, exterior 1.555MB, cabin 0.584MB. Hero WebP approximately 80KB. All videos omit source audio and use faststart metadata. These are real footage excerpts, not reconstructed 3D.

## True 3D: infrastructure implemented, final asset required

`public/experience/model-viewer.js` provides an optional Three.js GLB viewer with camera orbit, keyboard rotation/zoom, adaptive pixel ratio, studio environment lighting, render-on-change behavior, resource disposal and photo fallback on load/context failure. It has been syntax checked; visual correctness against a production bus GLB is unverified because no such asset was supplied.

To enable after geometry/livery approval:

1. Place an accurate, licensed, self-contained GLB under `public/assets/experience/`.
2. In `fleet.json`, add the local model URL and change `model.status` to `verified` only after approval. Set optional `rotationY` in radians if needed.
3. Confirm orientation, geometry, livery, texture quality and bounds against references. Test rendering, touch, keyboard, context loss and memory with that actual file.
4. The 3D entry button will appear and the model will load only on request.

The initial loader accepts standard GLB textures/geometry. Draco, KTX2 and Meshopt assets require their corresponding decoder configuration before use. Do not label such assets ready without testing.

The vendored Three.js files and MIT license are committed for static/Vercel hosting. Run `npm run assets:vendor` after updating the installed Three.js package. The import map resolves local dependencies; no external runtime CDN is used for the viewer.

Potential modeling reference: https://sketchfab.com/3d-models/3d-scanned-irizar-i6s-3-axle-rhd-free-9274a9b7a0b445dbb1c2bedf5d93ad6b . Creator lists CC Attribution and describes geometry defects. It is not downloaded or used as a final model. Official configuration references: https://world.irizar.com/en/autobuses-y-autocares/autocares/irizar-i6-s/ . Manufacturer dimensions must be matched to the actual coach.

For accurate modeling obtain each coach's identity, confirmed dimensions, straight front/rear/both-side photos, all four three-quarter views, roof/mirror/light/wheel details, uninterrupted daylight walkaround and original livery artwork. Current social footage is insufficient for photogrammetry or continuous 360-degree frame rotation.

## Verification

Run `npm test` for mocked integration checks of catalog → seat availability → hold → booking/payment link, conflict recovery, hold expiry, idempotent retry, unsafe checkout URL rejection and offline/empty-catalog fallback. Additional presentation checks cover reduced motion, Save-Data, lazy video, respecting manual pause, fleet state, catalog arriving before the experience module, local assets and unique IDs.

Tests use synthetic data only and do not create real bookings. Browser checks cover desktop/mobile presentation, navigation, fleet selection and configured-offline booking fallback. Local VTTS credentials are absent; real provider checkout, payment callbacks and ticket issuance remain unverified. No deployment has been performed.

## Run and deploy

`npm install`, `npm run assets:vendor`, `npm test`, `npm start`. Open http://localhost:8765 . Existing Vercel deployment configuration is retained. Configure `VTTS_API_URL` and `VTTS_CHANNEL_KEY` on the intended host and allowlist its origin in VTTS before verifying real booking. Preserve the local legacy database: the current server does not read it.


## Cinematic hero update

The hero contains the full supplied “From the moment you book to the moment you arrive…” film (about 25.9 seconds), crossfaded over 0.5 seconds into the depot entrance-and-cabin edit (source 8.3–22.3 seconds). Total runtime is approximately 39.4 seconds. Entrance begins at 31.59 seconds and the final cabin at 34.89 seconds; the original LLC logo appears only after the film ends. This replaces the earlier short excerpts of the latest upload.

The hero uses full-bleed `object-fit: cover` with exterior, entrance and cabin focal points. The widescreen composition fills the viewport without side bars; the portrait source is cropped to the available aspect ratio. Announcement and navigation backgrounds are transparent over the hero; the navigation becomes solid over the remaining page for readability. All playback, reduced-motion, data-saving and booking behavior is preserved.

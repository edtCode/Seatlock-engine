# SeatLock
React + JavaScript + Vite + Tailwind CSS frontend. All 13 requested routes are client routed. This is a demo with device-local bookings, profiles, holds and simulated payments; no actual authentication, payment processing, or cross-user ownership guarantee is provided.

## Run
Use Node 22.13+ and the pinned pnpm version in package.json. Run `pnpm install`, `pnpm dev`; use `pnpm build` for production static output in dist.

## REST integration
Set VITE_API_URL at build time to select HTTP mode in src/api.js. The adapter uses credentials: include and an Idempotency-Key header for writes. Implement GET /events, GET /shows/:id/seats, POST /holds ({showId,seats}), DELETE /holds/:id, POST /payments ({holdId,contact}), GET /bookings and DELETE /bookings/:id. Responses match the mock objects in src/api.js. Auth/profile and the event detail catalog remain local demonstration surfaces and must be connected to production services separately.

The server must authenticate callers, validate prices and seat states, create atomic expiring holds, enforce a unique booking constraint, reconcile payment webhooks, and authorize access to bookings/admin. Never trust displayed prices, timers, local storage, or client claims of seat ownership. An external payment provider should collect real payment details.

Frontend demo flow: /events → /events/blue-hour → /seats/blue-hour → /checkout → /payment → /booking-success → /bookings/:id. Seats A / B–C / D–F are VIP / Premium / Regular. Pick up to six seats. A hold expires after five minutes. A declined demo payment is retryable and payment requests use the hold ID for idempotency. QR tickets encode a demo identifier, not an admission credential.

## Downloaded ZIP — quick start on Windows, macOS, or Linux
1. Extract SeatLock.zip.
2. Install Node.js 22.13 or newer.
3. Open a terminal in the extracted SeatLock folder.
4. Run `npm install`.
5. Run `npm run dev` and open the address printed in the terminal.
6. To make a production bundle, run `npm run build`; preview it with `npm run preview`.

The source also includes the pinned pnpm lockfile if you prefer `pnpm install --frozen-lockfile`.
Never open index.html by double-clicking; use the development server.

## Reference redesign
The landing page follows the supplied reference's seat-map hero, editorial sections, compact booking-flow cards, event catalog, horizontal QR ticket, and engineering strip. All 13 routes remain available. The artwork is original AI-generated imagery featuring fictional subjects. Event names remain fictional demo examples rather than reproducing commercial posters.

Main files: src/ReferenceHome.jsx (landing page and artwork), src/main.jsx (routes and booking UI), src/api.js (mock/REST adapter), src/reference.css (reference layout), src/style.css (shared UI), public/images/events-editorial.png (original artwork).
The hero countdown previews the timer; the actual reservation starts only after Proceed to Checkout. The source includes no real payment processing, backend authentication, or multi-user lock server.

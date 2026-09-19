# SeatLock Backend

A production-style, high-concurrency event & seat reservation backend.
Plain JavaScript (no TypeScript), Express, raw parameterized SQL via `pg`
(no ORM), PostgreSQL (Supabase-compatible), Redis, BullMQ, JWT, Zod, Pino.

## Quick start (Docker)

```bash
cp .env.example .env   # edit secrets if you like; docker-compose provides its own dev defaults
docker compose up --build
```

This starts Postgres, Redis, runs migrations + seed data, then the API (port 4000) and a worker process.

Seeded accounts:
- Admin: `admin@seatlock.dev` / `Admin@12345`
- User: `user@seatlock.dev` / `User@12345`

Docs: `http://localhost:4000/api/docs`
Health: `http://localhost:4000/health`, `http://localhost:4000/ready`

## Quick start (local Node + Supabase)

```bash
npm install
cp .env.example .env
# Set DATABASE_URL to your Supabase connection string (pooled "Transaction"
# mode on port 6543 is fine - our transactions are single-request/short-lived).
# Set REDIS_URL to a local or hosted Redis instance.
npm run migrate
npm run seed        # optional sample data
npm run dev          # API on PORT (default 4000)
npm run worker:dev    # in a second terminal: BullMQ workers
```

## Tests

```bash
# Requires a running Postgres + Redis reachable via DATABASE_URL / REDIS_URL
# (point at a disposable test database - tests TRUNCATE all tables between runs).
NODE_ENV=test npm test
npm run test:concurrency   # just the 100-concurrent-reservation race test
```

## Architecture

Modular monolith: `routes -> middleware -> controllers -> services -> repositories -> PostgreSQL`,
with Redis + BullMQ + a payment provider abstraction sitting alongside services.

- **PostgreSQL** is the permanent, authoritative source of truth (users, events, seats,
  reservations, bookings, payments, tickets, audit logs).
- **Redis** is temporary coordination only: seat locks, rate limiting, caching, BullMQ.
  If Redis disappears, no permanent state is lost - the system remains correct
  (see Invariant 7 below), only slightly slower/less protected against a
  simultaneous burst until Redis comes back.

## The core algorithm: reserving a seat

`POST /api/v1/reservations` (see `src/services/reservation.service.js`):

1. Validate event is `PUBLISHED`.
2. Acquire a Redis lock per requested seat, atomically, via a Lua script
   (`SET key val NX EX ttl` semantics) - all-or-nothing. If any seat is
   already locked, every lock acquired so far in this call is released
   before returning `SEAT_ALREADY_HELD` (no partial locks left behind).
3. Open a PostgreSQL transaction, `SELECT ... FOR UPDATE` the requested
   `event_seats` rows, verify they're all `AVAILABLE`.
4. Insert `reservations` + `reservation_items`, mark seats `HELD`, commit.
5. Schedule a delayed BullMQ job (`reservation-expiration`) for `expires_at`.

Redis locks are released via a Lua script that only deletes a key if its
value still matches the caller's reservation ID - this is what stops a
late/duplicate release call from one reservation from destroying a
*different* reservation's lock acquired after the first one expired.

## Documented invariants

1. **One event seat can have at most one confirmed booking.** Enforced by
   `SELECT ... FOR UPDATE` row locks in Postgres before any seat status
   transition, plus the `event_seats.status` state machine
   (`AVAILABLE -> HELD -> BOOKED`).
2. **An expired reservation cannot become confirmed.** Both the expiration
   worker and booking confirmation lock the `reservations` row
   (`SELECT ... FOR UPDATE`) before checking `status`. Whichever transaction
   locks the row first and finds it `ACTIVE` wins the transition; the other
   sees a terminal status and backs off. If payment succeeds just after
   expiry wins the race, the payment service queues an automatic refund
   instead of confirming a dead reservation.
3. **A payment webhook can only be processed once.** `webhook_events` has a
   unique `(provider, event_id)` constraint; processing atomically claims
   the row via `INSERT ... ON CONFLICT DO NOTHING` before doing any work.
4. **A repeated idempotency key produces one logical operation.**
   `idempotency_keys` has a unique `(user_id, key)` constraint; the first
   request to reserve the key processes the operation and stores the
   response, later requests with the same key+payload get the cached
   response, and a different payload under the same key is rejected.
5. **A ticket can only be consumed once.** `SELECT ... FOR UPDATE` on the
   `tickets` row serializes concurrent scans; the loser sees `USED`.
6. **A user cannot access another user's private booking/reservation.**
   Enforced in the service layer on every read/write, independent of role
   checks (admins bypass this by design).
7. **Redis failure must not create duplicate bookings.** PostgreSQL's
   `SELECT ... FOR UPDATE` inside the reservation transaction is the actual
   correctness boundary; Redis locks are a fast-path optimization to reject
   obviously-conflicting requests before touching Postgres, not the source
   of truth.

## Project layout

See `src/` for the full modular monolith: `config`, `controllers`, `services`,
`repositories`, `routes`, `middleware`, `validators`, `queues`, `workers`,
`redis/scripts` (Lua), `providers/{payment,notification}`, `docs` (OpenAPI),
plus `database/{migrations,seeds,scripts}` and `tests/{unit,integration,api,concurrency}`.

## Notes on Supabase

- Use the pooled connection string (port 6543, "Transaction" mode) for the
  `api`/`worker` processes - fine here since every transaction is opened and
  committed within a single request/job, never held open across requests.
- Set `DATABASE_SSL=true` when using Supabase's hosted Postgres.
- Migrations (`npm run migrate`) work against Supabase like any Postgres
  instance; run them against the **direct** connection (port 5432) if your
  plan restricts DDL over the pooler.

# SeatLock

Production-style backend for a high-concurrency event and seat reservation platform. The core engineering problem is preventing **double booking and race conditions** when many users try to reserve the same seat at the same time. Covers the full booking lifecycle — auth, venues, events, per-event seat inventory, temporary seat holds, expiring reservations, idempotent payments, webhooks, bookings, QR tickets, notifications, and audit logging — with a concurrency test suite that proves the guarantees instead of just claiming them.

## Tech Stack

- Node.js + Express.js (plain JavaScript, no TypeScript)
- PostgreSQL (Supabase) — authoritative state, raw parameterized SQL via `pg` (no ORM)
- Redis — seat locks, rate limiting, caching
- BullMQ — delayed jobs and background workers
- JWT + bcrypt — access/refresh tokens with rotation, password hashing
- Zod — request validation (body, params, query, headers)
- Pino — structured logging with request IDs
- Swagger/OpenAPI — API docs
- Jest + Supertest — unit, integration, API and concurrency tests
- Docker + Docker Compose — API, worker, Postgres, Redis

## Architecture

Modular monolith. Modules are kept separate so they can be extracted later, but this is not a microservices setup.

```text
Client → Routes → Middleware → Controllers → Services → Repositories → PostgreSQL
                                   Services ├── Redis
                                            ├── BullMQ
                                            ├── Payment Provider
                                            └── Notification Provider
```

| Layer | Responsibility |
|---|---|
| Routes | Define endpoints only |
| Middleware | Auth, authorization, validation, rate limiting, request ID, errors |
| Controllers | Request/response handling, no business logic |
| Services | Business logic |
| Repositories | All SQL lives here |
| Workers | Asynchronous jobs |

## Why Redis *and* PostgreSQL?

- **PostgreSQL** is the source of truth for permanent business state: users, events, seats, reservations, bookings, payments, audit logs.
- **Redis** handles fast, temporary coordination: seat locks, rate limits, caching, queues.
- The system must stay correct even if Redis data disappears. Redis reduces contention; PostgreSQL row locks and constraints are what actually guarantee correctness.

## How It Works

1. User registers/logs in and receives an access token and a rotating refresh token (only the hash is stored).
2. User browses events and the per-event seat map (`event_seats`, since availability is event-specific).
3. `POST /api/v1/reservations` with `eventId`, `seatIds`, and an `Idempotency-Key` header.
4. The backend acquires a Redis lock per seat (`SET key reservationId NX EX 300`). If any lock fails, all acquired locks are released and the request is rejected with `SEAT_ALREADY_HELD`.
5. Inside a PostgreSQL transaction, the seats are selected `FOR UPDATE`, verified `AVAILABLE`, the reservation and items are created, and seats are marked `HELD`.
6. A delayed BullMQ job (`reservation-expiration`) is queued for the 5-minute expiry.
7. The user pays. The payment provider's **webhook** (signature-verified, deduplicated by event ID) is the authoritative confirmation — never the frontend.
8. In one transaction, the reservation is locked and checked `ACTIVE` and unexpired, a booking is created, seats go `HELD → BOOKED`, and the reservation goes `ACTIVE → CONFIRMED`.
9. Redis locks are released, a notification is queued, and a QR ticket is issued.

### Reservation Request

```json
{
  "eventId": 10,
  "seatIds": [101, 102, 103]
}
```

Header: `Idempotency-Key: unique-client-generated-key`

### Reservation Response

```json
{
  "reservationId": "res_123",
  "status": "ACTIVE",
  "expiresAt": "2026-10-25T14:35:00Z",
  "seats": [101, 102, 103],
  "totalAmount": 1050
}
```

The total is always calculated server-side from `event_seats.price`. The client never sends a price.

## Critical Invariants

1. One event seat can have at most one confirmed booking.
2. An expired reservation cannot become confirmed (`EXPIRED → CONFIRMED` is impossible).
3. A payment webhook is processed only once.
4. A repeated idempotency key produces exactly one logical operation.
5. A ticket can only be consumed once.
6. A user cannot access another user's private booking.
7. Redis failure must not create duplicate bookings.

## Concurrency Guarantees

| Scenario | Mechanism | Result |
|---|---|---|
| 100 users, same seat | Redis `NX` lock + `SELECT ... FOR UPDATE` | 1 succeeds, 99 rejected |
| Expiration worker vs. payment confirmation | Reservation row lock, single state transition | Only one of `ACTIVE → EXPIRED` / `ACTIVE → CONFIRMED` wins |
| Same webhook × 5 | Unique `(provider, event_id)` | Processed once |
| Two staff scan the same ticket | `SELECT ... FOR UPDATE`, `VALID → USED` | Second gets `TICKET_ALREADY_USED` |
| Double-click / retry | `Idempotency-Key` + request hash | Stored response returned |

Redis locks are released via a Lua script that checks the lock value matches the reservation ID before deleting, so one user's expired lock can never delete another user's new lock. The expiration worker is safe to run more than once.

## Schema

- **users** — id, name, email (unique), password_hash, role (`USER`/`ADMIN`), status (`ACTIVE`/`DISABLED`), timestamps
- **refresh_tokens** — id, user_id (FK), token_hash, expires_at, revoked_at
- **venues** — id, name, description, address, city, timestamps
- **venue_seats** — id, venue_id (FK), row_label, seat_number, seat_type (`REGULAR`/`PREMIUM`/`VIP`/`ACCESSIBLE`); unique per venue/row/number
- **events** — id, venue_id (FK), title, description, category, start_time, end_time, status (`DRAFT`/`PUBLISHED`/`CANCELLED`/`COMPLETED`)
- **event_seats** — id, event_id, venue_seat_id, price, status (`AVAILABLE`/`HELD`/`BOOKED`/`DISABLED`); unique per event/venue seat
- **reservations** — id, user_id, event_id, status (`ACTIVE`/`EXPIRED`/`CONFIRMED`/`CANCELLED`), expires_at, total_amount
- **reservation_items** — id, reservation_id, event_seat_id, price
- **bookings** — id, user_id, event_id, reservation_id, booking_reference (e.g. `SLK-A82F91`), status (`CONFIRMED`/`CANCELLED`/`REFUNDED`), total_amount
- **booking_items** — id, booking_id, event_seat_id, price
- **payments** — id, booking_id, provider, provider_payment_id, amount, currency, status (`PENDING`/`SUCCESS`/`FAILED`/`REFUNDED`)
- **idempotency_keys** — id, user_id, key, request_hash, response_status, response_body, expires_at; unique per user/key
- **webhook_events** — id, provider, event_id, event_type, payload, processed, processed_at; unique per provider/event
- **audit_logs** — id, user_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at
- **notifications** — id, user_id, type, title, message, status (`PENDING`/`SENT`/`FAILED`), metadata, sent_at

## Endpoints

All routes are under `/api/v1`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | No | Rotate refresh token |
| POST | `/auth/logout` | Yes | Revoke refresh token |
| GET | `/auth/me` | Yes | Current user |
| POST | `/auth/forgot-password` | No | Request reset link |
| POST | `/auth/reset-password` | No | Reset via token |
| GET | `/events` | No | List/search events (category, city, date, price, pagination, sorting) |
| GET | `/events/:eventId` | No | Event details |
| GET | `/events/:eventId/seats` | No | Live seat availability |
| POST/PATCH/DELETE | `/events`, `/events/:eventId` | Admin | Manage events |
| GET/POST/PATCH/DELETE | `/venues`, `/venues/:venueId` | Admin | Manage venues |
| POST/PATCH/DELETE | `/venues/:venueId/seats[/:seatId]` | Admin | Manage venue seats |
| POST | `/reservations` | Yes | Hold seats (requires `Idempotency-Key`) |
| POST | `/payments` | Yes | Create payment (requires `Idempotency-Key`) |
| GET | `/payments/:paymentId` | Yes | Payment status |
| POST | `/webhooks/payment` | Signature | Payment provider webhook |
| GET | `/bookings` | Yes | Own bookings |
| GET | `/bookings/:bookingId` | Yes | Own booking details |
| POST | `/bookings/:bookingId/cancel` | Yes | Cancel own booking |
| GET | `/tickets/:ticketId` | Yes | Ticket details |
| POST | `/tickets/verify` | Admin/staff | Scan ticket (`VALID → USED`) |
| GET | `/admin/dashboard` | Admin | Metrics (date-filterable) |
| GET | `/admin/events`, `/admin/venues`, `/admin/users`, `/admin/bookings`, `/admin/audit-logs` | Admin | Admin management |
| PATCH | `/admin/users/:id/status`, `/admin/users/:id/role` | Admin | Manage users |
| GET | `/health` | No | Process is up |
| GET | `/ready` | No | PostgreSQL and Redis checks |

Interactive docs at `/api/docs` (Swagger UI).

Collection endpoints use `?page=1&limit=20` and return:

```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 120, "totalPages": 6 }
}
```

Errors use a standard shape with a stable code:

```json
{
  "success": false,
  "error": {
    "code": "SEAT_ALREADY_HELD",
    "message": "One or more selected seats are unavailable"
  }
}
```

## CURL Examples

```bash
# Register
curl -X POST localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "email": "test@test.com", "password": "StrongPass123!"}'

# Login (save the tokens)
curl -X POST localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "StrongPass123!"}'

# Browse seats for an event
curl localhost:3000/api/v1/events/10/seats

# Reserve seats
curl -X POST localhost:3000/api/v1/reservations \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Idempotency-Key: 6f1c2a1e-demo-key-001" \
  -H "Content-Type: application/json" \
  -d '{"eventId": 10, "seatIds": [101, 102, 103]}'

# List own bookings
curl localhost:3000/api/v1/bookings \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Security

Helmet, CORS, Redis-backed rate limiting (login 5/min, reservations 20/min, payments 10/min, public 100/min), Zod validation on every input, parameterized SQL only, refresh token rotation with hashed storage, bcrypt password hashing, webhook signature verification, and request size limits. The backend never trusts the client for price, payment status, booking ownership, seat availability, or role. Logs never contain passwords, JWTs, refresh tokens, or payment secrets.

## Background Jobs

BullMQ queues: `reservation-expiration`, `notification`, `email`, `payment`, `analytics`. Workers run in a separate process from the API. Email delivery never blocks the booking transaction.

## Project Structure

The repo has two independent apps (not a monorepo tooling setup): a Node.js API and a React client.

```text
seatlock/
├── backend/     # Express API, workers, migrations
├── frontend/    # React + Vite client
└── README.md
```

### Backend

```text
backend/
├── src/
│   ├── config/         # env, database, redis, logger
│   ├── controllers/
│   ├── services/
│   ├── repositories/   # all SQL
│   ├── routes/
│   ├── middleware/
│   ├── validators/     # Zod schemas
│   ├── queues/
│   ├── workers/
│   ├── redis/scripts/  # acquire/release seat lock (Lua)
│   ├── providers/      # payment (mock, then Razorpay/Stripe), notification
│   ├── utils/
│   ├── docs/
│   ├── app.js
│   └── server.js
├── database/           # migrations, seeds
├── tests/              # unit, integration, api, concurrency
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

### Frontend

```text
frontend/
├── public/
├── src/
│   ├── api/                # Axios client + one module per resource
│   │   ├── client.js       # centralized Axios instance (VITE_API_URL)
│   │   ├── auth.api.js
│   │   ├── events.api.js
│   │   ├── seats.api.js
│   │   ├── reservations.api.js
│   │   ├── bookings.api.js
│   │   ├── payments.api.js
│   │   └── admin.api.js
│   │
│   ├── components/
│   │   ├── ui/             # Button, Input, Select, Modal, Dialog, Dropdown, Badge,
│   │   │                   # Card, Table, Pagination, Tabs, Toast, Skeleton, Spinner,
│   │   │                   # EmptyState, ErrorState, ConfirmDialog
│   │   ├── layout/         # Navbar, MobileDrawer, Footer
│   │   ├── event/          # EventCard, EventFilters, EventDetails
│   │   ├── seat/           # SeatMap, Seat, SeatLegend, SeatTooltip,
│   │   │                   # SelectionSummary, ReservationCountdown
│   │   ├── booking/        # BookingCard, DigitalTicket
│   │   ├── payment/        # PaymentStatus, MockPaymentPanel
│   │   └── admin/          # StatCard, charts, VenueBuilder, admin tables
│   │
│   ├── pages/
│   │   ├── auth/           # Login, Register, ForgotPassword, ResetPassword
│   │   ├── user/           # Home, Events, EventDetails, SeatSelection, Checkout,
│   │   │                   # PaymentSuccess, PaymentFailed, Bookings, BookingDetails, Profile
│   │   └── admin/          # Dashboard, Events, CreateEvent, Venues, VenueBuilder,
│   │                       # Bookings, Users, AuditLogs
│   │
│   ├── layouts/            # PublicLayout, UserLayout, AdminLayout
│   ├── hooks/              # useEvents(), useSeats(), useReservation(), useBookings(), ...
│   ├── stores/             # Zustand: selected seats, small UI state
│   ├── routes/             # route config, protected/admin route guards
│   ├── mock/               # users, events, venues, seats, reservations, bookings, payments, stats
│   ├── utils/
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

Data flow: `UI → hook (e.g. useEvents) → *.api.js → mock API or Node.js API`. Swapping the mock layer for the real backend only touches `src/api/`, not the components.

## Frontend

React client for browsing events, picking seats, holding them with a countdown, paying, and getting a digital ticket. It ships with mock data and a mock payment flow, so the whole experience runs without the backend.

### Frontend Tech Stack

- React + Vite (JavaScript, no TypeScript)
- Tailwind CSS — styling
- React Router — routing
- TanStack Query — server state (events, seats, reservations, bookings, admin stats)
- Zustand — local state (selected seats, small UI state); no Redux
- Axios — centralized API client
- React Hook Form + Zod — forms and validation
- Recharts — admin dashboard charts
- Lucide React — icons

### Main User Flow

```text
Home → Events → Event Details → Seat Selection → Reservation (countdown)
     → Checkout → Payment → Booking Confirmation → Digital Ticket
```

Seat states: `AVAILABLE`, `SELECTED`, `HELD_BY_YOU`, `HELD_BY_OTHER`, `BOOKED`, `DISABLED`. The countdown is display-only; the backend's `expiresAt` is the source of truth.

### Routes

| Area | Routes |
|---|---|
| Public | `/`, `/events`, `/events/:eventId`, `/events/:eventId/seats`, `/login`, `/register`, `/forgot-password`, `/reset-password` |
| User | `/checkout/:reservationId`, `/payment/success`, `/payment/failed`, `/bookings`, `/bookings/:bookingId`, `/profile` |
| Admin | `/admin`, `/admin/events`, `/admin/events/new`, `/admin/events/:eventId`, `/admin/venues`, `/admin/venues/new`, `/admin/venues/:venueId`, `/admin/bookings`, `/admin/users`, `/admin/audit-logs` |

## Setup

```bash
git clone <your-repo-url>
cd seatlock/backend
npm install
```

### Environment

```bash
cp .env.example .env
# fill in:
# NODE_ENV, PORT
# DATABASE_URL            (Supabase Postgres connection string)
# REDIS_URL
# JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
# ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN
# RESERVATION_TTL_SECONDS
# PAYMENT_PROVIDER, PAYMENT_SECRET, PAYMENT_WEBHOOK_SECRET
# CORS_ORIGIN
```

### Run

```bash
# with Docker (api, worker, postgres, redis)
docker compose up

# or locally, in two terminals
npm run dev        # API
npm run worker     # BullMQ workers
```

### Frontend Setup

```bash
cd seatlock/frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:3000/api/v1

npm run dev
```

The frontend runs on mock data by default; point `VITE_API_URL` at the backend once the real API layer is switched on.

## Testing

```bash
npm test
```

```text
tests/
├── unit/          # auth, reservation, booking, payment
├── integration/   # reservation, booking, payment
├── api/           # auth, events, reservations, bookings, payments
└── concurrency/   # reservation-race, ticket-race
```

The flagship test fires **100 concurrent `POST /reservations`** at the same seat, then asserts exactly 1 success, 99 rejections, and a single held/confirmed owner in PostgreSQL. Failure tests cover Redis down, Postgres down, payment provider timeout, duplicate webhooks, expired reservations, duplicate requests, worker retries, and concurrent ticket scans.

## Load Testing

Load tests (k6 or similar) target `GET /events`, `GET /events/:id/seats`, and `POST /reservations` at 100, 500, and 1000 concurrent users. Results (requests/sec, p50, p95, p99, error rate) are recorded from real runs.

| Users | Req/s | p50 | p95 | p99 | Error rate |
|---|---|---|---|---|---|
| 100 | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 500 | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 1000 | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Roadmap

Foundation → database → auth → events/venues → PostgreSQL-only reservation → Redis locks → expiration jobs → idempotency → payments → bookings → webhooks → tickets → notifications → admin → tests → Socket.IO live seat updates (optional; the API stays correct without it) → production hardening (Nginx, GitHub Actions, deployment).
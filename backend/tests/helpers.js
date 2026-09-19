process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'mock';

const request = require('supertest');
const bcrypt = require('bcrypt');
const { pool, query } = require('../src/config/database');
const { redis } = require('../src/config/redis');

let app;
function getApp() {
  if (!app) app = require('../src/app');
  return app;
}

async function resetDatabase() {
  // Truncate all business tables between tests, keep schema.
  await query(`
    TRUNCATE TABLE
      audit_logs, notifications, webhook_events, idempotency_keys,
      tickets, payments, booking_items, bookings,
      reservation_items, reservations, event_seats, events,
      venue_seats, venues, password_reset_tokens, refresh_tokens, users
    RESTART IDENTITY CASCADE
  `);
}

async function flushRedis() {
  await redis.flushdb();
}

async function createUser({ email = `user${Date.now()}${Math.random()}@test.com`, role = 'USER' } = {}) {
  const passwordHash = await bcrypt.hash('Test@12345', 4);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING *`,
    ['Test User', email, passwordHash, role]
  );
  return rows[0];
}

const { signAccessToken } = require('../src/utils/tokens');

function tokenFor(user) {
  return signAccessToken(user);
}

async function createVenueWithSeats(seatCount = 10) {
  const { rows: venueRows } = await query(
    `INSERT INTO venues (name, city) VALUES ('Test Venue', 'Test City') RETURNING *`
  );
  const venue = venueRows[0];
  const seats = [];
  for (let i = 1; i <= seatCount; i++) {
    const { rows } = await query(
      `INSERT INTO venue_seats (venue_id, row_label, seat_number, seat_type) VALUES ($1, 'A', $2, 'REGULAR') RETURNING *`,
      [venue.id, i]
    );
    seats.push(rows[0]);
  }
  return { venue, seats };
}

async function createPublishedEvent(venueId, price = 50) {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const { rows } = await query(
    `INSERT INTO events (venue_id, title, category, start_time, end_time, status)
     VALUES ($1, 'Test Event', 'Test', $2, $3, 'PUBLISHED') RETURNING *`,
    [venueId, start.toISOString(), end.toISOString()]
  );
  return rows[0];
}

async function createEventSeats(eventId, venueSeats, price = 50) {
  const created = [];
  for (const vs of venueSeats) {
    const { rows } = await query(
      `INSERT INTO event_seats (event_id, venue_seat_id, price, status) VALUES ($1, $2, $3, 'AVAILABLE') RETURNING *`,
      [eventId, vs.id, price]
    );
    created.push(rows[0]);
  }
  return created;
}

async function closeAll() {
  await pool.end().catch(() => {});
  await redis.quit().catch(() => {});
}

module.exports = {
  getApp,
  request,
  resetDatabase,
  flushRedis,
  createUser,
  tokenFor,
  createVenueWithSeats,
  createPublishedEvent,
  createEventSeats,
  closeAll,
  query,
};

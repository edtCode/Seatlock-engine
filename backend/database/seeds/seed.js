#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  console.warn('bcrypt failed to load, falling back to bcryptjs');
  bcrypt = require('bcryptjs');
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Admin user
    const adminPasswordHash = await bcrypt.hash('Admin@12345', 10);
    const adminResult = await client.query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Admin User', 'admin@seatlock.dev', $1, 'ADMIN', 'ACTIVE')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [adminPasswordHash]
    );
    const adminId = adminResult.rows[0].id;

    // Regular demo user
    const userPasswordHash = await bcrypt.hash('User@12345', 10);
    await client.query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Demo User', 'user@seatlock.dev', $1, 'USER', 'ACTIVE')
       ON CONFLICT (email) DO NOTHING`,
      [userPasswordHash]
    );

    // Venue
    const venueResult = await client.query(
      `INSERT INTO venues (name, description, address, city)
       VALUES ('Grand Arena', 'A 5000-seat multipurpose arena', '1 Arena Way', 'Metropolis')
       RETURNING id`
    );
    const venueId = venueResult.rows[0].id;

    // Venue seats: 5 rows (A-E) x 10 seats
    const rows = ['A', 'B', 'C', 'D', 'E'];
    const venueSeatIds = [];
    for (const row of rows) {
      for (let num = 1; num <= 10; num++) {
        const seatType = row === 'A' ? 'VIP' : row === 'B' ? 'PREMIUM' : 'REGULAR';
        const res = await client.query(
          `INSERT INTO venue_seats (venue_id, row_label, seat_number, seat_type)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (venue_id, row_label, seat_number) DO UPDATE SET seat_type = EXCLUDED.seat_type
           RETURNING id, seat_type`,
          [venueId, row, num, seatType]
        );
        venueSeatIds.push(res.rows[0]);
      }
    }

    // Event
    const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const eventResult = await client.query(
      `INSERT INTO events (venue_id, title, description, category, start_time, end_time, status)
       VALUES ($1, 'Launch Night Live', 'Opening night concert', 'Concert', $2, $3, 'PUBLISHED')
       RETURNING id`,
      [venueId, start.toISOString(), end.toISOString()]
    );
    const eventId = eventResult.rows[0].id;

    // Event seats with pricing by type
    const priceByType = { VIP: 250, PREMIUM: 120, REGULAR: 60 };
    for (const seat of venueSeatIds) {
      await client.query(
        `INSERT INTO event_seats (event_id, venue_seat_id, price, status)
         VALUES ($1, $2, $3, 'AVAILABLE')
         ON CONFLICT (event_id, venue_seat_id) DO NOTHING`,
        [eventId, seat.id, priceByType[seat.seat_type]]
      );
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
    console.log(`Admin login: admin@seatlock.dev / Admin@12345`);
    console.log(`User login:  user@seatlock.dev / User@12345`);
    console.log(`Event ID: ${eventId}, Venue ID: ${venueId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

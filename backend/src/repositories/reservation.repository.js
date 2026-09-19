const { query } = require('../config/database');

async function createReservation(client, { userId, eventId, expiresAt, totalAmount, status = 'ACTIVE' }) {
  const { rows } = await client.query(
    `INSERT INTO reservations (user_id, event_id, status, expires_at, total_amount)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, eventId, status, expiresAt, totalAmount]
  );
  return rows[0];
}

async function createReservationItems(client, reservationId, items) {
  const created = [];
  for (const item of items) {
    const { rows } = await client.query(
      `INSERT INTO reservation_items (reservation_id, event_seat_id, price)
       VALUES ($1, $2, $3) RETURNING *`,
      [reservationId, item.eventSeatId, item.price]
    );
    created.push(rows[0]);
  }
  return created;
}

async function findById(id) {
  const { rows } = await query(`SELECT * FROM reservations WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Lock a single reservation row for update within a transaction.
 * Used by both the expiration worker and booking confirmation flow to
 * ensure only one of them can win the ACTIVE -> {EXPIRED|CONFIRMED} race.
 */
async function lockForUpdate(client, id) {
  const { rows } = await client.query(`SELECT * FROM reservations WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0] || null;
}

async function updateStatus(client, id, status) {
  const { rows } = await client.query(
    `UPDATE reservations SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return rows[0] || null;
}

async function getItems(reservationId) {
  const { rows } = await query(
    `SELECT ri.*, es.event_id, vs.row_label, vs.seat_number, vs.seat_type
     FROM reservation_items ri
     JOIN event_seats es ON es.id = ri.event_seat_id
     JOIN venue_seats vs ON vs.id = es.venue_seat_id
     WHERE ri.reservation_id = $1`,
    [reservationId]
  );
  return rows;
}

async function getItemSeatIds(client, reservationId) {
  const { rows } = await client.query(
    `SELECT event_seat_id FROM reservation_items WHERE reservation_id = $1`,
    [reservationId]
  );
  return rows.map((r) => r.event_seat_id);
}

async function findByUser(userId, { limit, offset, status }) {
  const conditions = ['user_id = $1'];
  const params = [userId];
  let idx = 2;
  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const { rows } = await query(
    `SELECT * FROM reservations ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS count FROM reservations ${where}`, params);
  return { data: rows, total: countRows[0].count };
}

/**
 * Find all ACTIVE reservations whose expires_at has passed.
 * Used defensively by a sweep job in case a BullMQ job was lost.
 */
async function findExpiredActive(limit = 100) {
  const { rows } = await query(
    `SELECT id FROM reservations WHERE status = 'ACTIVE' AND expires_at < now() LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = {
  createReservation,
  createReservationItems,
  findById,
  lockForUpdate,
  updateStatus,
  getItems,
  getItemSeatIds,
  findByUser,
  findExpiredActive,
};

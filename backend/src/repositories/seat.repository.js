const { query } = require('../config/database');

async function createEventSeat({ eventId, venueSeatId, price, status = 'AVAILABLE' }) {
  const { rows } = await query(
    `INSERT INTO event_seats (event_id, venue_seat_id, price, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id, venue_seat_id) DO NOTHING
     RETURNING *`,
    [eventId, venueSeatId, price, status]
  );
  return rows[0] || null;
}

async function listByEvent(eventId) {
  const { rows } = await query(
    `SELECT es.id, es.event_id, es.price, es.status,
            vs.row_label, vs.seat_number, vs.seat_type
     FROM event_seats es
     JOIN venue_seats vs ON vs.id = es.venue_seat_id
     WHERE es.event_id = $1
     ORDER BY vs.row_label, vs.seat_number`,
    [eventId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await query(`SELECT * FROM event_seats WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Core concurrency-critical query (PRD section 36).
 * Must be called within a transaction (client from withTransaction).
 * Locks the requested rows so concurrent reservation attempts on the
 * same seats serialize instead of racing.
 */
async function lockSeatsForUpdate(client, eventId, seatIds) {
  const { rows } = await client.query(
    `SELECT * FROM event_seats
     WHERE event_id = $1 AND id = ANY($2::bigint[])
     FOR UPDATE`,
    [eventId, seatIds]
  );
  return rows;
}

async function markSeatsStatus(client, seatIds, status) {
  await client.query(`UPDATE event_seats SET status = $2, updated_at = now() WHERE id = ANY($1::bigint[])`, [
    seatIds,
    status,
  ]);
}

async function updateSeatAdmin(seatId, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findById(seatId);
  const setClauses = keys.map((key, idx) => `${key} = $${idx + 2}`);
  const values = keys.map((key) => fields[key]);
  const { rows } = await query(
    `UPDATE event_seats SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [seatId, ...values]
  );
  return rows[0] || null;
}

module.exports = {
  createEventSeat,
  listByEvent,
  findById,
  lockSeatsForUpdate,
  markSeatsStatus,
  updateSeatAdmin,
};

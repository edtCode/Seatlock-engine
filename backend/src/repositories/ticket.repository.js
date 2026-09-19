const { query } = require('../config/database');

async function create(client, { ticketRef, bookingId, bookingItemId }) {
  const { rows } = await client.query(
    `INSERT INTO tickets (ticket_ref, booking_id, booking_item_id, status)
     VALUES ($1, $2, $3, 'VALID') RETURNING *`,
    [ticketRef, bookingId, bookingItemId]
  );
  return rows[0];
}

async function findByRef(ticketRef) {
  const { rows } = await query(`SELECT * FROM tickets WHERE ticket_ref = $1`, [ticketRef]);
  return rows[0] || null;
}

async function listByBooking(bookingId) {
  const { rows } = await query(`SELECT * FROM tickets WHERE booking_id = $1`, [bookingId]);
  return rows;
}

/**
 * Lock the ticket row for update, then transition VALID -> USED.
 * Must be called inside a transaction. Concurrent scans on the same
 * ticket serialize on this row lock; the second one to run sees the
 * already-USED status and the service layer rejects it.
 */
async function lockForUpdate(client, ticketRef) {
  const { rows } = await client.query(`SELECT * FROM tickets WHERE ticket_ref = $1 FOR UPDATE`, [ticketRef]);
  return rows[0] || null;
}

async function markUsed(client, id, usedByUserId) {
  const { rows } = await client.query(
    `UPDATE tickets SET status = 'USED', used_at = now(), used_by = $2 WHERE id = $1 RETURNING *`,
    [id, usedByUserId]
  );
  return rows[0] || null;
}

async function markCancelled(client, bookingId) {
  await client.query(`UPDATE tickets SET status = 'CANCELLED' WHERE booking_id = $1 AND status = 'VALID'`, [
    bookingId,
  ]);
}

module.exports = { create, findByRef, listByBooking, lockForUpdate, markUsed, markCancelled };

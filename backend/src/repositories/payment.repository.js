const { query } = require('../config/database');

async function create({ bookingId, reservationId, userId, provider, providerPaymentId, amount, currency = 'USD', status = 'PENDING' }) {
  const { rows } = await query(
    `INSERT INTO payments (booking_id, reservation_id, user_id, provider, provider_payment_id, amount, currency, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [bookingId, reservationId, userId, provider, providerPaymentId, amount, currency, status]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(`SELECT * FROM payments WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findByProviderPaymentId(providerPaymentId) {
  const { rows } = await query(`SELECT * FROM payments WHERE provider_payment_id = $1`, [providerPaymentId]);
  return rows[0] || null;
}

async function findByReservationId(reservationId) {
  const { rows } = await query(
    `SELECT * FROM payments WHERE reservation_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [reservationId]
  );
  return rows[0] || null;
}

async function updateStatus(id, status, extra = {}) {
  const fields = { status, ...extra };
  const keys = Object.keys(fields);
  const setClauses = keys.map((key, idx) => `${key} = $${idx + 2}`);
  const values = keys.map((key) => fields[key]);
  const { rows } = await query(
    `UPDATE payments SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0] || null;
}

async function attachBooking(id, bookingId) {
  const { rows } = await query(
    `UPDATE payments SET booking_id = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, bookingId]
  );
  return rows[0] || null;
}

module.exports = { create, findById, findByProviderPaymentId, findByReservationId, updateStatus, attachBooking };

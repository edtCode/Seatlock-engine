const { query } = require('../config/database');

async function createBooking(client, { userId, eventId, reservationId, bookingReference, totalAmount, status = 'CONFIRMED' }) {
  const { rows } = await client.query(
    `INSERT INTO bookings (user_id, event_id, reservation_id, booking_reference, status, total_amount)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, eventId, reservationId, bookingReference, status, totalAmount]
  );
  return rows[0];
}

async function createBookingItems(client, bookingId, items) {
  const created = [];
  for (const item of items) {
    const { rows } = await client.query(
      `INSERT INTO booking_items (booking_id, event_seat_id, price)
       VALUES ($1, $2, $3) RETURNING *`,
      [bookingId, item.eventSeatId, item.price]
    );
    created.push(rows[0]);
  }
  return created;
}

async function findById(id) {
  const { rows } = await query(`SELECT * FROM bookings WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function lockForUpdate(client, id) {
  const { rows } = await client.query(`SELECT * FROM bookings WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0] || null;
}

async function updateStatus(client, id, status) {
  const { rows } = await client.query(
    `UPDATE bookings SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return rows[0] || null;
}

async function getItems(bookingId) {
  const { rows } = await query(
    `SELECT bi.*, es.event_id, vs.row_label, vs.seat_number, vs.seat_type
     FROM booking_items bi
     JOIN event_seats es ON es.id = bi.event_seat_id
     JOIN venue_seats vs ON vs.id = es.venue_seat_id
     WHERE bi.booking_id = $1`,
    [bookingId]
  );
  return rows;
}

async function getItemsTx(client, bookingId) {
  const { rows } = await client.query(`SELECT * FROM booking_items WHERE booking_id = $1`, [bookingId]);
  return rows;
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
    `SELECT * FROM bookings ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS count FROM bookings ${where}`, params);
  return { data: rows, total: countRows[0].count };
}

async function adminList({ limit, offset, status, eventId, userId, dateFrom, dateTo }) {
  const conditions = [];
  const params = [];
  let idx = 1;
  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (eventId) {
    conditions.push(`event_id = $${idx++}`);
    params.push(eventId);
  }
  if (userId) {
    conditions.push(`user_id = $${idx++}`);
    params.push(userId);
  }
  if (dateFrom) {
    conditions.push(`created_at >= $${idx++}`);
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`created_at <= $${idx++}`);
    params.push(dateTo);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT * FROM bookings ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS count FROM bookings ${where}`, params);
  return { data: rows, total: countRows[0].count };
}

async function dashboardCounts() {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM events) AS total_events,
      (SELECT COUNT(*)::int FROM bookings WHERE status = 'CONFIRMED') AS total_bookings,
      (SELECT COUNT(*)::int FROM bookings WHERE status = 'CONFIRMED' AND created_at >= date_trunc('day', now())) AS today_bookings,
      (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE status = 'CONFIRMED') AS total_revenue,
      (SELECT COUNT(*)::int FROM reservations WHERE status = 'ACTIVE') AS active_reservations,
      (SELECT COUNT(*)::int FROM reservations WHERE status = 'EXPIRED') AS expired_reservations,
      (SELECT COUNT(*)::int FROM bookings WHERE status = 'CANCELLED') AS cancelled_bookings,
      (SELECT COUNT(*)::int FROM event_seats WHERE status = 'BOOKED') AS booked_seats,
      (SELECT COUNT(*)::int FROM event_seats) AS total_seats
  `);
  return rows[0];
}

module.exports = {
  createBooking,
  createBookingItems,
  findById,
  lockForUpdate,
  updateStatus,
  getItems,
  getItemsTx,
  findByUser,
  adminList,
  dashboardCounts,
};

const { query } = require('../config/database');

async function create({ name, description, address, city }) {
  const { rows } = await query(
    `INSERT INTO venues (name, description, address, city)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, description, address, city]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(`SELECT * FROM venues WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function list({ limit, offset }) {
  const { rows } = await query(
    `SELECT * FROM venues ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await query('SELECT COUNT(*)::int AS count FROM venues');
  return { data: rows, total: countRows[0].count };
}

async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findById(id);
  const setClauses = keys.map((key, idx) => `${key} = $${idx + 2}`);
  const values = keys.map((key) => fields[key]);
  const { rows } = await query(
    `UPDATE venues SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0] || null;
}

async function remove(id) {
  await query(`DELETE FROM venues WHERE id = $1`, [id]);
}

// --- venue_seats ---

async function createSeat({ venueId, rowLabel, seatNumber, seatType }) {
  const { rows } = await query(
    `INSERT INTO venue_seats (venue_id, row_label, seat_number, seat_type)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [venueId, rowLabel, seatNumber, seatType]
  );
  return rows[0];
}

async function bulkCreateSeats(venueId, seats) {
  const created = [];
  for (const seat of seats) {
    const { rows } = await query(
      `INSERT INTO venue_seats (venue_id, row_label, seat_number, seat_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (venue_id, row_label, seat_number) DO NOTHING
       RETURNING *`,
      [venueId, seat.rowLabel, seat.seatNumber, seat.seatType || 'REGULAR']
    );
    if (rows[0]) created.push(rows[0]);
  }
  return created;
}

async function findSeatById(seatId) {
  const { rows } = await query(`SELECT * FROM venue_seats WHERE id = $1`, [seatId]);
  return rows[0] || null;
}

async function listSeatsByVenue(venueId) {
  const { rows } = await query(
    `SELECT * FROM venue_seats WHERE venue_id = $1 ORDER BY row_label, seat_number`,
    [venueId]
  );
  return rows;
}

async function updateSeat(seatId, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findSeatById(seatId);
  const setClauses = keys.map((key, idx) => `${key} = $${idx + 2}`);
  const values = keys.map((key) => fields[key]);
  const { rows } = await query(
    `UPDATE venue_seats SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    [seatId, ...values]
  );
  return rows[0] || null;
}

async function removeSeat(seatId) {
  await query(`DELETE FROM venue_seats WHERE id = $1`, [seatId]);
}

module.exports = {
  create,
  findById,
  list,
  update,
  remove,
  createSeat,
  bulkCreateSeats,
  findSeatById,
  listSeatsByVenue,
  updateSeat,
  removeSeat,
};

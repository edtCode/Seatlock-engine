const { query } = require('../config/database');

async function create({ userId, type, title, message, metadata, status = 'PENDING' }) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, message, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, type, title, message, status, metadata ? JSON.stringify(metadata) : null]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(`SELECT * FROM notifications WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function markSent(id) {
  const { rows } = await query(
    `UPDATE notifications SET status = 'SENT', sent_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function markFailed(id) {
  const { rows } = await query(`UPDATE notifications SET status = 'FAILED' WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
}

module.exports = { create, findById, markSent, markFailed };

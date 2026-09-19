const { query } = require('../config/database');

async function create({ name, email, passwordHash, role = 'USER' }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, $4, 'ACTIVE')
     RETURNING id, name, email, role, status, created_at, updated_at`,
    [name, email, passwordHash, role]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(
    `SELECT id, name, email, password_hash, role, status, created_at, updated_at
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const { rows } = await query(
    `SELECT id, name, email, password_hash, role, status, created_at, updated_at
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function updateStatus(id, status) {
  const { rows } = await query(
    `UPDATE users SET status = $2, updated_at = now() WHERE id = $1
     RETURNING id, name, email, role, status`,
    [id, status]
  );
  return rows[0] || null;
}

async function updateRole(id, role) {
  const { rows } = await query(
    `UPDATE users SET role = $2, updated_at = now() WHERE id = $1
     RETURNING id, name, email, role, status`,
    [id, role]
  );
  return rows[0] || null;
}

async function updatePassword(id, passwordHash) {
  await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [id, passwordHash]);
}

async function list({ limit, offset }) {
  const { rows } = await query(
    `SELECT id, name, email, role, status, created_at
     FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await query('SELECT COUNT(*)::int AS count FROM users');
  return { data: rows, total: countRows[0].count };
}

function toPublicUser(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

module.exports = {
  create,
  findById,
  findByEmail,
  updateStatus,
  updateRole,
  updatePassword,
  list,
  toPublicUser,
};

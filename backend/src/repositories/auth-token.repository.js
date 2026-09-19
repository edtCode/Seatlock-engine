const { query } = require('../config/database');

// --- Refresh tokens ---

async function createRefreshToken({ userId, tokenHash, expiresAt }) {
  const { rows } = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3) RETURNING id`,
    [userId, tokenHash, expiresAt]
  );
  return rows[0];
}

async function findRefreshTokenByHash(tokenHash) {
  const { rows } = await query(`SELECT * FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
  return rows[0] || null;
}

async function revokeRefreshToken(id) {
  await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [id]);
}

async function revokeAllForUser(userId) {
  await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}

// --- Password reset tokens ---

async function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
  const { rows } = await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3) RETURNING id`,
    [userId, tokenHash, expiresAt]
  );
  return rows[0];
}

async function findPasswordResetTokenByHash(tokenHash) {
  const { rows } = await query(`SELECT * FROM password_reset_tokens WHERE token_hash = $1`, [tokenHash]);
  return rows[0] || null;
}

async function markPasswordResetTokenUsed(id) {
  await query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [id]);
}

module.exports = {
  createRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
  revokeAllForUser,
  createPasswordResetToken,
  findPasswordResetTokenByHash,
  markPasswordResetTokenUsed,
};

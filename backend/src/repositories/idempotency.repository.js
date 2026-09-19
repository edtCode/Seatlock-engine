const { query } = require('../config/database');

async function find(userId, key) {
  const { rows } = await query(
    `SELECT * FROM idempotency_keys WHERE user_id = $1 AND key = $2 AND expires_at > now()`,
    [userId, key]
  );
  return rows[0] || null;
}

/**
 * Attempts to reserve an idempotency key row before processing begins.
 * Uses ON CONFLICT DO NOTHING so concurrent duplicate requests with the
 * same key race safely at the DB level - only one wins the insert.
 * Returns the inserted row, or null if the key already existed.
 */
async function tryReserve({ userId, key, requestHash, ttlSeconds = 24 * 60 * 60 }) {
  const { rows } = await query(
    `INSERT INTO idempotency_keys (user_id, key, request_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' seconds')::interval)
     ON CONFLICT (user_id, key) DO NOTHING
     RETURNING *`,
    [userId, key, requestHash, ttlSeconds]
  );
  return rows[0] || null;
}

async function storeResponse(id, { responseStatus, responseBody }) {
  await query(
    `UPDATE idempotency_keys SET response_status = $2, response_body = $3 WHERE id = $1`,
    [id, responseStatus, JSON.stringify(responseBody)]
  );
}

module.exports = { find, tryReserve, storeResponse };

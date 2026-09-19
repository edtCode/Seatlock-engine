const { query } = require('../config/database');

/**
 * Atomically claim a webhook event for processing. Uses ON CONFLICT DO
 * NOTHING keyed on (provider, event_id) so a duplicate delivery (the
 * provider retries, or the same event arrives twice) is a no-op here -
 * only the first insert wins and gets processed.
 */
async function tryClaim({ provider, eventId, eventType, payload }) {
  const { rows } = await query(
    `INSERT INTO webhook_events (provider, event_id, event_type, payload, processed)
     VALUES ($1, $2, $3, $4, false)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING *`,
    [provider, eventId, eventType, JSON.stringify(payload)]
  );
  return rows[0] || null;
}

async function findByProviderEventId(provider, eventId) {
  const { rows } = await query(`SELECT * FROM webhook_events WHERE provider = $1 AND event_id = $2`, [
    provider,
    eventId,
  ]);
  return rows[0] || null;
}

async function markProcessed(id) {
  await query(`UPDATE webhook_events SET processed = true, processed_at = now() WHERE id = $1`, [id]);
}

module.exports = { tryClaim, findByProviderEventId, markProcessed };

const { query } = require('../config/database');

async function record({ userId, action, resourceType, resourceId, metadata, ipAddress, userAgent }) {
  await query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId || null, action, resourceType || null, resourceId ? String(resourceId) : null, metadata ? JSON.stringify(metadata) : null, ipAddress || null, userAgent || null]
  );
}

async function list({ limit, offset, action, userId, resourceType, dateFrom, dateTo }) {
  const conditions = [];
  const params = [];
  let idx = 1;
  if (action) {
    conditions.push(`action = $${idx++}`);
    params.push(action);
  }
  if (userId) {
    conditions.push(`user_id = $${idx++}`);
    params.push(userId);
  }
  if (resourceType) {
    conditions.push(`resource_type = $${idx++}`);
    params.push(resourceType);
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
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS count FROM audit_logs ${where}`, params);
  return { data: rows, total: countRows[0].count };
}

module.exports = { record, list };

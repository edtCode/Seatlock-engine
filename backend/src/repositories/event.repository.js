const { query } = require('../config/database');

const SORTABLE_FIELDS = new Set(['start_time', 'created_at', 'title']);

async function create({ venueId, title, description, category, startTime, endTime, status = 'DRAFT' }) {
  const { rows } = await query(
    `INSERT INTO events (venue_id, title, description, category, start_time, end_time, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [venueId, title, description, category, startTime, endTime, status]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(`SELECT * FROM events WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * List events with optional filters. Public listings default to only
 * PUBLISHED events unless `includeAllStatuses` is set (used by admin).
 */
async function search({
  q,
  category,
  city,
  dateFrom,
  dateTo,
  minPrice,
  maxPrice,
  status,
  includeAllStatuses = false,
  sortBy = 'start_time',
  sortDir = 'asc',
  limit,
  offset,
}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (!includeAllStatuses) {
    conditions.push(`e.status = $${idx++}`);
    params.push('PUBLISHED');
  } else if (status) {
    conditions.push(`e.status = $${idx++}`);
    params.push(status);
  }

  if (q) {
    conditions.push(`(e.title ILIKE $${idx} OR e.description ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (category) {
    conditions.push(`e.category = $${idx++}`);
    params.push(category);
  }
  if (city) {
    conditions.push(`v.city ILIKE $${idx++}`);
    params.push(city);
  }
  if (dateFrom) {
    conditions.push(`e.start_time >= $${idx++}`);
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`e.start_time <= $${idx++}`);
    params.push(dateTo);
  }
  if (minPrice !== undefined) {
    conditions.push(
      `EXISTS (SELECT 1 FROM event_seats es WHERE es.event_id = e.id AND es.price >= $${idx++})`
    );
    params.push(minPrice);
  }
  if (maxPrice !== undefined) {
    conditions.push(
      `EXISTS (SELECT 1 FROM event_seats es WHERE es.event_id = e.id AND es.price <= $${idx++})`
    );
    params.push(maxPrice);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeSortBy = SORTABLE_FIELDS.has(sortBy) ? sortBy : 'start_time';
  const safeSortDir = sortDir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const dataSql = `
    SELECT e.*, v.name AS venue_name, v.city AS venue_city,
           (SELECT MIN(price) FROM event_seats WHERE event_id = e.id AND status = 'AVAILABLE') AS min_price,
           (SELECT COUNT(*)::int FROM event_seats WHERE event_id = e.id AND status = 'AVAILABLE') AS available_seats
    FROM events e
    JOIN venues v ON v.id = e.venue_id
    ${whereClause}
    ORDER BY e.${safeSortBy} ${safeSortDir}
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  const countSql = `
    SELECT COUNT(*)::int AS count
    FROM events e
    JOIN venues v ON v.id = e.venue_id
    ${whereClause}
  `;

  const dataParams = [...params, limit, offset];
  const { rows } = await query(dataSql, dataParams);
  const { rows: countRows } = await query(countSql, params);

  return { data: rows, total: countRows[0].count };
}

async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findById(id);
  const setClauses = keys.map((key, idx) => `${key} = $${idx + 2}`);
  const values = keys.map((key) => fields[key]);
  const { rows } = await query(
    `UPDATE events SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0] || null;
}

async function remove(id) {
  await query(`DELETE FROM events WHERE id = $1`, [id]);
}

async function countAll() {
  const { rows } = await query(`SELECT COUNT(*)::int AS count FROM events`);
  return rows[0].count;
}

module.exports = { create, findById, search, update, remove, countAll };

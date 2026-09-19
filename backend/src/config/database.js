const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  // Errors on idle clients in the pool should not crash the process.
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

/**
 * Run a query using the shared pool. Use for simple, single-statement reads/writes.
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 200) {
    logger.warn({ text, duration }, 'Slow query');
  }
  return result;
}

/**
 * Run a callback inside a single PostgreSQL transaction.
 * The callback receives a `client` with the same query interface as pg.Pool,
 * scoped to one connection so that BEGIN/COMMIT/ROLLBACK and row locks
 * (SELECT ... FOR UPDATE) behave correctly.
 *
 * Usage:
 *   await withTransaction(async (client) => {
 *     await client.query('...');
 *   });
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error({ err: rollbackErr }, 'Rollback failed');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function checkConnection() {
  await pool.query('SELECT 1');
  return true;
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, checkConnection, closePool };

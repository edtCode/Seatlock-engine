#!/usr/bin/env node
/**
 * Minimal, dependency-free SQL migration runner.
 *
 * Each file in database/migrations/ is named NNN_description.sql and
 * contains an "-- +migrate Up" section and an "-- +migrate Down" section.
 * Applied migrations are tracked in a schema_migrations table.
 *
 * Usage:
 *   node database/scripts/migrate.js         # apply all pending migrations
 *   node database/scripts/migrate.js down    # roll back the last migration
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function splitUpDown(sql) {
  const upMarker = '-- +migrate Up';
  const downMarker = '-- +migrate Down';
  const upIndex = sql.indexOf(upMarker);
  const downIndex = sql.indexOf(downMarker);
  if (upIndex === -1) throw new Error('Migration missing "-- +migrate Up" marker');
  const up = sql.slice(upIndex + upMarker.length, downIndex === -1 ? undefined : downIndex).trim();
  const down = downIndex === -1 ? '' : sql.slice(downIndex + downMarker.length).trim();
  return { up, down };
}

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(pool) {
  const { rows } = await pool.query('SELECT name FROM schema_migrations ORDER BY id ASC');
  return rows.map((r) => r.name);
}

function loadMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function up(pool) {
  await ensureMigrationsTable(pool);
  const applied = new Set(await getAppliedMigrations(pool));
  const files = loadMigrationFiles();
  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const { up: upSql } = splitUpDown(fs.readFileSync(fullPath, 'utf8'));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(upSql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied: ${file}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Failed to apply ${file}:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(count === 0 ? 'No pending migrations.' : `Applied ${count} migration(s).`);
}

async function down(pool) {
  await ensureMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);
  if (applied.length === 0) {
    console.log('No migrations to roll back.');
    return;
  }
  const lastFile = applied[applied.length - 1];
  const fullPath = path.join(MIGRATIONS_DIR, lastFile);
  const { down: downSql } = splitUpDown(fs.readFileSync(fullPath, 'utf8'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (downSql) await client.query(downSql);
    await client.query('DELETE FROM schema_migrations WHERE name = $1', [lastFile]);
    await client.query('COMMIT');
    console.log(`Rolled back: ${lastFile}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Failed to roll back ${lastFile}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    if (direction === 'up') await up(pool);
    else await down(pool);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

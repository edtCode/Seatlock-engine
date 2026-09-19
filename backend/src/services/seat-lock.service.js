const fs = require('fs');
const path = require('path');
const { redis } = require('../config/redis');
const env = require('../config/env');
const logger = require('../config/logger');

const acquireScript = fs.readFileSync(
  path.join(__dirname, '..', 'redis', 'scripts', 'acquire-seat-lock.lua'),
  'utf8'
);
const releaseScript = fs.readFileSync(
  path.join(__dirname, '..', 'redis', 'scripts', 'release-seat-lock.lua'),
  'utf8'
);

// Register the Lua scripts as ioredis commands: redis.acquireSeatLock(...), redis.releaseSeatLock(...)
redis.defineCommand('acquireSeatLock', { numberOfKeys: 1, lua: acquireScript });
redis.defineCommand('releaseSeatLock', { numberOfKeys: 1, lua: releaseScript });

function lockKey(eventId, seatId) {
  return `seatlock:event:${eventId}:seat:${seatId}`;
}

/**
 * Attempt to acquire locks for every seat in `seatIds`, atomically per-seat.
 * If any seat is already locked, all previously-acquired locks in this call
 * are released before returning, so no partial locks are left behind.
 *
 * Returns { acquired: true } or { acquired: false, conflictSeatId }.
 */
async function acquireSeatLocks({ eventId, seatIds, reservationId, ttlSeconds = env.RESERVATION_TTL_SECONDS }) {
  const acquiredSeatIds = [];

  for (const seatId of seatIds) {
    const key = lockKey(eventId, seatId);
    const result = await redis.acquireSeatLock(key, reservationId, ttlSeconds);

    if (result === 1) {
      acquiredSeatIds.push(seatId);
    } else {
      logger.warn({ eventId, seatId, reservationId }, 'Seat lock conflict, rolling back acquired locks');
      await releaseSeatLocks({ eventId, seatIds: acquiredSeatIds, reservationId });
      return { acquired: false, conflictSeatId: seatId };
    }
  }

  return { acquired: true };
}

/**
 * Release locks for the given seats, but only those actually owned by
 * `reservationId` (enforced atomically inside the Lua script).
 */
async function releaseSeatLocks({ eventId, seatIds, reservationId }) {
  const results = await Promise.all(
    seatIds.map((seatId) => redis.releaseSeatLock(lockKey(eventId, seatId), reservationId))
  );
  return results.every((r) => r === 1);
}

module.exports = { acquireSeatLocks, releaseSeatLocks, lockKey };

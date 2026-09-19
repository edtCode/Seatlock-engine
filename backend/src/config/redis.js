const Redis = require('ioredis');
const env = require('./env');
const logger = require('./logger');

/**
 * BullMQ requires maxRetriesPerRequest: null on the connection it uses.
 * We create separate connections for general use vs BullMQ to keep
 * concerns isolated (BullMQ manages blocking commands internally).
 */
function createClient(extra = {}) {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    ...extra,
  });

  client.on('error', (err) => {
    logger.error({ err }, 'Redis client error');
  });

  return client;
}

// General-purpose client: seat locks, rate limiting, caching.
const redis = createClient();

// Dedicated connection for BullMQ (queues + workers use their own internally,
// but we expose a factory so queues/workers can create isolated connections).
function createBullConnection() {
  return createClient();
}

async function checkConnection() {
  const pong = await redis.ping();
  return pong === 'PONG';
}

module.exports = { redis, createBullConnection, checkConnection };

const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const db = require('./config/database');
const { redis } = require('./config/redis');
const { closeAllQueues } = require('./queues');

const server = app.listen(env.PORT, () => {
  logger.info(`SeatLock API listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown');

  // 1. Stop accepting new requests.
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error while closing HTTP server');
    } else {
      logger.info('HTTP server closed (no longer accepting connections)');
    }

    try {
      // 2. Close queue producers.
      await closeAllQueues();
      logger.info('BullMQ queues closed');

      // 3. Close Redis.
      await redis.quit();
      logger.info('Redis connection closed');

      // 4. Close PostgreSQL pool.
      await db.closePool();
      logger.info('PostgreSQL pool closed');

      logger.info('Graceful shutdown complete');
      process.exit(err ? 1 : 0);
    } catch (shutdownErr) {
      logger.error({ err: shutdownErr }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });

  // Force-exit if shutdown hangs.
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 15000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  // Uncaught exceptions leave the process in an unknown state - exit after
  // logging so an orchestrator (Docker/PM2/k8s) can restart cleanly.
  process.exit(1);
});

module.exports = server;

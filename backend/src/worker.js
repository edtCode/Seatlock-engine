const logger = require('./config/logger');
const db = require('./config/database');
const { redis } = require('./config/redis');
const startAllWorkers = require('./workers');
const { closeAllQueues } = require('./queues');

logger.info('Starting SeatLock worker process');
const workers = startAllWorkers();

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Worker shutdown signal received');

  try {
    await Promise.all(workers.map((w) => w.close()));
    logger.info('All workers closed');
    await closeAllQueues();
    await redis.quit();
    await db.closePool();
    logger.info('Worker graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during worker shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled promise rejection (worker)'));
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception (worker)');
  process.exit(1);
});

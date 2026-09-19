const { Queue } = require('bullmq');
const { createBullConnection } = require('../config/redis');

const reservationQueue = new Queue('reservation-expiration', {
  connection: createBullConnection(),
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

/**
 * Schedule a delayed job that expires this reservation at expiresAt.
 * jobId is deterministic (per reservation) so scheduling is idempotent -
 * calling this twice for the same reservation will not create duplicate jobs.
 */
async function scheduleExpiration(reservationId, expiresAt) {
  const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  await reservationQueue.add(
    'expire-reservation',
    { reservationId },
    { delay, jobId: `reservation-expire-${reservationId}` }
  );
}

module.exports = { reservationQueue, scheduleExpiration };

const { Worker } = require('bullmq');
const { createBullConnection } = require('../config/redis');
const reservationService = require('../services/reservation.service');
const logger = require('../config/logger');

/**
 * Processes delayed 'expire-reservation' jobs. Safe to run more than once
 * for the same reservation (expireReservation is idempotent) - important
 * because BullMQ can redeliver a job after a crash or a stalled lock.
 */
function createReservationWorker() {
  const worker = new Worker(
    'reservation-expiration',
    async (job) => {
      const { reservationId } = job.data;
      logger.info({ reservationId, jobId: job.id }, 'Processing reservation expiration job');
      await reservationService.expireReservation(reservationId);
    },
    { connection: createBullConnection(), concurrency: 10 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Reservation expiration job failed');
  });

  return worker;
}

module.exports = createReservationWorker;

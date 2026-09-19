const { Worker } = require('bullmq');
const { createBullConnection } = require('../config/redis');
const notificationService = require('../services/notification.service');
const logger = require('../config/logger');

function createEmailWorker() {
  const worker = new Worker(
    'email',
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Processing email job');
      if (job.name === 'send-booking-confirmation') {
        await notificationService.sendBookingConfirmation(job.data);
      } else if (job.name === 'send-booking-cancellation') {
        await notificationService.sendBookingCancellation(job.data);
      } else {
        logger.warn({ name: job.name }, 'Unknown email job type');
      }
    },
    { connection: createBullConnection(), concurrency: 10 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Email job failed');
  });

  return worker;
}

module.exports = createEmailWorker;

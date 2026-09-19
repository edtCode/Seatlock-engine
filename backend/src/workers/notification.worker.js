const { Worker } = require('bullmq');
const { createBullConnection } = require('../config/redis');
const { emailQueue } = require('../queues/email.queue');
const logger = require('../config/logger');

function createNotificationWorker() {
  const worker = new Worker(
    'notification',
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Processing notification job');
      if (job.name === 'booking-confirmation') {
        await emailQueue.add('send-booking-confirmation', job.data);
      } else if (job.name === 'booking-cancellation') {
        await emailQueue.add('send-booking-cancellation', job.data);
      } else {
        logger.warn({ name: job.name }, 'Unknown notification job type');
      }
    },
    { connection: createBullConnection(), concurrency: 10 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Notification job failed');
  });

  return worker;
}

module.exports = createNotificationWorker;

const { Worker } = require('bullmq');
const { createBullConnection } = require('../config/redis');
const paymentService = require('../services/payment.service');
const logger = require('../config/logger');

function createPaymentWorker() {
  const worker = new Worker(
    'payment',
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Processing payment job');
      if (job.name === 'refund-booking') {
        await paymentService.refundBooking(job.data.bookingId);
      } else if (job.name === 'refund-payment') {
        await paymentService.refundPayment(job.data.paymentId);
      } else {
        logger.warn({ name: job.name }, 'Unknown payment job type');
      }
    },
    { connection: createBullConnection(), concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Payment job failed');
  });

  return worker;
}

module.exports = createPaymentWorker;

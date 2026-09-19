const { Queue } = require('bullmq');
const { createBullConnection } = require('../config/redis');
const { reservationQueue, scheduleExpiration } = require('./reservation.queue');
const { notificationQueue } = require('./notification.queue');
const { emailQueue } = require('./email.queue');
const { paymentQueue } = require('./payment.queue');

const analyticsQueue = new Queue('analytics', {
  connection: createBullConnection(),
  defaultJobOptions: { removeOnComplete: 500, removeOnFail: 1000, attempts: 3 },
});

async function closeAllQueues() {
  await Promise.all([
    reservationQueue.close(),
    notificationQueue.close(),
    emailQueue.close(),
    paymentQueue.close(),
    analyticsQueue.close(),
  ]);
}

module.exports = {
  reservationQueue,
  scheduleExpiration,
  notificationQueue,
  emailQueue,
  paymentQueue,
  analyticsQueue,
  closeAllQueues,
};

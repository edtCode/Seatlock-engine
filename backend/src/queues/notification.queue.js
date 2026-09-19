const { Queue } = require('bullmq');
const { createBullConnection } = require('../config/redis');

const notificationQueue = new Queue('notification', {
  connection: createBullConnection(),
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

module.exports = { notificationQueue };

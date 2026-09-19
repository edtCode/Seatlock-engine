const createReservationWorker = require('./reservation.worker');
const createNotificationWorker = require('./notification.worker');
const createEmailWorker = require('./email.worker');
const createPaymentWorker = require('./payment.worker');
const logger = require('../config/logger');

function startAllWorkers() {
  const workers = [
    createReservationWorker(),
    createNotificationWorker(),
    createEmailWorker(),
    createPaymentWorker(),
  ];
  logger.info('All BullMQ workers started');
  return workers;
}

module.exports = startAllWorkers;

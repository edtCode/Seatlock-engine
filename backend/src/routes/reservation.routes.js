const { Router } = require('express');
const controller = require('../controllers/reservation.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { reservationLimiter } = require('../middleware/rate-limit.middleware');
const {
  createReservationSchema,
  reservationIdParam,
  listReservationsSchema,
} = require('../validators/reservation.validator');

const router = Router();

router.use(authenticate);

router.post('/', reservationLimiter, validate(createReservationSchema), controller.createReservation);
router.get('/', validate(listReservationsSchema), controller.listMyReservations);
router.get('/:reservationId', validate(reservationIdParam), controller.getReservation);
router.post('/:reservationId/cancel', validate(reservationIdParam), controller.cancelReservation);

module.exports = router;

const { Router } = require('express');
const controller = require('../controllers/booking.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const authorize = require('../middleware/authorization.middleware');
const { bookingIdParam, listBookingsSchema } = require('../validators/booking.validator');

const router = Router();

router.use(authenticate);

router.get('/', validate(listBookingsSchema), controller.listMyBookings);
router.get('/:bookingId', validate(bookingIdParam), controller.getBooking);
router.post('/:bookingId/cancel', validate(bookingIdParam), controller.cancelBooking);

module.exports = router;

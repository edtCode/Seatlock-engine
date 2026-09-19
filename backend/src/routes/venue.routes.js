const { Router } = require('express');
const controller = require('../controllers/venue.controller');
const seatController = require('../controllers/seat.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const authorize = require('../middleware/authorization.middleware');
const {
  createVenueSchema,
  updateVenueSchema,
  createSeatSchema,
  bulkCreateSeatsSchema,
  updateSeatSchema,
  venueIdParam,
  venueSeatIdParams,
} = require('../validators/event.validator');
const { z } = require('zod');

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.post('/', validate(createVenueSchema), controller.createVenue);
router.get('/', controller.listVenues);
router.get('/:venueId', validate({ params: venueIdParam }), controller.getVenue);
router.patch('/:venueId', validate(updateVenueSchema), controller.updateVenue);
router.delete('/:venueId', validate({ params: venueIdParam }), controller.deleteVenue);

// Seat management
router.post('/:venueId/seats', validate(createSeatSchema), seatController.addSeat);
router.post('/:venueId/seats/bulk', validate(bulkCreateSeatsSchema), seatController.bulkAddSeats);
router.get('/:venueId/seats', validate({ params: venueIdParam }), seatController.listSeats);
router.patch('/:venueId/seats/:seatId', validate(updateSeatSchema), seatController.updateSeat);
router.delete('/:venueId/seats/:seatId', validate({ params: venueSeatIdParams }), seatController.deleteSeat);

module.exports = router;

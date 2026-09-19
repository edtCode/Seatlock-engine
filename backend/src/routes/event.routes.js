const { Router } = require('express');
const controller = require('../controllers/event.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const authorize = require('../middleware/authorization.middleware');
const { publicLimiter } = require('../middleware/rate-limit.middleware');
const {
  searchEventsSchema,
  getEventSchema,
  createEventSchema,
  updateEventSchema,
  generateEventSeatsSchema,
} = require('../validators/event.validator');

const router = Router();

// Public
router.get('/', publicLimiter, validate(searchEventsSchema), controller.listEvents);
router.get('/:eventId', publicLimiter, validate(getEventSchema), controller.getEvent);
router.get('/:eventId/seats', publicLimiter, validate(getEventSchema), controller.listEventSeats);

// Admin
router.post('/', authenticate, authorize('ADMIN'), validate(createEventSchema), controller.createEvent);
router.patch('/:eventId', authenticate, authorize('ADMIN'), validate(updateEventSchema), controller.updateEvent);
router.delete('/:eventId', authenticate, authorize('ADMIN'), validate(getEventSchema), controller.deleteEvent);
router.post(
  '/:eventId/seats/generate',
  authenticate,
  authorize('ADMIN'),
  validate(generateEventSeatsSchema),
  controller.generateEventSeats
);

module.exports = router;

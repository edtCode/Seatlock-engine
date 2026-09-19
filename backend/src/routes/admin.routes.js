const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const eventController = require('../controllers/event.controller');
const venueController = require('../controllers/venue.controller');
const bookingController = require('../controllers/booking.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const authorize = require('../middleware/authorization.middleware');
const {
  searchEventsSchema,
  getEventSchema,
  createEventSchema,
  updateEventSchema,
} = require('../validators/event.validator');
const { createVenueSchema, updateVenueSchema, venueIdParam } = require('../validators/event.validator');
const { bookingIdParam, adminListBookingsSchema } = require('../validators/booking.validator');
const {
  userIdParam,
  updateUserStatusSchema,
  updateUserRoleSchema,
  listUsersSchema,
  auditLogsSchema,
  dashboardSchema,
} = require('../validators/admin.validator');

const router = Router();

router.use(authenticate, authorize('ADMIN'));

// Dashboard
router.get('/dashboard', validate(dashboardSchema), adminController.dashboard);

// Events (admin view includes all statuses)
router.get(
  '/events',
  validate(searchEventsSchema),
  (req, res, next) => {
    req.query.includeAllStatuses = true;
    next();
  },
  eventController.listEvents
);
router.post('/events', validate(createEventSchema), eventController.createEvent);
router.patch('/events/:eventId', validate(updateEventSchema), eventController.updateEvent);
router.delete('/events/:eventId', validate(getEventSchema), eventController.deleteEvent);

// Venues
router.get('/venues', venueController.listVenues);
router.post('/venues', validate(createVenueSchema), venueController.createVenue);
router.patch('/venues/:venueId', validate(updateVenueSchema), venueController.updateVenue);
router.delete('/venues/:venueId', validate({ params: venueIdParam }), venueController.deleteVenue);

// Users
router.get('/users', validate(listUsersSchema), adminController.listUsers);
router.patch('/users/:id/status', validate(updateUserStatusSchema), adminController.updateUserStatus);
router.patch('/users/:id/role', validate(updateUserRoleSchema), adminController.updateUserRole);

// Bookings
router.get('/bookings', validate(adminListBookingsSchema), bookingController.adminListBookings);
router.get('/bookings/:bookingId', validate(bookingIdParam), bookingController.adminGetBooking);

// Audit
router.get('/audit-logs', validate(auditLogsSchema), adminController.auditLogs);

module.exports = router;

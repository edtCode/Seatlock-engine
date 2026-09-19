const { Router } = require('express');

const authRoutes = require('./auth.routes');
const eventRoutes = require('./event.routes');
const venueRoutes = require('./venue.routes');
const reservationRoutes = require('./reservation.routes');
const bookingRoutes = require('./booking.routes');
const paymentRoutes = require('./payment.routes');
const ticketRoutes = require('./ticket.routes');
const adminRoutes = require('./admin.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/venues', venueRoutes);
router.use('/reservations', reservationRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/tickets', ticketRoutes);
router.use('/admin', adminRoutes);

module.exports = router;

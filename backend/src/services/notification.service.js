const notificationRepository = require('../repositories/notification.repository');
const userRepository = require('../repositories/user.repository');
const bookingRepository = require('../repositories/booking.repository');
const eventRepository = require('../repositories/event.repository');
const venueRepository = require('../repositories/venue.repository');
const notificationProvider = require('../providers/notification/mock-notification.provider');
const logger = require('../config/logger');

/**
 * Build and send the booking confirmation email. Called by the
 * notification worker, decoupled from the booking transaction.
 */
async function sendBookingConfirmation({ userId, bookingId }) {
  const user = await userRepository.findById(userId);
  const booking = await bookingRepository.findById(bookingId);
  if (!user || !booking) {
    logger.warn({ userId, bookingId }, 'Cannot send booking confirmation: user or booking missing');
    return;
  }

  const event = await eventRepository.findById(booking.event_id);
  const venue = event ? await venueRepository.findById(event.venue_id) : null;
  const items = await bookingRepository.getItems(bookingId);

  const seatList = items.map((i) => `${i.row_label}${i.seat_number} (${i.seat_type})`).join(', ');

  const notification = await notificationRepository.create({
    userId,
    type: 'BOOKING_CONFIRMATION',
    title: `Booking Confirmed: ${event?.title || 'Your Event'}`,
    message: `Your booking ${booking.booking_reference} is confirmed.`,
    metadata: { bookingId, bookingReference: booking.booking_reference },
  });

  const body = [
    `Booking reference: ${booking.booking_reference}`,
    `Event: ${event?.title}`,
    `Date: ${event ? new Date(event.start_time).toISOString() : ''}`,
    `Venue: ${venue?.name}, ${venue?.city}`,
    `Seats: ${seatList}`,
    `Amount: ${booking.total_amount}`,
  ].join('\n');

  try {
    await notificationProvider.sendEmail({
      to: user.email,
      subject: `Your ticket for ${event?.title || 'your event'}`,
      body,
    });
    await notificationRepository.markSent(notification.id);
  } catch (err) {
    logger.error({ err, notificationId: notification.id }, 'Failed to send booking confirmation email');
    await notificationRepository.markFailed(notification.id);
    throw err;
  }
}

async function sendBookingCancellation({ userId, bookingId }) {
  const user = await userRepository.findById(userId);
  const booking = await bookingRepository.findById(bookingId);
  if (!user || !booking) return;

  const notification = await notificationRepository.create({
    userId,
    type: 'BOOKING_CANCELLATION',
    title: 'Booking Cancelled',
    message: `Your booking ${booking.booking_reference} has been cancelled.`,
    metadata: { bookingId },
  });

  try {
    await notificationProvider.sendEmail({
      to: user.email,
      subject: `Booking ${booking.booking_reference} cancelled`,
      body: `Your booking ${booking.booking_reference} has been cancelled. A refund has been initiated if applicable.`,
    });
    await notificationRepository.markSent(notification.id);
  } catch (err) {
    await notificationRepository.markFailed(notification.id);
    throw err;
  }
}

module.exports = { sendBookingConfirmation, sendBookingCancellation };

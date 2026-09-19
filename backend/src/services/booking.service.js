const { withTransaction } = require('../config/database');
const reservationRepository = require('../repositories/reservation.repository');
const bookingRepository = require('../repositories/booking.repository');
const seatRepository = require('../repositories/seat.repository');
const ticketRepository = require('../repositories/ticket.repository');
const seatLockService = require('../services/seat-lock.service');
const auditService = require('./audit.service');
const { generateBookingReference, generateTicketId } = require('../utils/booking-reference');
const { AppError } = require('../utils/errors');
const { notificationQueue } = require('../queues/notification.queue');

/**
 * Confirm a booking from a successful payment (PRD section 40).
 * Idempotent-ish: if the reservation is already CONFIRMED, returns the
 * existing booking rather than creating a duplicate (guards against a
 * webhook or worker calling this twice for the same reservation).
 */
async function confirmBookingFromReservation({ reservationId }) {
  const result = await withTransaction(async (client) => {
    const reservation = await reservationRepository.lockForUpdate(client, reservationId);
    if (!reservation) throw new AppError('RESERVATION_NOT_FOUND', 'Reservation not found');

    if (reservation.status === 'CONFIRMED') {
      // Already confirmed by a previous call - fetch and return existing booking.
      const { rows } = await client.query(`SELECT * FROM bookings WHERE reservation_id = $1 LIMIT 1`, [
        reservation.id,
      ]);
      return { alreadyConfirmed: true, booking: rows[0] || null };
    }

    if (reservation.status !== 'ACTIVE') {
      // Expired or cancelled - the expiration worker won the race, or the
      // user cancelled. Payment succeeded too late; this must be refunded
      // by the caller (payment service), never silently confirmed.
      throw new AppError('RESERVATION_EXPIRED', 'Reservation is no longer active and cannot be confirmed', {
        status: reservation.status,
      });
    }
    if (new Date(reservation.expires_at) < new Date()) {
      throw new AppError('RESERVATION_EXPIRED', 'Reservation has expired');
    }

    const seatIds = await reservationRepository.getItemSeatIds(client, reservation.id);
    const items = await client.query(
      `SELECT event_seat_id, price FROM reservation_items WHERE reservation_id = $1`,
      [reservation.id]
    );

    const bookingReference = generateBookingReference();
    const booking = await bookingRepository.createBooking(client, {
      userId: reservation.user_id,
      eventId: reservation.event_id,
      reservationId: reservation.id,
      bookingReference,
      totalAmount: reservation.total_amount,
      status: 'CONFIRMED',
    });

    const bookingItems = await bookingRepository.createBookingItems(
      client,
      booking.id,
      items.rows.map((r) => ({ eventSeatId: r.event_seat_id, price: r.price }))
    );

    await seatRepository.markSeatsStatus(client, seatIds, 'BOOKED');
    await reservationRepository.updateStatus(client, reservation.id, 'CONFIRMED');

    // Generate one QR ticket per booked seat.
    const tickets = [];
    for (const item of bookingItems) {
      const ticket = await ticketRepository.create(client, {
        ticketRef: generateTicketId(),
        bookingId: booking.id,
        bookingItemId: item.id,
      });
      tickets.push(ticket);
    }

    return { alreadyConfirmed: false, booking, seatIds, tickets };
  });

  if (result.alreadyConfirmed) {
    return result.booking;
  }

  await seatLockService.releaseSeatLocks({
    eventId: result.booking.event_id,
    seatIds: result.seatIds,
    reservationId: String(reservationId),
  });

  await auditService.log({
    userId: result.booking.user_id,
    action: 'BOOKING_CREATED',
    resourceType: 'BOOKING',
    resourceId: result.booking.id,
    metadata: { reservationId, bookingReference: result.booking.booking_reference },
  });

  // Don't block the booking transaction on email delivery.
  await notificationQueue.add('booking-confirmation', {
    userId: result.booking.user_id,
    bookingId: result.booking.id,
  });

  return result.booking;
}

async function getBooking(id, requesterUserId, requesterRole) {
  const booking = await bookingRepository.findById(id);
  if (!booking) throw new AppError('BOOKING_NOT_FOUND', 'Booking not found');
  if (requesterRole !== 'ADMIN' && String(booking.user_id) !== String(requesterUserId)) {
    throw new AppError('FORBIDDEN', 'You do not have access to this booking');
  }
  const items = await bookingRepository.getItems(id);
  const tickets = await ticketRepository.listByBooking(id);
  return { ...booking, items, tickets };
}

async function listMyBookings(userId, pagination) {
  return bookingRepository.findByUser(userId, pagination);
}

async function adminListBookings(filters) {
  return bookingRepository.adminList(filters);
}

/**
 * User cancels their own confirmed booking (PRD section 42).
 * Never allows cancelling someone else's booking.
 */
async function cancelBooking(id, requesterUserId, requesterRole) {
  const result = await withTransaction(async (client) => {
    const booking = await bookingRepository.lockForUpdate(client, id);
    if (!booking) throw new AppError('BOOKING_NOT_FOUND', 'Booking not found');
    if (requesterRole !== 'ADMIN' && String(booking.user_id) !== String(requesterUserId)) {
      throw new AppError('FORBIDDEN', 'You do not have access to this booking');
    }
    if (booking.status === 'CANCELLED') {
      throw new AppError('BOOKING_ALREADY_CANCELLED', 'Booking is already cancelled');
    }
    if (booking.status !== 'CONFIRMED') {
      throw new AppError('BOOKING_NOT_CANCELLABLE', 'Only confirmed bookings can be cancelled');
    }

    const items = await bookingRepository.getItemsTx(client, id);
    const seatIds = items.map((i) => i.event_seat_id);
    await seatRepository.markSeatsStatus(client, seatIds, 'AVAILABLE');
    await ticketRepository.markCancelled(client, id);
    const updated = await bookingRepository.updateStatus(client, id, 'CANCELLED');

    return { ...updated, seatIds };
  });

  await auditService.log({
    userId: result.user_id,
    action: 'BOOKING_CANCELLED',
    resourceType: 'BOOKING',
    resourceId: result.id,
    metadata: { seatIds: result.seatIds },
  });

  // Queue a refund job (handled by the payment worker).
  const { paymentQueue } = require('../queues/payment.queue');
  await paymentQueue.add('refund-booking', { bookingId: result.id });

  return result;
}

module.exports = {
  confirmBookingFromReservation,
  getBooking,
  listMyBookings,
  adminListBookings,
  cancelBooking,
};

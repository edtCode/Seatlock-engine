const { withTransaction } = require('../config/database');
const eventRepository = require('../repositories/event.repository');
const seatRepository = require('../repositories/seat.repository');
const reservationRepository = require('../repositories/reservation.repository');
const seatLockService = require('./seat-lock.service');
const auditService = require('./audit.service');
const { AppError } = require('../utils/errors');
const env = require('../config/env');
const logger = require('../config/logger');
const { randomUUID } = require('crypto');

/**
 * Create a reservation (temporary seat hold).
 *
 * Follows the algorithm in the PRD exactly:
 *  1-5: validation done by caller/validators + here
 *  6-7: acquire Redis locks for every seat, all-or-nothing
 *  8-14: Postgres transaction: SELECT ... FOR UPDATE, verify AVAILABLE,
 *        create reservation + items, mark seats HELD, commit
 *  15: caller (controller) schedules the BullMQ expiration job
 *  16: return reservation
 *
 * If the Postgres phase fails for any reason after Redis locks were
 * acquired, the locks are released so we never leave a "ghost" hold.
 */
async function createReservation({ userId, eventId, seatIds }) {
  const uniqueSeatIds = [...new Set(seatIds)];

  const event = await eventRepository.findById(eventId);
  if (!event) throw new AppError('EVENT_NOT_FOUND', 'Event not found');
  if (event.status !== 'PUBLISHED') {
    throw new AppError('EVENT_NOT_AVAILABLE', 'Event is not available for booking');
  }

  // Provisional lock-owner token used before the DB reservation row exists.
  const lockOwnerToken = randomUUID();

  const lockResult = await seatLockService.acquireSeatLocks({
    eventId,
    seatIds: uniqueSeatIds,
    reservationId: lockOwnerToken,
    ttlSeconds: env.RESERVATION_TTL_SECONDS,
  });

  if (!lockResult.acquired) {
    throw new AppError('SEAT_ALREADY_HELD', 'One or more selected seats are unavailable', {
      seatId: lockResult.conflictSeatId,
    });
  }

  let reservation;
  try {
    reservation = await withTransaction(async (client) => {
      const lockedSeats = await seatRepository.lockSeatsForUpdate(client, eventId, uniqueSeatIds);

      if (lockedSeats.length !== uniqueSeatIds.length) {
        throw new AppError('SEAT_NOT_FOUND', 'One or more seats do not exist for this event');
      }
      const unavailable = lockedSeats.filter((s) => s.status !== 'AVAILABLE');
      if (unavailable.length > 0) {
        throw new AppError('SEAT_NOT_AVAILABLE', 'One or more selected seats are no longer available', {
          seatIds: unavailable.map((s) => s.id),
        });
      }

      const totalAmount = lockedSeats.reduce((sum, s) => sum + Number(s.price), 0);
      const expiresAt = new Date(Date.now() + env.RESERVATION_TTL_SECONDS * 1000);

      const created = await reservationRepository.createReservation(client, {
        userId,
        eventId,
        expiresAt,
        totalAmount,
      });

      await reservationRepository.createReservationItems(
        client,
        created.id,
        lockedSeats.map((s) => ({ eventSeatId: s.id, price: s.price }))
      );

      await seatRepository.markSeatsStatus(client, uniqueSeatIds, 'HELD');

      return { ...created, seatIds: uniqueSeatIds, totalAmount };
    });
  } catch (err) {
    // Postgres phase failed after Redis locks were acquired - release them.
    await seatLockService.releaseSeatLocks({ eventId, seatIds: uniqueSeatIds, reservationId: lockOwnerToken });
    throw err;
  }

  // Re-key the Redis lock from the provisional token to the real reservation
  // ID, so later release calls (expiry worker, cancellation, booking
  // confirmation) can address it by reservation.id.
  await seatLockService.releaseSeatLocks({ eventId, seatIds: uniqueSeatIds, reservationId: lockOwnerToken });
  const reacquire = await seatLockService.acquireSeatLocks({
    eventId,
    seatIds: uniqueSeatIds,
    reservationId: String(reservation.id),
    ttlSeconds: env.RESERVATION_TTL_SECONDS,
  });
  if (!reacquire.acquired) {
    // Postgres already marked seats HELD and remains authoritative; the
    // expiration worker will still clean this reservation up on schedule
    // even if the Redis re-key race is lost. Log loudly for visibility.
    logger.error(
      { eventId, seatIds: uniqueSeatIds, reservationId: reservation.id },
      'Failed to re-key seat lock to reservation ID after creation'
    );
  }

  await auditService.log({
    userId,
    action: 'RESERVATION_CREATED',
    resourceType: 'RESERVATION',
    resourceId: reservation.id,
    metadata: { eventId, seatIds: uniqueSeatIds, totalAmount: reservation.totalAmount },
  });

  return reservation;
}

async function getReservation(id, requesterUserId, requesterRole) {
  const reservation = await reservationRepository.findById(id);
  if (!reservation) throw new AppError('RESERVATION_NOT_FOUND', 'Reservation not found');
  if (requesterRole !== 'ADMIN' && String(reservation.user_id) !== String(requesterUserId)) {
    throw new AppError('FORBIDDEN', 'You do not have access to this reservation');
  }
  const items = await reservationRepository.getItems(id);
  return { ...reservation, items };
}

async function listMyReservations(userId, pagination) {
  return reservationRepository.findByUser(userId, pagination);
}

/**
 * Expire a single reservation. Idempotent: if the reservation is not
 * ACTIVE anymore, this is a no-op. Used by the BullMQ worker and by a
 * defensive sweep for jobs that were somehow lost.
 */
async function expireReservation(reservationId) {
  const result = await withTransaction(async (client) => {
    const reservation = await reservationRepository.lockForUpdate(client, reservationId);
    if (!reservation) return null;

    // Only ACTIVE reservations can expire. This row lock is what prevents
    // the EXPIRED <-> CONFIRMED race: whichever transaction (this worker or
    // booking confirmation) locks the row first and sees ACTIVE wins; the
    // other sees a non-ACTIVE status afterwards and backs off harmlessly.
    if (reservation.status !== 'ACTIVE') {
      return { ...reservation, alreadyTerminal: true };
    }

    const seatIds = await reservationRepository.getItemSeatIds(client, reservationId);
    await seatRepository.markSeatsStatus(client, seatIds, 'AVAILABLE');
    const updated = await reservationRepository.updateStatus(client, reservationId, 'EXPIRED');
    return { ...updated, seatIds };
  });

  if (!result || result.alreadyTerminal) return result;

  await seatLockService.releaseSeatLocks({
    eventId: result.event_id,
    seatIds: result.seatIds,
    reservationId: String(result.id),
  });
  await auditService.log({
    userId: result.user_id,
    action: 'RESERVATION_EXPIRED',
    resourceType: 'RESERVATION',
    resourceId: result.id,
    metadata: { seatIds: result.seatIds },
  });

  return result;
}

/**
 * User-initiated cancellation of an ACTIVE reservation (before payment).
 */
async function cancelReservation(id, requesterUserId, requesterRole) {
  const result = await withTransaction(async (client) => {
    const reservation = await reservationRepository.lockForUpdate(client, id);
    if (!reservation) throw new AppError('RESERVATION_NOT_FOUND', 'Reservation not found');
    if (requesterRole !== 'ADMIN' && String(reservation.user_id) !== String(requesterUserId)) {
      throw new AppError('FORBIDDEN', 'You do not have access to this reservation');
    }
    if (reservation.status !== 'ACTIVE') {
      throw new AppError('RESERVATION_NOT_ACTIVE', 'Only active reservations can be cancelled');
    }

    const seatIds = await reservationRepository.getItemSeatIds(client, id);
    await seatRepository.markSeatsStatus(client, seatIds, 'AVAILABLE');
    const updated = await reservationRepository.updateStatus(client, id, 'CANCELLED');
    return { ...updated, seatIds };
  });

  await seatLockService.releaseSeatLocks({
    eventId: result.event_id,
    seatIds: result.seatIds,
    reservationId: String(result.id),
  });

  return result;
}

module.exports = {
  createReservation,
  getReservation,
  listMyReservations,
  expireReservation,
  cancelReservation,
};

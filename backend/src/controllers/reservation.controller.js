const reservationService = require('../services/reservation.service');
const idempotencyService = require('../services/idempotency.service');
const { scheduleExpiration } = require('../queues/reservation.queue');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const createReservation = asyncHandler(async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  const idem = await idempotencyService.begin({
    userId: req.user.id,
    key: idempotencyKey,
    requestBody: req.body,
  });

  if (!idem.isNew) {
    return res.status(idem.cachedResponse.status).json(idem.cachedResponse.body);
  }

  let responsePayload;
  try {
    const reservation = await reservationService.createReservation({
      userId: req.user.id,
      eventId: req.body.eventId,
      seatIds: req.body.seatIds,
    });

    // 15. Schedule BullMQ expiration job.
    await scheduleExpiration(reservation.id, reservation.expires_at);

    responsePayload = {
      status: 201,
      body: {
        success: true,
        data: {
          reservationId: String(reservation.id),
          status: reservation.status,
          expiresAt: reservation.expires_at,
          seats: reservation.seatIds,
          totalAmount: Number(reservation.total_amount ?? reservation.totalAmount),
        },
      },
    };
  } catch (err) {
    // Store the failure too, so a retried request with the same key gets
    // the same error instead of re-running (and potentially double-failing
    // side effects) the operation.
    responsePayload = {
      status: err.statusCode || 500,
      body: { success: false, error: { code: err.code || 'INTERNAL_ERROR', message: err.message } },
    };
    await idempotencyService.complete(idem.record, responsePayload);
    return res.status(responsePayload.status).json(responsePayload.body);
  }

  await idempotencyService.complete(idem.record, responsePayload);
  res.status(responsePayload.status).json(responsePayload.body);
});

const getReservation = asyncHandler(async (req, res) => {
  const reservation = await reservationService.getReservation(req.params.reservationId, req.user.id, req.user.role);
  res.status(200).json({ success: true, data: reservation });
});

const listMyReservations = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { data, total } = await reservationService.listMyReservations(req.user.id, {
    limit,
    offset,
    status: req.query.status,
  });
  res.status(200).json({ success: true, data, pagination: buildPaginationMeta({ page, limit, total }) });
});

const cancelReservation = asyncHandler(async (req, res) => {
  const reservation = await reservationService.cancelReservation(req.params.reservationId, req.user.id, req.user.role);
  res.status(200).json({ success: true, data: reservation });
});

module.exports = { createReservation, getReservation, listMyReservations, cancelReservation };

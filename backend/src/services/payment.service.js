const paymentRepository = require('../repositories/payment.repository');
const reservationRepository = require('../repositories/reservation.repository');
const webhookRepository = require('../repositories/webhook.repository');
const { getPaymentProvider } = require('../providers/payment');
const bookingService = require('./booking.service');
const auditService = require('./audit.service');
const { AppError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * Create a payment intent for an ACTIVE reservation. Price is always taken
 * from the reservation's stored total_amount (computed server-side from
 * event_seats.price at reservation time) - the frontend cannot influence it.
 */
async function createPayment({ userId, reservationId }) {
  const reservation = await reservationRepository.findById(reservationId);
  if (!reservation) throw new AppError('RESERVATION_NOT_FOUND', 'Reservation not found');
  if (String(reservation.user_id) !== String(userId)) {
    throw new AppError('FORBIDDEN', 'You do not have access to this reservation');
  }
  if (reservation.status !== 'ACTIVE') {
    throw new AppError('RESERVATION_NOT_ACTIVE', 'Reservation is not active');
  }
  if (new Date(reservation.expires_at) < new Date()) {
    throw new AppError('RESERVATION_EXPIRED', 'Reservation has expired');
  }

  const provider = getPaymentProvider();
  const intent = await provider.createPayment({
    amount: reservation.total_amount,
    currency: 'USD',
    metadata: { reservationId: reservation.id, userId },
  });

  const payment = await paymentRepository.create({
    bookingId: null,
    reservationId: reservation.id,
    userId,
    provider: 'mock',
    providerPaymentId: intent.providerPaymentId,
    amount: reservation.total_amount,
    currency: 'USD',
    status: 'PENDING',
  });

  return { payment, checkoutUrl: intent.checkoutUrl };
}

async function getPayment(id, requesterUserId, requesterRole) {
  const payment = await paymentRepository.findById(id);
  if (!payment) throw new AppError('PAYMENT_NOT_FOUND', 'Payment not found');
  if (requesterRole !== 'ADMIN' && String(payment.user_id) !== String(requesterUserId)) {
    throw new AppError('FORBIDDEN', 'You do not have access to this payment');
  }
  return payment;
}

/**
 * Process an incoming payment webhook (PRD sections 45-46).
 * Flow: verify signature -> claim event_id atomically (webhook idempotency)
 * -> already claimed? no-op -> process payment -> confirm booking.
 *
 * Never trust payment status the frontend might send directly; this is the
 * only path that can move a payment to SUCCESS and trigger booking confirmation.
 */
async function handleWebhook({ rawBody, signatureHeader }) {
  const provider = getPaymentProvider();

  if (!provider.verifyWebhookSignature(rawBody, signatureHeader)) {
    throw new AppError('INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed');
  }

  const event = provider.parseWebhookEvent(rawBody);
  if (!event.eventId) {
    throw new AppError('VALIDATION_ERROR', 'Webhook payload missing eventId');
  }

  // Atomic claim: duplicate deliveries of the same event_id are a no-op.
  const claimed = await webhookRepository.tryClaim({
    provider: 'mock',
    eventId: event.eventId,
    eventType: event.eventType,
    payload: event,
  });

  if (!claimed) {
    logger.info({ eventId: event.eventId }, 'Webhook event already processed, skipping');
    return { alreadyProcessed: true };
  }

  try {
    const payment = await paymentRepository.findByProviderPaymentId(event.providerPaymentId);
    if (!payment) {
      logger.warn({ providerPaymentId: event.providerPaymentId }, 'Webhook for unknown payment');
      await webhookRepository.markProcessed(claimed.id);
      return { alreadyProcessed: false, handled: false };
    }

    if (event.eventType === 'payment.succeeded' || event.status === 'SUCCESS') {
      await paymentRepository.updateStatus(payment.id, 'SUCCESS');
      await auditService.log({
        userId: payment.user_id,
        action: 'PAYMENT_SUCCESS',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        metadata: { reservationId: payment.reservation_id },
      });

      try {
        const booking = await bookingService.confirmBookingFromReservation({
          reservationId: payment.reservation_id,
        });
        await paymentRepository.attachBooking(payment.id, booking.id);
      } catch (err) {
        // Reservation expired/cancelled before payment could confirm it -
        // this is Invariant 2 (an expired reservation cannot become
        // confirmed) winning the race. The payment succeeded but the seats
        // are gone; queue a refund rather than silently keeping the money.
        logger.warn(
          { err, reservationId: payment.reservation_id },
          'Payment succeeded but reservation could not be confirmed - queuing refund'
        );
        const { paymentQueue } = require('../queues/payment.queue');
        await paymentQueue.add('refund-payment', { paymentId: payment.id });
      }
    } else if (event.eventType === 'payment.failed' || event.status === 'FAILED') {
      await paymentRepository.updateStatus(payment.id, 'FAILED');
      await auditService.log({
        userId: payment.user_id,
        action: 'PAYMENT_FAILED',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
      });
    }

    await webhookRepository.markProcessed(claimed.id);
    return { alreadyProcessed: false, handled: true };
  } catch (err) {
    // Still mark processed=false implicitly (we didn't mark it processed on
    // error) so a retried delivery with the same event_id can be reattempted
    // by operators if needed; the unique constraint already prevented a
    // second logical run from a *duplicate* delivery, but this path is a
    // genuine failure of the first attempt.
    logger.error({ err, eventId: event.eventId }, 'Webhook processing failed');
    throw err;
  }
}

async function refundPayment(paymentId) {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment) return;
  if (payment.status !== 'SUCCESS') return;

  const provider = getPaymentProvider();
  await provider.refundPayment(payment.provider_payment_id, payment.amount);
  await paymentRepository.updateStatus(payment.id, 'REFUNDED');
  await auditService.log({
    userId: payment.user_id,
    action: 'PAYMENT_REFUNDED',
    resourceType: 'PAYMENT',
    resourceId: payment.id,
  });
}

async function refundBooking(bookingId) {
  const paymentByBooking = await require('../config/database').query(
    `SELECT * FROM payments WHERE booking_id = $1 AND status = 'SUCCESS' LIMIT 1`,
    [bookingId]
  );
  const payment = paymentByBooking.rows[0];
  if (!payment) return;
  await refundPayment(payment.id);
}

module.exports = { createPayment, getPayment, handleWebhook, refundPayment, refundBooking };

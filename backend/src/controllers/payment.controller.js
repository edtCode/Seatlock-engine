const paymentService = require('../services/payment.service');
const idempotencyService = require('../services/idempotency.service');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../config/logger');

const createPayment = asyncHandler(async (req, res) => {
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
    const { payment, checkoutUrl } = await paymentService.createPayment({
      userId: req.user.id,
      reservationId: req.body.reservationId,
    });
    responsePayload = {
      status: 201,
      body: { success: true, data: { paymentId: String(payment.id), status: payment.status, checkoutUrl } },
    };
  } catch (err) {
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

const getPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPayment(req.params.paymentId, req.user.id, req.user.role);
  res.status(200).json({ success: true, data: payment });
});

/**
 * Webhook endpoint. Expects the raw request body (see app.js, which wires
 * express.raw() specifically for this route) so the provider's signature
 * can be verified against the exact bytes received.
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const signatureHeader = req.headers['x-mock-signature'];
  const rawBody = req.body; // Buffer, thanks to express.raw() on this route.

  try {
    const result = await paymentService.handleWebhook({ rawBody: rawBody.toString('utf8'), signatureHeader });
    // Always return 200 quickly once accepted/deduplicated so the provider
    // does not retry unnecessarily.
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    logger.error({ err }, 'Webhook handling error');
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { code: err.code || 'INTERNAL_ERROR', message: err.message } });
  }
});

module.exports = { createPayment, getPayment, handleWebhook };

const crypto = require('crypto');
const PaymentProvider = require('./payment.provider');
const env = require('../../config/env');

/**
 * Mock payment provider: simulates a real gateway well enough to exercise
 * the full flow (create -> webhook -> confirm) without external calls.
 * Payments succeed immediately; a helper below can simulate signed webhooks
 * for tests.
 */
class MockPaymentProvider extends PaymentProvider {
  async createPayment({ amount, currency = 'USD', metadata = {} }) {
    const providerPaymentId = `mock_pay_${crypto.randomUUID()}`;
    return {
      providerPaymentId,
      status: 'PENDING',
      checkoutUrl: `https://mock-payments.local/checkout/${providerPaymentId}`,
      amount,
      currency,
      metadata,
    };
  }

  async verifyPayment(providerPaymentId) {
    // In a real integration this would call the provider's API.
    // The mock always reports success for any well-formed ID.
    return { status: 'SUCCESS', providerPaymentId };
  }

  async refundPayment(providerPaymentId, amount) {
    return { refundId: `mock_refund_${crypto.randomUUID()}`, status: 'SUCCESS', providerPaymentId, amount };
  }

  signPayload(payload) {
    return crypto.createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(payload).digest('hex');
  }

  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!signatureHeader) return false;
    const expected = this.signPayload(rawBody);
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  parseWebhookEvent(rawBody) {
    const payload = JSON.parse(rawBody);
    return {
      eventId: payload.eventId,
      eventType: payload.eventType, // e.g. 'payment.succeeded' | 'payment.failed'
      providerPaymentId: payload.providerPaymentId,
      status: payload.status,
      amount: payload.amount,
    };
  }
}

module.exports = new MockPaymentProvider();

/**
 * PaymentProvider interface contract. Every concrete provider (mock,
 * Razorpay, Stripe, ...) must implement these methods with this shape,
 * so PaymentService never needs to know which provider is active.
 *
 *   createPayment({ amount, currency, metadata }) -> { providerPaymentId, status, checkoutUrl? }
 *   verifyPayment(providerPaymentId) -> { status, amount, currency }
 *   refundPayment(providerPaymentId, amount) -> { refundId, status }
 *   verifyWebhookSignature(rawBody, signatureHeader) -> boolean
 *   parseWebhookEvent(rawBody) -> { eventId, eventType, providerPaymentId, status, amount }
 */
class PaymentProvider {
  async createPayment(_params) {
    throw new Error('createPayment not implemented');
  }
  async verifyPayment(_providerPaymentId) {
    throw new Error('verifyPayment not implemented');
  }
  async refundPayment(_providerPaymentId, _amount) {
    throw new Error('refundPayment not implemented');
  }
  verifyWebhookSignature(_rawBody, _signatureHeader) {
    throw new Error('verifyWebhookSignature not implemented');
  }
  parseWebhookEvent(_rawBody) {
    throw new Error('parseWebhookEvent not implemented');
  }
}

module.exports = PaymentProvider;

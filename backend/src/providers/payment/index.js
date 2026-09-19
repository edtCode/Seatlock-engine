const env = require('../../config/env');
const mockProvider = require('./mock-payment.provider');

/**
 * Provider registry. To add Razorpay/Stripe: implement PaymentProvider's
 * contract in a new file (e.g. razorpay-payment.provider.js), register it
 * here, and set PAYMENT_PROVIDER=razorpay in the environment. No other
 * code changes - PaymentService only depends on the interface.
 */
const providers = {
  mock: mockProvider,
};

function getPaymentProvider() {
  const provider = providers[env.PAYMENT_PROVIDER];
  if (!provider) {
    throw new Error(`Unknown PAYMENT_PROVIDER: ${env.PAYMENT_PROVIDER}`);
  }
  return provider;
}

module.exports = { getPaymentProvider };

const logger = require('../../config/logger');

/**
 * NotificationProvider interface: sendEmail({ to, subject, body }) -> { messageId }
 * Swap this out for a real provider (SES, SendGrid, Postmark, ...) later;
 * NotificationService and the email worker only depend on this shape.
 */
class MockNotificationProvider {
  async sendEmail({ to, subject, body }) {
    // No real email is sent in this environment - log it instead so the
    // flow is fully exercised and observable end-to-end.
    logger.info({ to, subject }, 'Mock email sent');
    return { messageId: `mock_email_${Date.now()}` };
  }
}

module.exports = new MockNotificationProvider();

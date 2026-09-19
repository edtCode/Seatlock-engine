/**
 * Standardized application error codes, each mapped to an HTTP status.
 * Controllers/services throw AppError with one of these codes; the
 * centralized error middleware converts it to the standard response shape.
 */
const ERROR_CODES = {
  // Auth
  AUTH_REQUIRED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_TOKEN: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  USER_NOT_FOUND: 404,
  USER_DISABLED: 403,
  EMAIL_ALREADY_EXISTS: 409,
  INVALID_RESET_TOKEN: 400,

  // Events / Venues / Seats
  EVENT_NOT_FOUND: 404,
  EVENT_NOT_AVAILABLE: 409,
  VENUE_NOT_FOUND: 404,
  SEAT_NOT_FOUND: 404,
  SEAT_ALREADY_HELD: 409,
  SEAT_ALREADY_BOOKED: 409,
  SEAT_NOT_AVAILABLE: 409,
  DUPLICATE_SEAT: 409,

  // Reservations
  RESERVATION_NOT_FOUND: 404,
  RESERVATION_EXPIRED: 409,
  RESERVATION_CANCELLED: 409,
  RESERVATION_NOT_ACTIVE: 409,

  // Bookings
  BOOKING_NOT_FOUND: 404,
  BOOKING_CANCELLED: 409,
  BOOKING_ALREADY_CANCELLED: 409,
  BOOKING_NOT_CANCELLABLE: 409,

  // Payments
  PAYMENT_FAILED: 402,
  PAYMENT_NOT_FOUND: 404,
  INVALID_WEBHOOK_SIGNATURE: 400,

  // Idempotency
  IDEMPOTENCY_KEY_REQUIRED: 400,
  IDEMPOTENCY_KEY_REUSED: 409,

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 429,

  // Tickets
  TICKET_NOT_FOUND: 404,
  TICKET_ALREADY_USED: 409,
  TICKET_CANCELLED: 409,
  INVALID_TICKET: 400,

  // Generic
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

class AppError extends Error {
  constructor(code, message, details) {
    super(message || code);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = ERROR_CODES[code] || 500;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

module.exports = { AppError, ERROR_CODES };

const { AppError } = require('../utils/errors');
const env = require('../config/env');
const logger = require('../config/logger');

// Postgres error codes we want to translate into safe, meaningful responses
// instead of leaking raw SQL errors.
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';

function toAppError(err) {
  if (err instanceof AppError) return err;

  if (err.code === PG_UNIQUE_VIOLATION) {
    return new AppError('VALIDATION_ERROR', 'A record with these values already exists');
  }
  if (err.code === PG_FOREIGN_KEY_VIOLATION) {
    return new AppError('VALIDATION_ERROR', 'Referenced resource does not exist');
  }
  if (err.code === PG_CHECK_VIOLATION) {
    return new AppError('VALIDATION_ERROR', 'Invalid value for one or more fields');
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return new AppError('INVALID_TOKEN', 'Invalid or expired token');
  }

  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred');
}

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  const appError = toAppError(err);

  const logPayload = {
    requestId: req.id,
    method: req.method,
    route: req.originalUrl,
    statusCode: appError.statusCode,
    userId: req.user?.id,
    code: appError.code,
  };

  if (appError.statusCode >= 500) {
    logger.error({ ...logPayload, err }, 'Request failed with server error');
  } else {
    logger.warn(logPayload, 'Request failed with client error');
  }

  const body = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      requestId: req.id,
    },
  };

  if (appError.details) {
    body.error.details = appError.details;
  }

  // Never leak stack traces / internals in production.
  if (env.NODE_ENV !== 'production' && appError.statusCode >= 500) {
    body.error.stack = err.stack;
  }

  res.status(appError.statusCode).json(body);
}

module.exports = errorMiddleware;

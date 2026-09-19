const { AppError } = require('../utils/errors');

function notFound(req, res, next) {
  next(new AppError('NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFound;

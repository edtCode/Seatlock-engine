const { AppError } = require('../utils/errors');

/**
 * authorize('ADMIN') -> only ADMIN role may proceed.
 * Must run after `authenticate`, which populates req.user.
 */
function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return next(new AppError('AUTH_REQUIRED', 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 'You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = authorize;

const { verifyAccessToken } = require('../utils/tokens');
const { AppError } = require('../utils/errors');
const userRepository = require('../repositories/user.repository');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Verifies the access token, loads the current user from the DB (so a
 * disabled account is rejected immediately even with a still-valid JWT),
 * and attaches a minimal, safe user object to req.user.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('AUTH_REQUIRED', 'Authentication required');
  }

  const token = header.slice('Bearer '.length).trim();
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('TOKEN_EXPIRED', 'Access token expired');
    }
    throw new AppError('INVALID_TOKEN', 'Invalid access token');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user) throw new AppError('USER_NOT_FOUND', 'User not found');
  if (user.status === 'DISABLED') throw new AppError('USER_DISABLED', 'Account is disabled');

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
});

/**
 * Optional authentication: attaches req.user if a valid token is present,
 * but does not reject the request otherwise. Useful for public endpoints
 * that personalize output when logged in.
 */
const authenticateOptional = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const token = header.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);
    const user = await userRepository.findById(payload.sub);
    if (user && user.status !== 'DISABLED') {
      req.user = { id: user.id, email: user.email, role: user.role };
    }
  } catch {
    // Ignore invalid tokens on optional auth.
  }
  next();
});

module.exports = { authenticate, authenticateOptional };

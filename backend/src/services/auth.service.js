const bcrypt = require('bcrypt');
const userRepository = require('../repositories/user.repository');
const tokenRepository = require('../repositories/auth-token.repository');
const { AppError } = require('../utils/errors');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
  refreshTokenExpiryDate,
} = require('../utils/tokens');
const logger = require('../config/logger');

const BCRYPT_ROUNDS = 10;

async function register({ name, email, password }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new AppError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await userRepository.create({ name, email, passwordHash, role: 'USER' });
  const tokens = await issueTokenPair(user);
  return { user: userRepository.toPublicUser(user), ...tokens };
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  if (!user) throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');
  if (user.status === 'DISABLED') throw new AppError('USER_DISABLED', 'Account is disabled');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');

  const tokens = await issueTokenPair(user);
  return { user: userRepository.toPublicUser(user), ...tokens };
}

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const { token: refreshToken } = signRefreshToken(user);
  await tokenRepository.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiryDate(),
  });
  return { accessToken, refreshToken };
}

/**
 * Refresh token rotation: the presented refresh token is revoked and a
 * brand-new one issued, so a leaked-but-unused token can't be replayed
 * indefinitely, and reuse of an already-rotated token is detectable.
 */
async function refresh({ refreshToken }) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('INVALID_TOKEN', 'Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await tokenRepository.findRefreshTokenByHash(tokenHash);
  if (!stored || stored.revoked_at || new Date(stored.expires_at) < new Date()) {
    throw new AppError('INVALID_TOKEN', 'Refresh token is no longer valid');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || user.status === 'DISABLED') {
    throw new AppError('USER_DISABLED', 'Account is disabled');
  }

  await tokenRepository.revokeRefreshToken(stored.id);
  const tokens = await issueTokenPair(user);
  return { user: userRepository.toPublicUser(user), ...tokens };
}

async function logout({ refreshToken }) {
  if (!refreshToken) return;
  try {
    const tokenHash = hashToken(refreshToken);
    const stored = await tokenRepository.findRefreshTokenByHash(tokenHash);
    if (stored) await tokenRepository.revokeRefreshToken(stored.id);
  } catch (err) {
    logger.warn({ err }, 'Logout: failed to revoke refresh token (ignored)');
  }
}

async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError('USER_NOT_FOUND', 'User not found');
  return userRepository.toPublicUser(user);
}

async function forgotPassword({ email }) {
  const user = await userRepository.findByEmail(email);
  // Always behave the same whether or not the email exists, to avoid
  // leaking which emails are registered.
  if (!user) return { message: 'If that email exists, a reset link has been sent.' };

  const rawToken = generateOpaqueToken();
  await tokenRepository.createPasswordResetToken({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  // In production this would be emailed via the notification queue, not returned.
  logger.info({ userId: user.id }, 'Password reset token generated');
  return { message: 'If that email exists, a reset link has been sent.', resetToken: rawToken };
}

async function resetPassword({ token, newPassword }) {
  const tokenHash = hashToken(token);
  const stored = await tokenRepository.findPasswordResetTokenByHash(tokenHash);
  if (!stored || stored.used_at || new Date(stored.expires_at) < new Date()) {
    throw new AppError('INVALID_RESET_TOKEN', 'Reset token is invalid or expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await userRepository.updatePassword(stored.user_id, passwordHash);
  await tokenRepository.markPasswordResetTokenUsed(stored.id);
  await tokenRepository.revokeAllForUser(stored.user_id); // force re-login everywhere

  return { message: 'Password has been reset successfully.' };
}

module.exports = { register, login, refresh, logout, getCurrentUser, forgotPassword, resetPassword };

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN }
  );
}

function signRefreshToken(user) {
  // jti ties this token to a specific refresh_tokens row so it can be
  // individually revoked/rotated without invalidating every session.
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: user.id, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
  });
  return { token, jti };
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

/**
 * We never store raw refresh tokens or reset tokens - only a SHA-256 hash.
 * This is a fast, deterministic hash suitable for lookups (unlike bcrypt,
 * which is intentionally slow and randomly salted per-call).
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

function refreshTokenExpiryDate() {
  const ms = parseDurationToMs(env.REFRESH_TOKEN_EXPIRES_IN);
  return new Date(Date.now() + ms);
}

function parseDurationToMs(duration) {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // default 30d
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
  refreshTokenExpiryDate,
  parseDurationToMs,
};

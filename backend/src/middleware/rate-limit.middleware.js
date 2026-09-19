const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redis } = require('../config/redis');
const { AppError } = require('../utils/errors');
const logger = require('../config/logger');

function buildLimiter({ windowMs, max, prefix }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // adds RateLimit-* headers
    legacyHeaders: false,
    // Rate limit per authenticated user when available, else per IP.
    keyGenerator: (req) => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`),
    store: new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: (...args) => redis.call(...args),
    }),
    handler: (req, res, next) => {
      next(new AppError('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later'));
    },
    skip: () => process.env.NODE_ENV === 'test',
  });
}

// Different limits per PRD section 48.
const loginLimiter = buildLimiter({ windowMs: 60 * 1000, max: 5, prefix: 'login' });
const reservationLimiter = buildLimiter({ windowMs: 60 * 1000, max: 20, prefix: 'reservation' });
const paymentLimiter = buildLimiter({ windowMs: 60 * 1000, max: 10, prefix: 'payment' });
const publicLimiter = buildLimiter({ windowMs: 60 * 1000, max: 100, prefix: 'public' });

module.exports = { loginLimiter, reservationLimiter, paymentLimiter, publicLimiter };

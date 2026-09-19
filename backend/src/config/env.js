require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // In test env, allow missing secrets to be filled by test setup.
    if (process.env.NODE_ENV === 'test') return undefined;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),

  DATABASE_URL: required('DATABASE_URL', process.env.NODE_ENV === 'test' ? 'postgresql://postgres:postgres@localhost:5432/seatlock_test' : undefined),
  DATABASE_SSL: process.env.DATABASE_SSL === 'true',
  DATABASE_POOL_MAX: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),

  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET', process.env.NODE_ENV === 'test' ? 'test_access_secret_at_least_32_characters' : undefined),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET', process.env.NODE_ENV === 'test' ? 'test_refresh_secret_at_least_32_characters' : undefined),
  ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',

  RESERVATION_TTL_SECONDS: parseInt(process.env.RESERVATION_TTL_SECONDS || '300', 10),

  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'mock',
  PAYMENT_SECRET: process.env.PAYMENT_SECRET || 'mock_payment_secret',
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || 'mock_webhook_secret',

  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

module.exports = env;

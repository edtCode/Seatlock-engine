const pino = require('pino');
const env = require('./env');

function prettyTransportAvailable() {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'refresh_token',
  '*.password',
  '*.passwordHash',
  '*.token',
];

const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development' && prettyTransportAvailable()
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  base: { service: 'seatlock-api' },
});

module.exports = logger;

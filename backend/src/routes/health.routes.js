const { Router } = require('express');
const db = require('../config/database');
const { checkConnection: checkRedis } = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get(
  '/ready',
  asyncHandler(async (req, res) => {
    const services = { postgres: 'ok', redis: 'ok' };
    let healthy = true;

    try {
      await db.checkConnection();
    } catch {
      services.postgres = 'error';
      healthy = false;
    }

    try {
      const ok = await checkRedis();
      if (!ok) throw new Error('redis ping failed');
    } catch {
      services.redis = 'error';
      healthy = false;
    }

    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', services });
  })
);

module.exports = router;

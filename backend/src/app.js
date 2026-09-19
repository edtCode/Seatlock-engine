const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const logger = require('./config/logger');
const requestId = require('./middleware/request-id.middleware');
const errorMiddleware = require('./middleware/error.middleware');
const notFound = require('./middleware/not-found.middleware');
const apiRoutes = require('./routes');
const webhookRoutes = require('./routes/webhook.routes');
const healthRoutes = require('./routes/health.routes');
const openapiSpec = require('./docs/swagger');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true); // needed for correct req.ip behind a load balancer

app.use(requestId);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req(req) {
        return { method: req.method, url: req.url, id: req.id };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

// Webhook route needs the exact raw bytes for signature verification, so it
// is mounted with express.raw() BEFORE the global JSON body parser below -
// otherwise express.json() would already have consumed and parsed the body.
app.use('/api/v1/webhooks', express.raw({ type: '*/*', limit: '1mb' }), webhookRoutes);

// Request size limits (PRD section 78).
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health checks (unauthenticated, unversioned, used by orchestrators/load balancers).
app.use('/', healthRoutes);

// API documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Redirect root to API docs for convenience
app.get('/', (req, res) => res.redirect('/api/docs'));

// Versioned API
app.use('/api/v1', apiRoutes);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;

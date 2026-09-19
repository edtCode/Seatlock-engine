const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SeatLock API',
    version: '1.0.0',
    description:
      'High-concurrency event and seat reservation platform. Base path: /api/v1. ' +
      'Authenticate with a Bearer access token obtained from /auth/login or /auth/register.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'User registered' }, 409: { description: 'Email already exists' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Login successful' }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/auth/refresh': {
      post: { summary: 'Rotate refresh token for a new access/refresh pair', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/logout': {
      post: { summary: 'Revoke a refresh token', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/me': {
      get: { summary: 'Get current authenticated user', responses: { 200: { description: 'OK' } } },
    },
    '/events': {
      get: {
        summary: 'List / search published events',
        security: [],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'city', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        summary: 'Create an event (admin)',
        responses: { 201: { description: 'Created' }, 403: { description: 'Forbidden' } },
      },
    },
    '/events/{eventId}': {
      get: { summary: 'Get event by ID', security: [], responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } },
      patch: { summary: 'Update event (admin)', responses: { 200: { description: 'OK' } } },
      delete: { summary: 'Delete event (admin)', responses: { 204: { description: 'Deleted' } } },
    },
    '/events/{eventId}/seats': {
      get: { summary: 'List seat inventory for an event', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/reservations': {
      post: {
        summary: 'Create a temporary seat reservation (seat hold)',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            description: 'Client-generated unique key to make this request safely retryable.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['eventId', 'seatIds'],
                properties: {
                  eventId: { type: 'integer' },
                  seatIds: { type: 'array', items: { type: 'integer' } },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Reservation created' },
          409: { description: 'SEAT_ALREADY_HELD / SEAT_ALREADY_BOOKED / IDEMPOTENCY_KEY_REUSED' },
        },
      },
      get: { summary: "List current user's reservations", responses: { 200: { description: 'OK' } } },
    },
    '/reservations/{reservationId}': {
      get: { summary: 'Get a reservation', responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } },
    },
    '/reservations/{reservationId}/cancel': {
      post: { summary: 'Cancel an active reservation', responses: { 200: { description: 'OK' } } },
    },
    '/payments': {
      post: {
        summary: 'Create a payment for an active reservation',
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }],
        responses: { 201: { description: 'Payment created' } },
      },
    },
    '/payments/{paymentId}': {
      get: { summary: 'Get payment status', responses: { 200: { description: 'OK' } } },
    },
    '/webhooks/payment': {
      post: {
        summary: 'Payment provider webhook (signature-verified, idempotent by event ID)',
        security: [],
        responses: { 200: { description: 'Processed or already-processed' }, 400: { description: 'Invalid signature' } },
      },
    },
    '/bookings': {
      get: { summary: "List current user's bookings", responses: { 200: { description: 'OK' } } },
    },
    '/bookings/{bookingId}': {
      get: { summary: 'Get a booking', responses: { 200: { description: 'OK' } } },
    },
    '/bookings/{bookingId}/cancel': {
      post: { summary: 'Cancel a confirmed booking (own bookings only)', responses: { 200: { description: 'OK' } } },
    },
    '/tickets/{ticketId}': {
      get: { summary: 'Get ticket details + QR code', responses: { 200: { description: 'OK' } } },
    },
    '/tickets/verify': {
      post: {
        summary: 'Verify/consume a ticket (admin/staff only)',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { ticketRef: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Ticket marked USED' }, 409: { description: 'TICKET_ALREADY_USED' } },
      },
    },
    '/admin/dashboard': {
      get: { summary: 'Admin dashboard metrics', responses: { 200: { description: 'OK' } } },
    },
    '/admin/audit-logs': {
      get: { summary: 'List audit logs', responses: { 200: { description: 'OK' } } },
    },
  },
};

module.exports = openapiSpec;

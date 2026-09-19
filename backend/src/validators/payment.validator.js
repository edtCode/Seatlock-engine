const { z } = require('zod');

const createPaymentSchema = {
  headers: z.object({
    'idempotency-key': z.string().min(1, 'Idempotency-Key header is required'),
  }),
  body: z.object({
    reservationId: z.coerce.number().int().positive(),
  }),
};

const paymentIdParam = {
  params: z.object({ paymentId: z.coerce.number().int().positive() }),
};

module.exports = { createPaymentSchema, paymentIdParam };

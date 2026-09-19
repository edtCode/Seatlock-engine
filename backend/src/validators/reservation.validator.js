const { z } = require('zod');

const createReservationSchema = {
  headers: z.object({
    'idempotency-key': z.string().min(1, 'Idempotency-Key header is required'),
  }),
  body: z.object({
    eventId: z.coerce.number().int().positive(),
    seatIds: z
      .array(z.coerce.number().int().positive())
      .min(1, 'At least one seat is required')
      .refine((arr) => new Set(arr).size === arr.length, { message: 'seatIds must be unique' }),
  }),
};

const reservationIdParam = {
  params: z.object({ reservationId: z.coerce.number().int().positive() }),
};

const listReservationsSchema = {
  query: z.object({
    status: z.enum(['ACTIVE', 'EXPIRED', 'CONFIRMED', 'CANCELLED']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

module.exports = { createReservationSchema, reservationIdParam, listReservationsSchema };

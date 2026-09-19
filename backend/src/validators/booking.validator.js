const { z } = require('zod');

const bookingIdParam = {
  params: z.object({ bookingId: z.coerce.number().int().positive() }),
};

const listBookingsSchema = {
  query: z.object({
    status: z.enum(['CONFIRMED', 'CANCELLED', 'REFUNDED']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const adminListBookingsSchema = {
  query: z.object({
    status: z.enum(['CONFIRMED', 'CANCELLED', 'REFUNDED']).optional(),
    eventId: z.coerce.number().int().positive().optional(),
    userId: z.coerce.number().int().positive().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

module.exports = { bookingIdParam, listBookingsSchema, adminListBookingsSchema };

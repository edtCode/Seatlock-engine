const { z } = require('zod');

const idParam = z.object({ eventId: z.coerce.number().int().positive() });
const venueIdParam = z.object({ venueId: z.coerce.number().int().positive() });
const venueSeatIdParams = z.object({
  venueId: z.coerce.number().int().positive(),
  seatId: z.coerce.number().int().positive(),
});

const searchEventsSchema = {
  query: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    city: z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sortBy: z.enum(['start_time', 'created_at', 'title']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const getEventSchema = { params: idParam };

const createEventSchema = {
  body: z.object({
    venueId: z.coerce.number().int().positive(),
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    category: z.string().max(80).optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).optional(),
  }),
};

const updateEventSchema = {
  params: idParam,
  body: z
    .object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      category: z.string().max(80).optional(),
      startTime: z.string().datetime().optional(),
      endTime: z.string().datetime().optional(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field is required' }),
};

const generateEventSeatsSchema = {
  params: idParam,
  body: z.object({
    defaultPrice: z.coerce.number().nonnegative(),
    pricesByType: z
      .object({
        REGULAR: z.coerce.number().nonnegative().optional(),
        PREMIUM: z.coerce.number().nonnegative().optional(),
        VIP: z.coerce.number().nonnegative().optional(),
        ACCESSIBLE: z.coerce.number().nonnegative().optional(),
      })
      .optional(),
  }),
};

const createVenueSchema = {
  body: z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    address: z.string().max(300).optional(),
    city: z.string().max(120).optional(),
  }),
};

const updateVenueSchema = {
  params: venueIdParam,
  body: z
    .object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      address: z.string().max(300).optional(),
      city: z.string().max(120).optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field is required' }),
};

const createSeatSchema = {
  params: venueIdParam,
  body: z.object({
    rowLabel: z.string().min(1).max(10),
    seatNumber: z.coerce.number().int().positive(),
    seatType: z.enum(['REGULAR', 'PREMIUM', 'VIP', 'ACCESSIBLE']).optional(),
  }),
};

const bulkCreateSeatsSchema = {
  params: venueIdParam,
  body: z.object({
    seats: z
      .array(
        z.object({
          rowLabel: z.string().min(1).max(10),
          seatNumber: z.coerce.number().int().positive(),
          seatType: z.enum(['REGULAR', 'PREMIUM', 'VIP', 'ACCESSIBLE']).optional(),
        })
      )
      .min(1),
  }),
};

const updateSeatSchema = {
  params: venueSeatIdParams,
  body: z
    .object({
      rowLabel: z.string().min(1).max(10).optional(),
      seatNumber: z.coerce.number().int().positive().optional(),
      seatType: z.enum(['REGULAR', 'PREMIUM', 'VIP', 'ACCESSIBLE']).optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field is required' }),
};

module.exports = {
  searchEventsSchema,
  getEventSchema,
  createEventSchema,
  updateEventSchema,
  generateEventSeatsSchema,
  createVenueSchema,
  updateVenueSchema,
  createSeatSchema,
  bulkCreateSeatsSchema,
  updateSeatSchema,
  venueIdParam,
  venueSeatIdParams,
};

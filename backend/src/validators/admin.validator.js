const { z } = require('zod');

const userIdParam = {
  params: z.object({ id: z.coerce.number().int().positive() }),
};

const updateUserStatusSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ status: z.enum(['ACTIVE', 'DISABLED']) }),
};

const updateUserRoleSchema = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ role: z.enum(['USER', 'ADMIN']) }),
};

const listUsersSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const auditLogsSchema = {
  query: z.object({
    action: z.string().optional(),
    userId: z.coerce.number().int().positive().optional(),
    resourceType: z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const dashboardSchema = {
  query: z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),
};

module.exports = {
  userIdParam,
  updateUserStatusSchema,
  updateUserRoleSchema,
  listUsersSchema,
  auditLogsSchema,
  dashboardSchema,
};

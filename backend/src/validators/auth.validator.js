const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

const registerSchema = {
  body: z.object({
    name: z.string().min(1).max(150),
    email: z.string().email().max(255),
    password: passwordSchema,
  }),
};

const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
};

const refreshSchema = {
  body: z.object({
    refreshToken: z.string().min(1),
  }),
};

const logoutSchema = {
  body: z.object({
    refreshToken: z.string().min(1).optional(),
  }),
};

const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email(),
  }),
};

const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1),
    newPassword: passwordSchema,
  }),
};

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};

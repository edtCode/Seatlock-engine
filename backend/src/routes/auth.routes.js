const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { loginLimiter, publicLimiter } = require('../middleware/rate-limit.middleware');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');

const router = Router();

router.post('/register', publicLimiter, validate(registerSchema), controller.register);
router.post('/login', loginLimiter, validate(loginSchema), controller.login);
router.post('/refresh', publicLimiter, validate(refreshSchema), controller.refresh);
router.post('/logout', publicLimiter, validate(logoutSchema), controller.logout);
router.get('/me', authenticate, controller.me);
router.post('/forgot-password', loginLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', loginLimiter, validate(resetPasswordSchema), controller.resetPassword);

module.exports = router;

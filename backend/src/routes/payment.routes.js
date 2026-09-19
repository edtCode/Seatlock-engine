const { Router } = require('express');
const controller = require('../controllers/payment.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { paymentLimiter } = require('../middleware/rate-limit.middleware');
const { createPaymentSchema, paymentIdParam } = require('../validators/payment.validator');

const router = Router();

router.use(authenticate);

router.post('/', paymentLimiter, validate(createPaymentSchema), controller.createPayment);
router.get('/:paymentId', validate(paymentIdParam), controller.getPayment);

module.exports = router;

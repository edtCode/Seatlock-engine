const { Router } = require('express');
const controller = require('../controllers/payment.controller');

const router = Router();

// Body parsing for this route is express.raw() (wired in app.js) so the
// exact bytes are available for signature verification.
router.post('/payment', controller.handleWebhook);

module.exports = router;

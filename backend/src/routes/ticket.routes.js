const { Router } = require('express');
const controller = require('../controllers/ticket.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const authorize = require('../middleware/authorization.middleware');
const { ticketRefParam, verifyTicketSchema } = require('../validators/ticket.validator');

const router = Router();

router.use(authenticate);

router.get('/:ticketId', validate(ticketRefParam), controller.getTicket);
router.post('/verify', authorize('ADMIN'), validate(verifyTicketSchema), controller.verifyTicket);

module.exports = router;

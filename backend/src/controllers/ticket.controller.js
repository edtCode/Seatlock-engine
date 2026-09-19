const ticketService = require('../services/ticket.service');
const asyncHandler = require('../utils/asyncHandler');

const getTicket = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getTicket(req.params.ticketId, req.user.id, req.user.role);
  res.status(200).json({ success: true, data: ticket });
});

const verifyTicket = asyncHandler(async (req, res) => {
  const ticket = await ticketService.verifyTicket({ ticketRef: req.body.ticketRef, staffUserId: req.user.id });
  res.status(200).json({ success: true, data: ticket });
});

module.exports = { getTicket, verifyTicket };

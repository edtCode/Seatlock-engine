const { z } = require('zod');

const ticketRefParam = {
  params: z.object({ ticketId: z.string().min(1) }),
};

const verifyTicketSchema = {
  body: z.object({
    ticketRef: z.string().min(1),
  }),
};

module.exports = { ticketRefParam, verifyTicketSchema };

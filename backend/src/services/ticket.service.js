const QRCode = require('qrcode');
const { withTransaction, query } = require('../config/database');
const ticketRepository = require('../repositories/ticket.repository');
const auditService = require('./audit.service');
const { AppError } = require('../utils/errors');

async function getTicket(ticketRef, requesterUserId, requesterRole) {
  const ticket = await ticketRepository.findByRef(ticketRef);
  if (!ticket) throw new AppError('TICKET_NOT_FOUND', 'Ticket not found');

  const { rows } = await query(`SELECT * FROM bookings WHERE id = $1`, [ticket.booking_id]);
  const booking = rows[0];
  if (requesterRole !== 'ADMIN' && String(booking?.user_id) !== String(requesterUserId)) {
    throw new AppError('FORBIDDEN', 'You do not have access to this ticket');
  }

  const qrDataUrl = await QRCode.toDataURL(ticket.ticket_ref);
  return { ...ticket, qrCode: qrDataUrl };
}

/**
 * Verify (consume) a ticket (PRD sections 52-53). Admin/staff only.
 * Uses a row lock so two simultaneous scans of the same ticket cannot
 * both succeed - the second transaction blocks until the first commits,
 * then sees status = USED and is rejected.
 */
async function verifyTicket({ ticketRef, staffUserId }) {
  const result = await withTransaction(async (client) => {
    const ticket = await ticketRepository.lockForUpdate(client, ticketRef);
    if (!ticket) throw new AppError('TICKET_NOT_FOUND', 'Ticket not found');

    if (ticket.status === 'USED') {
      throw new AppError('TICKET_ALREADY_USED', 'This ticket has already been used', {
        usedAt: ticket.used_at,
      });
    }
    if (ticket.status === 'CANCELLED') {
      throw new AppError('INVALID_TICKET', 'This ticket has been cancelled');
    }

    const updated = await ticketRepository.markUsed(client, ticket.id, staffUserId);
    return updated;
  });

  await auditService.log({
    userId: staffUserId,
    action: 'TICKET_VERIFIED',
    resourceType: 'TICKET',
    resourceId: result.id,
    metadata: { ticketRef: result.ticket_ref },
  });

  return result;
}

module.exports = { getTicket, verifyTicket };

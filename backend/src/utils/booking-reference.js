const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0,O,1,I)

function randomCode(length) {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function generateBookingReference() {
  return `SLK-${randomCode(6)}`;
}

function generateTicketId() {
  return `SLK-TICKET-${randomCode(5)}`;
}

module.exports = { generateBookingReference, generateTicketId };

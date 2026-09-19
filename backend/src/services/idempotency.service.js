const crypto = require('crypto');
const idempotencyRepository = require('../repositories/idempotency.repository');
const { AppError } = require('../utils/errors');

function hashRequest(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body || {})).digest('hex');
}

/**
 * begin(): call before processing a request that requires an Idempotency-Key.
 * - If the key was never seen: reserves it and returns { isNew: true }.
 * - If the key was seen with the SAME request body and already has a stored
 *   response: returns { isNew: false, cachedResponse }.
 * - If the key was seen with the SAME request body but is still processing
 *   (no response stored yet, e.g. a racing duplicate request): throws
 *   IDEMPOTENCY_KEY_REUSED so the client can retry, since we must not run
 *   the operation twice concurrently.
 * - If the key was seen with a DIFFERENT request body: throws
 *   IDEMPOTENCY_KEY_REUSED.
 */
async function begin({ userId, key, requestBody }) {
  if (!key) {
    throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
  }
  const requestHash = hashRequest(requestBody);

  const reserved = await idempotencyRepository.tryReserve({ userId, key, requestHash });
  if (reserved) {
    return { isNew: true, record: reserved };
  }

  // Key already exists - inspect it.
  const existing = await idempotencyRepository.find(userId, key);
  if (!existing) {
    // Expired between the failed reserve and this lookup; treat as new by retrying once.
    const retried = await idempotencyRepository.tryReserve({ userId, key, requestHash });
    if (retried) return { isNew: true, record: retried };
    throw new AppError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key is currently being processed');
  }

  if (existing.request_hash !== requestHash) {
    throw new AppError(
      'IDEMPOTENCY_KEY_REUSED',
      'This idempotency key was already used with a different request payload'
    );
  }

  if (existing.response_status == null) {
    // Same request, still in flight (concurrent duplicate submission).
    throw new AppError('IDEMPOTENCY_KEY_REUSED', 'This request is already being processed');
  }

  return {
    isNew: false,
    cachedResponse: { status: existing.response_status, body: existing.response_body },
  };
}

async function complete(record, { status, body }) {
  await idempotencyRepository.storeResponse(record.id, { responseStatus: status, responseBody: body });
}

module.exports = { begin, complete, hashRequest };

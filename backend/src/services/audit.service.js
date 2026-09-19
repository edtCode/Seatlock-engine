const auditRepository = require('../repositories/audit.repository');
const logger = require('../config/logger');

async function log(event) {
  try {
    await auditRepository.record(event);
  } catch (err) {
    // Audit logging must never break the primary request flow.
    logger.error({ err, event }, 'Failed to write audit log');
  }
}

function fromRequest(req, { action, resourceType, resourceId, metadata }) {
  return log({
    userId: req.user?.id,
    action,
    resourceType,
    resourceId,
    metadata,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
}

module.exports = { log, fromRequest };

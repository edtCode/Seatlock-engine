const eventService = require('../services/event.service');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const listEvents = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { data, total } = await eventService.searchEvents({
    q: req.query.q,
    category: req.query.category,
    city: req.query.city,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    sortBy: req.query.sortBy,
    sortDir: req.query.sortDir,
    includeAllStatuses: Boolean(req.query.includeAllStatuses),
    status: req.query.status,
    limit,
    offset,
  });
  res.status(200).json({ success: true, data, pagination: buildPaginationMeta({ page, limit, total }) });
});

const getEvent = asyncHandler(async (req, res) => {
  const event = await eventService.getEvent(req.params.eventId);
  res.status(200).json({ success: true, data: event });
});

const createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.body);
  await auditService.fromRequest(req, { action: 'EVENT_CREATED', resourceType: 'EVENT', resourceId: event.id });
  res.status(201).json({ success: true, data: event });
});

const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent(req.params.eventId, req.body);
  await auditService.fromRequest(req, { action: 'EVENT_UPDATED', resourceType: 'EVENT', resourceId: event.id, metadata: req.body });
  res.status(200).json({ success: true, data: event });
});

const deleteEvent = asyncHandler(async (req, res) => {
  await eventService.deleteEvent(req.params.eventId);
  await auditService.fromRequest(req, { action: 'EVENT_DELETED', resourceType: 'EVENT', resourceId: req.params.eventId });
  res.status(204).send();
});

const generateEventSeats = asyncHandler(async (req, res) => {
  const seats = await eventService.generateEventSeats(req.params.eventId, req.body);
  res.status(201).json({ success: true, data: seats });
});

const listEventSeats = asyncHandler(async (req, res) => {
  const seats = await eventService.listEventSeats(req.params.eventId);
  res.status(200).json({ success: true, data: seats });
});

module.exports = { listEvents, getEvent, createEvent, updateEvent, deleteEvent, generateEventSeats, listEventSeats };

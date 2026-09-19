const venueService = require('../services/venue.service');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const createVenue = asyncHandler(async (req, res) => {
  const venue = await venueService.createVenue(req.body);
  await auditService.fromRequest(req, { action: 'VENUE_CREATED', resourceType: 'VENUE', resourceId: venue.id });
  res.status(201).json({ success: true, data: venue });
});

const listVenues = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { data, total } = await venueService.listVenues({ limit, offset });
  res.status(200).json({ success: true, data, pagination: buildPaginationMeta({ page, limit, total }) });
});

const getVenue = asyncHandler(async (req, res) => {
  const venue = await venueService.getVenue(req.params.venueId);
  res.status(200).json({ success: true, data: venue });
});

const updateVenue = asyncHandler(async (req, res) => {
  const venue = await venueService.updateVenue(req.params.venueId, req.body);
  await auditService.fromRequest(req, { action: 'VENUE_UPDATED', resourceType: 'VENUE', resourceId: venue.id });
  res.status(200).json({ success: true, data: venue });
});

const deleteVenue = asyncHandler(async (req, res) => {
  await venueService.deleteVenue(req.params.venueId);
  await auditService.fromRequest(req, { action: 'VENUE_DELETED', resourceType: 'VENUE', resourceId: req.params.venueId });
  res.status(204).send();
});

module.exports = { createVenue, listVenues, getVenue, updateVenue, deleteVenue };

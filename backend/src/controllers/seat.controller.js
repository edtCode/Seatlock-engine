const venueService = require('../services/venue.service');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');

const addSeat = asyncHandler(async (req, res) => {
  const seat = await venueService.addSeat(req.params.venueId, req.body);
  res.status(201).json({ success: true, data: seat });
});

const bulkAddSeats = asyncHandler(async (req, res) => {
  const seats = await venueService.bulkAddSeats(req.params.venueId, req.body.seats);
  res.status(201).json({ success: true, data: seats });
});

const listSeats = asyncHandler(async (req, res) => {
  const seats = await venueService.listSeats(req.params.venueId);
  res.status(200).json({ success: true, data: seats });
});

const updateSeat = asyncHandler(async (req, res) => {
  const seat = await venueService.updateSeat(req.params.venueId, req.params.seatId, req.body);
  res.status(200).json({ success: true, data: seat });
});

const deleteSeat = asyncHandler(async (req, res) => {
  await venueService.deleteSeat(req.params.venueId, req.params.seatId);
  res.status(204).send();
});

module.exports = { addSeat, bulkAddSeats, listSeats, updateSeat, deleteSeat };

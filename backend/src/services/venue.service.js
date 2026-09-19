const venueRepository = require('../repositories/venue.repository');
const { AppError } = require('../utils/errors');

async function createVenue(data) {
  return venueRepository.create(data);
}

async function getVenue(id) {
  const venue = await venueRepository.findById(id);
  if (!venue) throw new AppError('VENUE_NOT_FOUND', 'Venue not found');
  return venue;
}

async function listVenues(pagination) {
  return venueRepository.list(pagination);
}

async function updateVenue(id, fields) {
  await getVenue(id);
  return venueRepository.update(id, fields);
}

async function deleteVenue(id) {
  await getVenue(id);
  await venueRepository.remove(id);
}

async function addSeat(venueId, seatData) {
  await getVenue(venueId);
  const seat = await venueRepository.createSeat({ venueId, ...seatData });
  if (!seat) throw new AppError('VALIDATION_ERROR', 'Seat already exists at this row/number for this venue');
  return seat;
}

async function bulkAddSeats(venueId, seats) {
  await getVenue(venueId);
  return venueRepository.bulkCreateSeats(venueId, seats);
}

async function listSeats(venueId) {
  await getVenue(venueId);
  return venueRepository.listSeatsByVenue(venueId);
}

async function updateSeat(venueId, seatId, fields) {
  const seat = await venueRepository.findSeatById(seatId);
  if (!seat || String(seat.venue_id) !== String(venueId)) {
    throw new AppError('SEAT_NOT_FOUND', 'Venue seat not found');
  }
  return venueRepository.updateSeat(seatId, fields);
}

async function deleteSeat(venueId, seatId) {
  const seat = await venueRepository.findSeatById(seatId);
  if (!seat || String(seat.venue_id) !== String(venueId)) {
    throw new AppError('SEAT_NOT_FOUND', 'Venue seat not found');
  }
  await venueRepository.removeSeat(seatId);
}

module.exports = {
  createVenue,
  getVenue,
  listVenues,
  updateVenue,
  deleteVenue,
  addSeat,
  bulkAddSeats,
  listSeats,
  updateSeat,
  deleteSeat,
};

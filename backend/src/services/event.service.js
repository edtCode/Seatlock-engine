const eventRepository = require('../repositories/event.repository');
const seatRepository = require('../repositories/seat.repository');
const venueRepository = require('../repositories/venue.repository');
const { redis } = require('../config/redis');
const { AppError } = require('../utils/errors');

const EVENT_CACHE_TTL_SECONDS = 60;

async function createEvent(data) {
  const venue = await venueRepository.findById(data.venueId);
  if (!venue) throw new AppError('VENUE_NOT_FOUND', 'Venue not found');
  return eventRepository.create(data);
}

async function getEvent(id, { includeAllStatuses = false } = {}) {
  const cacheKey = `event:${id}`;
  if (!includeAllStatuses) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const event = await eventRepository.findById(id);
  if (!event) throw new AppError('EVENT_NOT_FOUND', 'Event not found');
  if (!includeAllStatuses && event.status !== 'PUBLISHED') {
    throw new AppError('EVENT_NOT_FOUND', 'Event not found');
  }

  if (!includeAllStatuses) {
    await redis.set(cacheKey, JSON.stringify(event), 'EX', EVENT_CACHE_TTL_SECONDS);
  }
  return event;
}

async function searchEvents(params) {
  return eventRepository.search(params);
}

async function updateEvent(id, fields) {
  const event = await eventRepository.findById(id);
  if (!event) throw new AppError('EVENT_NOT_FOUND', 'Event not found');
  const updated = await eventRepository.update(id, fields);
  await redis.del(`event:${id}`);
  return updated;
}

async function deleteEvent(id) {
  const event = await eventRepository.findById(id);
  if (!event) throw new AppError('EVENT_NOT_FOUND', 'Event not found');
  await eventRepository.remove(id);
  await redis.del(`event:${id}`);
}

/**
 * Populate an event's seat inventory from all seats belonging to its venue,
 * with a uniform price, or per-seat-type pricing.
 */
async function generateEventSeats(eventId, { defaultPrice, pricesByType = {} }) {
  const event = await eventRepository.findById(eventId);
  if (!event) throw new AppError('EVENT_NOT_FOUND', 'Event not found');

  const venueSeats = await venueRepository.listSeatsByVenue(event.venue_id);
  const created = [];
  for (const seat of venueSeats) {
    const price = pricesByType[seat.seat_type] ?? defaultPrice;
    const eventSeat = await seatRepository.createEventSeat({
      eventId,
      venueSeatId: seat.id,
      price,
    });
    if (eventSeat) created.push(eventSeat);
  }
  return created;
}

async function listEventSeats(eventId) {
  const event = await eventRepository.findById(eventId);
  if (!event) throw new AppError('EVENT_NOT_FOUND', 'Event not found');
  const seats = await seatRepository.listByEvent(eventId);
  return seats.map((s) => ({
    seatId: String(s.id),
    row: s.row_label,
    number: s.seat_number,
    type: s.seat_type,
    price: Number(s.price),
    status: s.status,
  }));
}

module.exports = {
  createEvent,
  getEvent,
  searchEvents,
  updateEvent,
  deleteEvent,
  generateEventSeats,
  listEventSeats,
};

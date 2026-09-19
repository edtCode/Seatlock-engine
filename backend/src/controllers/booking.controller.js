const bookingService = require('../services/booking.service');
const { notificationQueue } = require('../queues/notification.queue');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const listMyBookings = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { data, total } = await bookingService.listMyBookings(req.user.id, {
    limit,
    offset,
    status: req.query.status,
  });
  res.status(200).json({ success: true, data, pagination: buildPaginationMeta({ page, limit, total }) });
});

const getBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBooking(req.params.bookingId, req.user.id, req.user.role);
  res.status(200).json({ success: true, data: booking });
});

const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(req.params.bookingId, req.user.id, req.user.role);
  await notificationQueue.add('booking-cancellation', { userId: booking.user_id, bookingId: booking.id });
  res.status(200).json({ success: true, data: booking });
});

const adminListBookings = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { data, total } = await bookingService.adminListBookings({ ...req.query, limit, offset });
  res.status(200).json({ success: true, data, pagination: buildPaginationMeta({ page, limit, total }) });
});

const adminGetBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBooking(req.params.bookingId, req.user.id, 'ADMIN');
  res.status(200).json({ success: true, data: booking });
});

module.exports = { listMyBookings, getBooking, cancelBooking, adminListBookings, adminGetBooking };

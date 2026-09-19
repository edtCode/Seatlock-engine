const userRepository = require('../repositories/user.repository');
const bookingRepository = require('../repositories/booking.repository');
const auditRepository = require('../repositories/audit.repository');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const dashboard = asyncHandler(async (req, res) => {
  const counts = await bookingRepository.dashboardCounts();
  res.status(200).json({
    success: true,
    data: {
      totalUsers: counts.total_users,
      totalEvents: counts.total_events,
      totalBookings: counts.total_bookings,
      todaysBookings: counts.today_bookings,
      totalRevenue: Number(counts.total_revenue),
      activeReservations: counts.active_reservations,
      expiredReservations: counts.expired_reservations,
      cancelledBookings: counts.cancelled_bookings,
      seatUtilization: counts.total_seats > 0 ? counts.booked_seats / counts.total_seats : 0,
    },
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { data, total } = await userRepository.list({ limit, offset });
  res.status(200).json({ success: true, data, pagination: buildPaginationMeta({ page, limit, total }) });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await userRepository.updateStatus(req.params.id, req.body.status);
  if (!user) throw new AppError('USER_NOT_FOUND', 'User not found');
  await auditService.fromRequest(req, {
    action: 'USER_DISABLED',
    resourceType: 'USER',
    resourceId: user.id,
    metadata: { status: req.body.status },
  });
  res.status(200).json({ success: true, data: user });
});

const updateUserRole = asyncHandler(async (req, res) => {
  const user = await userRepository.updateRole(req.params.id, req.body.role);
  if (!user) throw new AppError('USER_NOT_FOUND', 'User not found');
  await auditService.fromRequest(req, {
    action: 'USER_ROLE_UPDATED',
    resourceType: 'USER',
    resourceId: user.id,
    metadata: { role: req.body.role },
  });
  res.status(200).json({ success: true, data: user });
});

const auditLogs = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { data, total } = await auditRepository.list({ ...req.query, limit, offset });
  res.status(200).json({ success: true, data, pagination: buildPaginationMeta({ page, limit, total }) });
});

module.exports = { dashboard, listUsers, updateUserStatus, updateUserRole, auditLogs };

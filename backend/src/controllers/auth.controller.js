const authService = require('../services/auth.service');
const userRepository = require('../repositories/user.repository');
const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  await auditService.fromRequest(req, { action: 'USER_REGISTERED', resourceType: 'USER', resourceId: result.user.id });
  res.status(201).json({ success: true, data: result });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  await auditService.log({
    userId: result.user.id,
    action: 'USER_LOGIN',
    resourceType: 'USER',
    resourceId: result.user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(200).json({ success: true, data: result });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body);
  res.status(200).json({ success: true, data: result });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body);
  res.status(200).json({ success: true, data: { message: 'Logged out' } });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ success: true, data: user });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  res.status(200).json({ success: true, data: result });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  res.status(200).json({ success: true, data: result });
});

module.exports = { register, login, refresh, logout, me, forgotPassword, resetPassword };

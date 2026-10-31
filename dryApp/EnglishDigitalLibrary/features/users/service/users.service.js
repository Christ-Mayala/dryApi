const mongoose = require('mongoose');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const userModel = require('../model/user.model');

const ALLOWED_ROLES = ['user', 'librarian', 'admin'];

async function list(req) {
  const User = userModel.forTenant(req);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 50));
  const [users, total] = await Promise.all([
    User.find({}).select('name email role status createdAt lastLogin').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments({}),
  ]);
  return { users, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
}

async function updateRole(req, userId, role) {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw httpError('Invalid user id.', 400);
  if (!ALLOWED_ROLES.includes(role)) throw httpError('Role must be user, librarian, or admin.', 400);
  const User = userModel.forTenant(req); const user = await User.findById(userId);
  if (!user) throw httpError('User not found.', 404);
  if (user.role === 'admin' && role !== 'admin') {
    const admins = await User.countDocuments({ role: 'admin', status: { $nin: ['deleted', 'banned'] } });
    if (admins <= 1) throw httpError('The last administrator cannot be demoted.', 409);
  }
  user.role = role; await user.save();
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, status: user.status };
}

module.exports = { list, updateRole };

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ProfessionalSchema = require('../../professionals/model/professional.schema');

module.exports = asyncHandler(async (req, res) => {
  const Professional = req.getModel('Professional', ProfessionalSchema);
  const User = req.getModel('User');

  const [pros, pending, approved, rejected, usersActive, usersInactive, usersDeleted] = await Promise.all([
    Professional.countDocuments({}),
    Professional.countDocuments({ approvalStatus: 'pending' }),
    Professional.countDocuments({ approvalStatus: 'approved' }),
    Professional.countDocuments({ approvalStatus: 'rejected' }),
    User.countDocuments({ status: 'active', deleted: { $ne: true } }),
    User.countDocuments({ status: 'inactive', deleted: { $ne: true } }),
    User.countDocuments({ $or: [{ status: 'deleted' }, { deleted: true }] }),
  ]);

  return sendResponse(
    res,
    {
      professionals: pros,
      pending,
      approved,
      rejected,
      users: usersActive,
      usersActive,
      usersInactive,
      usersDeleted,
      messages: 0,
    },
    'Stats admin',
  );
});

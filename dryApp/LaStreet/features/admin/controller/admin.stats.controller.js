const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ProfessionalSchema = require('../../professionals/model/professional.schema');

module.exports = asyncHandler(async (req, res) => {
  const Professional = req.getModel('Professional', ProfessionalSchema);
  const User = req.getModel('User');

  const [pros, pending, approved, rejected, users] = await Promise.all([
    Professional.countDocuments({}),
    Professional.countDocuments({ approvalStatus: 'pending' }),
    Professional.countDocuments({ approvalStatus: 'approved' }),
    Professional.countDocuments({ approvalStatus: 'rejected' }),
    // On compte uniquement les utilisateurs actifs (les supprimés ne doivent pas gonfler les stats).
    User.countDocuments({ status: 'active', deleted: { $ne: true } }),
  ]);

  return sendResponse(
    res,
    { professionals: pros, pending, approved, rejected, users, messages: 0 },
    'Stats admin',
  );
});

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const AuditLog = require('../../../../../dry/models/AuditLog.model');

module.exports = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
  const routePrefix = '/api/v1/lastreet';

  const items = await AuditLog.find({ route: { $regex: `^${routePrefix}`, $options: 'i' } })
    .sort({ createdAt: -1 })
    .limit(limit);

  return sendResponse(res, items, 'Audits');
});

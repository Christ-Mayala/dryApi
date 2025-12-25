const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ReportSchema = require('../../reports/model/report.schema');

module.exports = asyncHandler(async (req, res) => {
  const Report = req.getModel('Report', ReportSchema);

  const status = String(req.query.status || 'open');
  const q = {};
  if (status === 'open' || status === 'resolved') q.status = status;

  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);

  const items = await Report.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('reporter', 'name email')
    .populate('targetUser', 'name email role status')
    .populate('targetProfessional', 'name ville quartier');

  return sendResponse(res, { items }, 'Signalements');
});

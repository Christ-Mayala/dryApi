const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const AuditLogSchema = require('../../../../../dry/models/audit/AuditLog.schema');

module.exports = asyncHandler(async (req, res) => {
  const AuditLog = req.getModel('AuditLog', AuditLogSchema);
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
  const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
  const skip = (page - 1) * limit;

  const routePrefix = '/api/v1/lastreet';

  const query = {
    $or: [
      { resourceType: { $regex: '^/api/v1/lastreet', $options: 'i' } },
      { tenantId: { $regex: '^lastreet', $options: 'i' } }
    ]
  };

  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query)
  ]);

  // S'assurer que chaque item a les champs attendus par le frontend
  const mappedItems = items.map(log => ({
    ...log,
    adminId: log.userId || { name: 'Système' },
    targetModel: log.resourceType || 'API',
    targetId: log.resourceId || '',
  }));

  return sendResponse(res, {
    items: mappedItems,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  }, 'Audits');
});

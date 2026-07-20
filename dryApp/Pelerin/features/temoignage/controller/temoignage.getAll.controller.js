const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const TemoignageSchema = require('../model/temoignage.schema');

// GET /temoignage — public, uniquement les temoignages approuves.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Temoignage', TemoignageSchema);
  const filter = { isApproved: true };

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

  const [data, total] = await Promise.all([
    Model.find(filter)
      .sort({ isFeatured: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Model.countDocuments(filter),
  ]);

  return sendResponse(res, data, 'Temoignages recuperes', true, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

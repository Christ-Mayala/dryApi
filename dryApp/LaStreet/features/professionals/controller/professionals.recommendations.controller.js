const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ProfessionalSchema = require('../model/professional.schema');
const TradeCategorySchema = require('../../categories/model/tradeCategory.schema');
const TradeSchema = require('../../categories/model/trade.schema');

module.exports = asyncHandler(async (req, res) => {
  req.getModel('TradeCategory', TradeCategorySchema);
  req.getModel('Trade', TradeSchema);
  const Professional = req.getModel('Professional', ProfessionalSchema);

  const limit = Math.min(parseInt(req.query.limit || '6', 10) || 6, 24);
  const ville = req.query.ville ? String(req.query.ville) : '';

  const query = { approvalStatus: 'approved' };
  if (ville) query.ville = { $regex: ville, $options: 'i' };

  const items = await Professional.find(query)
    .populate('categoryId', 'name')
    .populate('tradeId', 'name category')
    .sort({ availabilityStatus: 1, rating: -1, ratingCount: -1, createdAt: -1 })
    .limit(limit);

  return sendResponse(res, items, 'Recommandations');
});

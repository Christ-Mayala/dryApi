const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const { getPagination } = require('../../../../../dry/utils/pagination');

const ProfessionalSchema = require('../model/professional.schema');
const TradeCategorySchema = require('../../categories/model/tradeCategory.schema');
const TradeSchema = require('../../categories/model/trade.schema');

module.exports = asyncHandler(async (req, res) => {
  req.getModel('TradeCategory', TradeCategorySchema);
  req.getModel('Trade', TradeSchema);
  const Professional = req.getModel('Professional', ProfessionalSchema);

  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });

  const query = { approvalStatus: 'approved' };
  if (req.query.ville) query.ville = { $regex: String(req.query.ville), $options: 'i' };
  if (req.query.quartier) query.quartier = { $regex: String(req.query.quartier), $options: 'i' };
  if (req.query.categoryId) query.categoryId = req.query.categoryId;
  if (req.query.tradeId) query.tradeId = req.query.tradeId;
  if (req.query.q) {
    query.$or = [
      { name: { $regex: String(req.query.q), $options: 'i' } },
      { description: { $regex: String(req.query.q), $options: 'i' } },
      { telephone: { $regex: String(req.query.q), $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Professional.find(query)
      .populate('categoryId', 'name')
      .populate('tradeId', 'name category')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip),
    Professional.countDocuments(query),
  ]);

  return sendResponse(
    res,
    { items, totalPages: Math.ceil(total / limit), currentPage: page, total },
    'Liste des professionnels',
  );
});

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ProfessionalSchema = require('../model/professional.schema');
const TradeCategorySchema = require('../../categories/model/tradeCategory.schema');
const TradeSchema = require('../../categories/model/trade.schema');

module.exports = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new Error('Non autorisé');

  req.getModel('TradeCategory', TradeCategorySchema);
  req.getModel('Trade', TradeSchema);
  const Professional = req.getModel('Professional', ProfessionalSchema);

  const pro = await Professional.findOne({ createdBy: req.user._id })
    .populate('categoryId', 'name')
    .populate('tradeId', 'name category');

  if (!pro) throw new Error('Aucun profil professionnel trouvé');

  return sendResponse(res, pro, 'Mon profil professionnel');
});

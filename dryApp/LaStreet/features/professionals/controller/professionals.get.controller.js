const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ProfessionalSchema = require('../model/professional.schema');
const TradeCategorySchema = require('../../categories/model/tradeCategory.schema');
const TradeSchema = require('../../categories/model/trade.schema');

module.exports = asyncHandler(async (req, res) => {
  req.getModel('TradeCategory', TradeCategorySchema);
  req.getModel('Trade', TradeSchema);
  const Professional = req.getModel('Professional', ProfessionalSchema);

  const pro = await Professional.findById(req.params.id)
    .populate('categoryId', 'name')
    .populate('tradeId', 'name category');
  if (!pro) throw new Error('Professionnel introuvable');
  if (pro.approvalStatus !== 'approved') throw new Error('Professionnel indisponible');

  return sendResponse(res, pro, 'Profil professionnel');
});

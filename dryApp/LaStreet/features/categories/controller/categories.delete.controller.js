const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const TradeCategorySchema = require('../model/tradeCategory.schema');

module.exports = asyncHandler(async (req, res) => {
  const TradeCategory = req.getModel('TradeCategory', TradeCategorySchema);

  const { id } = req.params;
  const updated = await TradeCategory.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
  if (!updated) throw new Error('Catégorie introuvable');

  return sendResponse(res, updated, 'Catégorie désactivée');
});

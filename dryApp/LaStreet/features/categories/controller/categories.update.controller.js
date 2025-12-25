const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const TradeCategorySchema = require('../model/tradeCategory.schema');

module.exports = asyncHandler(async (req, res) => {
  const TradeCategory = req.getModel('TradeCategory', TradeCategorySchema);

  const { id } = req.params;
  const { name, order, status } = req.body || {};

  const updated = await TradeCategory.findByIdAndUpdate(
    id,
    {
      ...(name ? { name: String(name).trim() } : {}),
      ...(order !== undefined ? { order: Number(order) } : {}),
      ...(status ? { status } : {}),
    },
    { new: true },
  );

  if (!updated) throw new Error('Catégorie introuvable');
  return sendResponse(res, updated, 'Catégorie mise à jour');
});

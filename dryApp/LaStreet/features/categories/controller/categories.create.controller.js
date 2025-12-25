const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const TradeCategorySchema = require('../model/tradeCategory.schema');

module.exports = asyncHandler(async (req, res) => {
  const TradeCategory = req.getModel('TradeCategory', TradeCategorySchema);

  const { name, order } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    throw new Error('Nom de catégorie invalide');
  }

  const created = await TradeCategory.create({ name: String(name).trim(), order: Number(order || 0) });
  return sendResponse(res, created, 'Catégorie créée');
});

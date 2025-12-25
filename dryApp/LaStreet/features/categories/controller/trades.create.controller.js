const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const TradeSchema = require('../model/trade.schema');

module.exports = asyncHandler(async (req, res) => {
  const Trade = req.getModel('Trade', TradeSchema);

  const { name, categoryId, order } = req.body || {};
  if (!name || String(name).trim().length < 2) throw new Error('Nom de métier invalide');
  if (!categoryId) throw new Error('categoryId requis');

  const created = await Trade.create({ name: String(name).trim(), category: categoryId, order: Number(order || 0) });
  return sendResponse(res, created, 'Métier créé');
});

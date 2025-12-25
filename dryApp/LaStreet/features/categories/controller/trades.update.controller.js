const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const TradeSchema = require('../model/trade.schema');

module.exports = asyncHandler(async (req, res) => {
  const Trade = req.getModel('Trade', TradeSchema);

  const { id } = req.params;
  const { name, categoryId, order, status } = req.body || {};

  const updated = await Trade.findByIdAndUpdate(
    id,
    {
      ...(name ? { name: String(name).trim() } : {}),
      ...(categoryId ? { category: categoryId } : {}),
      ...(order !== undefined ? { order: Number(order) } : {}),
      ...(status ? { status } : {}),
    },
    { new: true },
  );

  if (!updated) throw new Error('Métier introuvable');
  return sendResponse(res, updated, 'Métier mis à jour');
});

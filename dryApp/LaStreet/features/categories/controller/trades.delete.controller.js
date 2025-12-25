const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const TradeSchema = require('../model/trade.schema');

module.exports = asyncHandler(async (req, res) => {
  const Trade = req.getModel('Trade', TradeSchema);

  const { id } = req.params;
  const updated = await Trade.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
  if (!updated) throw new Error('Métier introuvable');

  return sendResponse(res, updated, 'Métier désactivé');
});

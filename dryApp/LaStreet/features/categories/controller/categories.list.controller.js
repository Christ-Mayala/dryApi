const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const TradeCategorySchema = require('../model/tradeCategory.schema');
const TradeSchema = require('../model/trade.schema');

module.exports = asyncHandler(async (req, res) => {
  const TradeCategory = req.getModel('TradeCategory', TradeCategorySchema);
  const Trade = req.getModel('Trade', TradeSchema);

  const categories = await TradeCategory.find({}).sort({ order: 1, createdAt: 1 });
  const trades = await Trade.find({}).sort({ order: 1, createdAt: 1 });

  const byCat = new Map(categories.map((c) => [String(c._id), []]));
  for (const t of trades) {
    const k = String(t.category);
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k).push(t);
  }

  const data = categories.map((c) => ({
    ...c.toObject(),
    trades: byCat.get(String(c._id)) || [],
  }));

  return sendResponse(res, data, 'Liste catégories & métiers');
});

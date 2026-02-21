const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const OrdersSchema = require('../model/orders.schema');

// GET BY ID - recupere un element par ID
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Orders', OrdersSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw new Error('Orders introuvable');
  return sendResponse(res, item, 'Orders recupere');
});

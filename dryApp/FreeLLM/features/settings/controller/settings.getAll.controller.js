const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const SettingsSchema = require('../model/settings.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Settings', SettingsSchema);
  const items = await Model.find({ ...req.queryBuilder?.filter, deletedAt: null });
  return sendResponse(res, items, 'Settings liste');
});

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');

  const { id } = req.params;
  const updated = await User.findByIdAndUpdate(id, { status: 'deleted' }, { new: true });
  if (!updated) throw new Error('Utilisateur introuvable');

  return sendResponse(res, updated, 'Utilisateur supprimé');
});

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');

  const { id } = req.params;

  // Supprime l'utilisateur en synchronisant status ET deleted
  const updated = await User.findByIdAndUpdate(
      id,
      {
        status: 'deleted',
        deleted: true,
        deletedAt: new Date()
      },
      { new: true }
  );

  if (!updated) throw new Error('Utilisateur introuvable');

  return sendResponse(res, updated, 'Utilisateur supprimé');
});
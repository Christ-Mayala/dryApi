const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');

// DELETE /admin/users/:id — suppression douce (soft delete), reutilise
// UserSchema.methods.softDelete() du kernel (dry/modules/user/user.schema.js).
module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');

  if (String(req.params.id) === String(req.user.id)) {
    throw httpError('Tu ne peux pas supprimer ton propre compte depuis cet ecran', 400);
  }

  const user = await User.findById(req.params.id);
  if (!user) throw httpError('Utilisateur introuvable', 404);

  await user.softDelete();

  return sendResponse(res, null, 'Utilisateur supprime');
});

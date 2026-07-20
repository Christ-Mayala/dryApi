const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');

// PUT /admin/users/:id/role — promeut/retrograde un utilisateur Pelerin.
// Seuls 'user' et 'admin' ont un sens dans ce tenant (pas de client/prestataire
// comme dans d'autres apps dryApi partageant le meme schema User).
const ALLOWED_ROLES = ['user', 'admin'];

module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');
  const { role } = req.body;

  if (!ALLOWED_ROLES.includes(role)) {
    throw httpError(`Role invalide : attendu 'user' ou 'admin'`, 400);
  }

  if (String(req.params.id) === String(req.user.id) && role !== 'admin') {
    throw httpError('Tu ne peux pas retirer ton propre role admin', 400);
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select(
    'name email role status createdAt lastLogin',
  );
  if (!user) throw httpError('Utilisateur introuvable', 404);

  return sendResponse(res, user, 'Role mis a jour');
});

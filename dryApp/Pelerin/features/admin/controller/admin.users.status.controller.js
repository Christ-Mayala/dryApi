const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');

// PUT /admin/users/:id/status — suspend ('banned') ou reactive ('active') un
// compte. Le middleware kernel `protect` (dry/middlewares/protection/auth.middleware.js)
// verifie deja `status !== 'banned'` a CHAQUE requete (lookup DB frais, sans
// cache) : suspendre un compte revoque donc l'acces des la prochaine requete,
// bien en-deca des 60 secondes exigees — aucune modification du kernel requise.
const ALLOWED_STATUSES = ['active', 'banned'];

module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');
  const { status } = req.body;

  if (!ALLOWED_STATUSES.includes(status)) {
    throw httpError(`Statut invalide : attendu 'active' ou 'banned'`, 400);
  }

  if (String(req.params.id) === String(req.user.id) && status === 'banned') {
    throw httpError('Tu ne peux pas suspendre ton propre compte', 400);
  }

  const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select(
    'name email role status createdAt lastLogin',
  );
  if (!user) throw httpError('Utilisateur introuvable', 404);

  return sendResponse(res, user, status === 'banned' ? 'Compte suspendu' : 'Compte réactivé');
});

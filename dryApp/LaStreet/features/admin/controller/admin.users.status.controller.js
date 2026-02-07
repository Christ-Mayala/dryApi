const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

// Admin: activer/désactiver/restaurer un utilisateur.
// Règles:
// - status=active => compte actif et non supprimé
// - status=inactive => compte désactivé (non supprimé)
// - restore=true (ou status=active) réactive aussi deleted=false si besoin

module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');

  const { id } = req.params;

  const rawStatus = String(req.body?.status || '').trim().toLowerCase();
  const restore = Boolean(req.body?.restore);

  const status = rawStatus || (restore ? 'active' : '');

  if (!status || !['active', 'inactive'].includes(status)) {
    throw new Error('Statut invalide');
  }

  const updates = { status };

  if (status === 'active') {
    updates.deleted = false;
    updates.deletedAt = null;
  }

  const updated = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
  if (!updated) throw new Error('Utilisateur introuvable');

  return sendResponse(res, updated, 'Utilisateur mis à jour');
});

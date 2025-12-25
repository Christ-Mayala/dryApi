const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const { isValidObjectId } = require('../../../../../dry/utils/ids');

const ReportSchema = require('../model/report.schema');
const ProfessionalSchema = require('../../professionals/model/professional.schema');

module.exports = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new Error('Non autorisé');

  const { professionalId, targetUserId, reason, message } = req.body || {};
  if (!reason) throw new Error('Motif requis');

  const Report = req.getModel('Report', ReportSchema);
  const User = req.getModel('User');

  let resolvedTargetUserId = null;
  let resolvedProfessionalId = null;

  if (professionalId) {
    if (!isValidObjectId(professionalId)) throw new Error('professionalId invalide');
    const Professional = req.getModel('Professional', ProfessionalSchema);
    const pro = await Professional.findById(professionalId);
    if (!pro) throw new Error('Professionnel introuvable');
    if (!pro.createdBy) throw new Error('Profil sans propriétaire');
    resolvedTargetUserId = String(pro.createdBy);
    resolvedProfessionalId = String(pro._id);
  } else if (targetUserId) {
    if (!isValidObjectId(targetUserId)) throw new Error('targetUserId invalide');
    resolvedTargetUserId = String(targetUserId);
  } else {
    throw new Error('Cible requise');
  }

  if (String(resolvedTargetUserId) === String(req.user._id)) throw new Error('Impossible de signaler votre propre profil');

  const target = await User.findById(resolvedTargetUserId);
  if (!target) throw new Error('Utilisateur introuvable');

  const created = await Report.create({
    reporter: req.user._id,
    targetUser: resolvedTargetUserId,
    targetProfessional: resolvedProfessionalId,
    reason,
    message: message ? String(message).trim() : '',
  });

  return sendResponse(res, created, 'Signalement envoyé');
});

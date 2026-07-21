const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/trivida/intel/profile
// Retourne l'IntelProfile de l'utilisateur connecté
// ─────────────────────────────────────────────────────────────────────────────
exports.getProfile = asyncHandler(async (req, res) => {
  const User = req.getModel('User');
  const user = await User.findById(req.user._id).select('intelProfile').lean();

  if (!user) throw httpError('Utilisateur introuvable', 404);

  return sendResponse(
    res,
    user.intelProfile || null,
    'Profil Intel récupéré'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/trivida/intel/profile
// Crée ou met à jour l'IntelProfile de l'utilisateur connecté
// ─────────────────────────────────────────────────────────────────────────────
exports.upsertProfile = asyncHandler(async (req, res) => {
  const User = req.getModel('User');
  const { mainGoal, blockers, monthlyTargetAmount, habits } = req.body;

  // Validation obligatoire
  if (!mainGoal) {
    throw httpError('Le champ mainGoal est obligatoire', 400);
  }
  if (monthlyTargetAmount === undefined || monthlyTargetAmount === null) {
    throw httpError('Le champ monthlyTargetAmount est obligatoire', 400);
  }
  if (typeof monthlyTargetAmount !== 'number' || monthlyTargetAmount <= 0) {
    throw httpError('monthlyTargetAmount doit être un nombre positif supérieur à 0', 400);
  }

  const validGoals = ['maison', 'voiture', 'voyage', 'entreprise', 'emploi', 'etudes', 'general'];
  if (!validGoals.includes(mainGoal)) {
    throw httpError(`mainGoal invalide. Valeurs acceptées : ${validGoals.join(', ')}`, 400);
  }

  const intelProfile = {
    mainGoal,
    blockers: Array.isArray(blockers) ? blockers : [],
    monthlyTargetAmount,
    habits: Array.isArray(habits) ? habits : [],
    updatedAt: new Date(),
  };

  // Récupérer le profil existant pour conserver createdAt
  const existing = await User.findById(req.user._id).select('intelProfile').lean();
  if (existing?.intelProfile?.createdAt) {
    intelProfile.createdAt = existing.intelProfile.createdAt;
  } else {
    intelProfile.createdAt = new Date();
  }

  // Mise à jour atomique sur le champ intelProfile embedded
  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { intelProfile } },
    { new: true, select: 'intelProfile' }
  );

  if (!updated) throw httpError('Utilisateur introuvable', 404);

  return sendResponse(res, updated.intelProfile, 'Profil Intel mis à jour');
});

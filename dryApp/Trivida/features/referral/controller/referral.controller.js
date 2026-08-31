/**
 * Referral Controller — Programme de parrainage Trivida
 *
 * Endpoints :
 *   GET  /referral/code          → Obtenir ou générer le code de parrainage
 *   GET  /referral/stats         → Statistiques du parrainage (nb invités, inscrits, récompenses)
 *   POST /referral/validate      → Valider un code de parrainage (inscription)
 *   POST /referral/reward        → Activer la récompense quand le filleul atteint le seuil
 */
const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');

// ─── IMPORTS DES SCHÉMAS ─────────────────────────────────────────────────
const ReferralSchema = require('../model/referral.schema');

// ─── UTILITAIRES ──────────────────────────────────────────────────────────

/**
 * Générer un code de parrainage unique (6 caractères alphanumériques)
 */
function generateReferralCode(name) {
  const prefix = (name || 'TRI').replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 pour éviter la confusion
  let code = prefix;
  for (let i = 0; i < 6 - prefix.length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Obtenir le modèle Referral
 */
function getReferralModel(req) {
  try {
    return req.getModel('TrividaReferral', ReferralSchema);
  } catch (e) {
    console.error('[Referral] Modèle non trouvé:', e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /referral/code
 * Retourne le code de parrainage de l'utilisateur (ou en génère un nouveau)
 */
exports.getMyCode = asyncHandler(async (req, res) => {
  const Referral = getReferralModel(req);
  if (!Referral) throw httpError('Service de parrainage indisponible', 503);
  
  const userId = req.user._id;
  const userEmail = req.user.email;
  const userName = req.user.name || 'TRI';
  
  // Chercher un code existant pour cet utilisateur
  let referral = await Referral.findOne({ referrerId: userId, deleted: { $ne: true } });
  
  if (!referral) {
    // Générer un code unique
    let code;
    let attempts = 0;
    do {
      code = generateReferralCode(userName);
      attempts++;
    } while (
      await Referral.findOne({ referralCode: code }) && attempts < 10
    );
    
    if (attempts >= 10) {
      // Fallback : code aléatoire pur
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      code = 'TRI';
      for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    referral = await Referral.create({
      referrerId: userId,
      referrerEmail: userEmail,
      referralCode: code,
    });
  }
  
  // Compter les stats
  const [totalInvited, totalRegistered, totalRewarded] = await Promise.all([
    Referral.countDocuments({ referrerId: userId, deleted: { $ne: true } }),
    Referral.countDocuments({ referrerId: userId, status: { $in: ['completed', 'rewarded'] }, deleted: { $ne: true } }),
    Referral.countDocuments({ referrerId: userId, status: 'rewarded', deleted: { $ne: true } }),
  ]);
  
  sendResponse(res, {
    code: referral.referralCode,
    totalInvited,
    totalRegistered,
    totalRewarded,
    premiumDaysEarned: totalRewarded * 7, // 7 jours Premium par filleul actif
  }, 'Code de parrainage');
});

/**
 * GET /referral/stats
 * Statistiques détaillées du parrainage
 */
exports.getStats = asyncHandler(async (req, res) => {
  const Referral = getReferralModel(req);
  if (!Referral) throw httpError('Service de parrainage indisponible', 503);
  
  const userId = req.user._id;
  
  const referrals = await Referral.find({ referrerId: userId, deleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .lean();
  
  const stats = {
    totalInvited: referrals.length,
    pending: referrals.filter(r => r.status === 'pending').length,
    completed: referrals.filter(r => r.status === 'completed').length,
    rewarded: referrals.filter(r => r.status === 'rewarded').length,
    premiumDaysEarned: referrals.filter(r => r.status === 'rewarded').length * 7,
    referrals: referrals.map(r => ({
      email: r.referredEmail || r.referrerEmail,
      status: r.status,
      invitedAt: r.invitedAt,
      registeredAt: r.registeredAt,
      channel: r.channel,
    })),
  };
  
  sendResponse(res, stats, 'Statistiques de parrainage');
});

/**
 * POST /referral/validate
 * Valider un code de parrainage (appelé lors de l'inscription d'un filleul)
 * Body: { code: string }
 */
exports.validateCode = asyncHandler(async (req, res) => {
  const Referral = getReferralModel(req);
  if (!Referral) throw httpError('Service de parrainage indisponible', 503);
  
  const { code } = req.body;
  const userId = req.user._id;
  const userEmail = req.user.email;
  
  if (!code || code.trim().length < 4) {
    throw httpError('Code de parrainage invalide', 400);
  }
  
  const normalizedCode = code.trim().toUpperCase();
  
  // Trouver le parrain
  const referral = await Referral.findOne({ referralCode: normalizedCode, deleted: { $ne: true } });
  if (!referral) {
    throw httpError('Code de parrainage introuvable', 404);
  }
  
  // Vérifier que l'utilisateur ne parraine pas lui-même
  if (String(referral.referrerId) === String(userId)) {
    throw httpError('Vous ne pouvez pas utiliser votre propre code', 400);
  }
  
  // Vérifier que l'utilisateur n'a pas déjà été parrainé
  const alreadyReferred = await Referral.findOne({ referredUserId: userId, deleted: { $ne: true } });
  if (alreadyReferred) {
    throw httpError('Vous avez déjà utilisé un code de parrainage', 400);
  }
  
  // Enregistrer le parrainage
  referral.referredUserId = userId;
  referral.referredEmail = userEmail;
  referral.status = 'completed';
  referral.registeredAt = new Date();
  await referral.save();
  
  // Créer une récompense pour le filleul (3 jours Premium)
  const REWARD_DAYS_NEW_USER = 3;
  const User = req.getModel('User');
  try {
    const user = await User.findById(userId);
    if (user) {
      user.isPremium = true;
      user.premiumPlan = 'premium';
      const currentExpiry = user.premiumUntil && new Date(user.premiumUntil) > new Date() 
        ? new Date(user.premiumUntil) 
        : new Date();
      user.premiumUntil = new Date(currentExpiry.getTime() + REWARD_DAYS_NEW_USER * 24 * 60 * 60 * 1000);
      await user.save();
    }
  } catch (e) {
    console.warn('[Referral] Impossible de give premium au filleul:', e.message);
  }
  
  sendResponse(res, {
    referrerName: req.user.name || 'Votre ami',
    rewardDays: REWARD_DAYS_NEW_USER,
    message: `Bienvenue ! Vous recevez ${REWARD_DAYS_NEW_USER} jours Premium grâce à votre parrainage.`,
  }, 'Code de parrainage validé');
});

/**
 * POST /referral/reward
 * Activer la récompense du parrain quand le filleul atteint un seuil d'activité
 * (5 transactions enregistrées = parrain récompensé)
 * Body: { referredUserId: string }
 */
exports.activateReward = asyncHandler(async (req, res) => {
  const Referral = getReferralModel(req);
  if (!Referral) throw httpError('Service de parrainage indisponible', 503);
  
  const { referredUserId } = req.body;
  
  // Trouver le referral pour ce filleul
  const referral = await Referral.findOne({ 
    referredUserId, 
    status: 'completed',
    deleted: { $ne: true } 
  });
  
  if (!referral) {
    return sendResponse(res, null, 'Pas de parrainage en attente');
  }
  
  // Vérifier que le filleul a au moins 5 transactions
  const TransactionSchema = require('../../transaction/model/transaction.schema');
  let txCount = 0;
  try {
    const TxModel = req.getModel('TrividaTransaction', TransactionSchema);
    txCount = await TxModel.countDocuments({ userId: referredUserId, deleted: { $ne: true } });
  } catch (e) {
    return sendResponse(res, null, 'Impossible de vérifier les transactions');
  }
  
  const ACTIVITY_THRESHOLD = 5;
  if (txCount < ACTIVITY_THRESHOLD) {
    return sendResponse(res, { txCount, threshold: ACTIVITY_THRESHOLD }, 'Seuil pas encore atteint');
  }
  
  // Récompenser le parrain (7 jours Premium)
  const REWARD_DAYS_REFERRER = 7;
  const User = req.getModel('User');
  
  try {
    const referrer = await User.findById(referral.referrerId);
    if (referrer) {
      referrer.isPremium = true;
      referrer.premiumPlan = 'premium';
      const currentExpiry = referrer.premiumUntil && new Date(referrer.premiumUntil) > new Date()
        ? new Date(referrer.premiumUntil)
        : new Date();
      referrer.premiumUntil = new Date(currentExpiry.getTime() + REWARD_DAYS_REFERRER * 24 * 60 * 60 * 1000);
      await referrer.save();
    }
  } catch (e) {
    console.warn('[Referral] Impossible de give premium au parrain:', e.message);
  }
  
  // Mettre à jour le statut
  referral.status = 'rewarded';
  referral.referrerReward = REWARD_DAYS_REFERRER;
  referral.referredReward = 3;
  referral.rewardType = 'premium_days';
  referral.rewardedAt = new Date();
  await referral.save();
  
  sendResponse(res, {
    referrerId: referral.referrerId,
    referredUserId,
    rewardDays: REWARD_DAYS_REFERRER,
    message: `Parrain récompensé ! +${REWARD_DAYS_REFERRER} jours Premium.`,
  }, 'Récompense activée');
});

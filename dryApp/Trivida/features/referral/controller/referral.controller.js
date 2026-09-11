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
    aiRequestsEarned: totalRewarded, // +1 requête IA par filleul actif
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
    premiumDaysEarned: referrals.filter(r => r.status === 'rewarded').length * 1,
    aiRequestsEarned: referrals.filter(r => r.status === 'rewarded').length, // +1 requête IA par filleul actif
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
 * GET /referral/validate (public — ?code=XXX)
 * Point d'arrivée du lien partagé : valide un code et renvoie les infos du
 * parrain, sans authentification. Purement informatif (aucune attribution) —
 * la validation réelle s'effectue via POST /referral/validate lors de
 * l'inscription dans l'application.
 */
exports.getReferralInfo = asyncHandler(async (req, res) => {
  const Referral = getReferralModel(req);
  if (!Referral) throw httpError('Service de parrainage indisponible', 503);

  const { code } = req.query;
  const normalizedCode = (code || '').trim().toUpperCase();

  if (normalizedCode.length < 4) {
    throw httpError('Code de parrainage invalide', 400);
  }

  const referral = await Referral.findOne({ referralCode: normalizedCode, deleted: { $ne: true } }).lean();
  if (!referral) {
    throw httpError('Code de parrainage introuvable', 404);
  }

  let referrerName = 'Un ami';
  try {
    const User = req.getModel('User');
    const referrer = await User.findById(referral.referrerId).select('name').lean();
    if (referrer?.name) referrerName = referrer.name;
  } catch (e) {
    // Silencieux — on affiche « Un ami » en secours
  }

  const payload = {
    code: normalizedCode,
    valid: true,
    referrerName,
    message: `Rejoins Trivida avec le code ${normalizedCode} et gagne des requêtes IA gratuites !`,
  };

  // Clic depuis un navigateur → petite page de présentation lisible
  // (l'app consomme le JSON ; l'humain consomme l'HTML).
  const acceptsHtml = (req.headers.accept || '').includes('text/html');
  if (acceptsHtml) {
    const deepLink = `trivida://open?code=${normalizedCode}`;
    const storePackage = 'com.christ_mayala.trivida';
    const storeUrl = `https://play.google.com/store/apps/details?id=${storePackage}&referrer=utm_source%3Dreferral%26utm_campaign%3D${normalizedCode}`;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trivida — Invitation</title>
<style>
  body{margin:0;font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,#0A1F16,#006B4D 60%,#00A876);min-height:100vh;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center}
  .card{padding:40px 24px;max-width:440px}
  .logo{font-size:44px;font-weight:900;letter-spacing:1px}
  .sub{opacity:.85;margin-top:10px;font-size:17px;line-height:1.5}
  .code{margin:26px auto;padding:16px;background:rgba(255,255,255,.14);border:1px dashed rgba(255,255,255,.5);border-radius:14px;font-size:26px;font-weight:800;letter-spacing:4px;max-width:280px}
  .btns{display:flex;flex-direction:column;gap:12px;margin-top:8px;align-items:stretch}
  .btn{display:block;padding:15px 30px;background:#FFD54F;color:#12281F;font-weight:800;border-radius:999px;text-decoration:none;font-size:16px}
  .btn.ghost{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35)}
  .small{margin-top:18px;font-size:13px;opacity:.7}
</style></head>
<body><div class="card">
  <div class="logo">Trivida</div>
  <div class="sub">${referrerName.replace(/[<>&"']/g, '')} t'invite à prendre le contrôle de tes finances.</div>
  <div class="code">${normalizedCode}</div>
  <div class="btns">
    <a class="btn" href="${deepLink}">Ouvrir Trivida</a>
    <a class="btn ghost" href="${storeUrl}">Installer Trivida (Play Store)</a>
  </div>
  <div class="small">Code valide : 1 requête IA gratuite pour ton filleul comme pour toi.</div>
</div></body></html>`;
    return res.type('html').send(html);
  }

  sendResponse(res, payload, 'Code de parrainage valide');
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
  
  // Récompense immédiate pour le filleul : +1 requête IA (bonus permanent)
  const REWARD_AI_REQUESTS_NEW_USER = 1;
  const User = req.getModel('User');
  try {
    await User.findByIdAndUpdate(
      userId,
      { $inc: { aiBonusRequests: REWARD_AI_REQUESTS_NEW_USER } },
      { new: true }
    );
  } catch (e) {
    console.warn('[Referral] Impossible d’ajouter le bonus IA au filleul:', e.message);
  }
  
  sendResponse(res, {
    referrerName: req.user.name || 'Votre ami',
    rewardAiRequests: REWARD_AI_REQUESTS_NEW_USER,
    message: `Bienvenue ! Vous recevez +${REWARD_AI_REQUESTS_NEW_USER} requête IA gratuite grâce à votre parrainage.`,
  }, 'Code de parrainage validé');
});

/**
 * Helper — Vérifier et activer la récompense du parrain d'un filleul donné.
 * Appelé automatiquement par le sync push quand des transactions sont insérées.
 * Ne lève jamais d'erreur (fire-and-forget).
 */
exports.maybeActivateRewardForUser = async function (referredUserId) {
  try {
    // Accès direct aux modèles Trivida (hors cycle request) via la fabrique tenant.
    // Ne PAS utiliser mongoose.model() : les modèles Trivida sont compilés sur la
    // connexion dédiée (TrividaDB via useDb), pas sur la connexion par défaut.
    const getModel = require('../../../../../dry/core/factories/modelFactory');
    const ReferralSchema = require('../model/referral.schema');
    const TransactionSchema = require('../../transaction/model/transaction.schema');

    let Referral, TxModel, User;
    try {
      Referral = getModel('Trivida', 'TrividaReferral', ReferralSchema);
      TxModel = getModel('Trivida', 'TrividaTransaction', TransactionSchema);
      User = getModel('Trivida', 'User');
    } catch (e) {
      return; // connexion cluster pas encore prête (serveur froid) — silencieux
    }

    const referral = await Referral.findOne({
      referredUserId,
      status: 'completed',
      deleted: { $ne: true },
    }).lean();
    if (!referral) return; // ce user n'est pas un filleul en attente de récompense

    const txCount = await TxModel.countDocuments({ userId: referredUserId, deleted: { $ne: true } });
    const ACTIVITY_THRESHOLD = 5;
    if (txCount < ACTIVITY_THRESHOLD) return;

    // Seuil atteint → récompenser le parrain (+1 requête IA)
    const REWARD_AI_REQUESTS_REFERRER = 1;
    await User.findByIdAndUpdate(
      referral.referrerId,
      { $inc: { aiBonusRequests: REWARD_AI_REQUESTS_REFERRER } }
    );

    await Referral.updateOne(
      { _id: referral._id },
      {
        $set: {
          status: 'rewarded',
          referrerReward: REWARD_AI_REQUESTS_REFERRER,
          referredReward: REWARD_AI_REQUESTS_REFERRER,
          rewardType: 'ai_requests',
          rewardedAt: new Date(),
        },
      }
    );
    console.log(`🎁 [Referral] Parrain ${referral.referrerId} récompensé (+${REWARD_AI_REQUESTS_REFERRER} requête IA) via filleul ${referredUserId} (${txCount} transactions)`);
  } catch (e) {
    console.warn('[Referral] maybeActivateRewardForUser:', e.message);
  }
};

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
  
  // Récompenser le parrain : +1 requête IA (bonus permanent)
  const REWARD_AI_REQUESTS_REFERRER = 1;
  const User = req.getModel('User');
  
  try {
    await User.findByIdAndUpdate(
      referral.referrerId,
      { $inc: { aiBonusRequests: REWARD_AI_REQUESTS_REFERRER } },
      { new: true }
    );
  } catch (e) {
    console.warn('[Referral] Impossible d’ajouter le bonus IA au parrain:', e.message);
  }
  
  // Mettre à jour le statut
  referral.status = 'rewarded';
  referral.referrerReward = REWARD_AI_REQUESTS_REFERRER;
  referral.referredReward = REWARD_AI_REQUESTS_REFERRER;
  referral.rewardType = 'ai_requests';
  referral.rewardedAt = new Date();
  await referral.save();
  
  sendResponse(res, {
    referrerId: referral.referrerId,
    referredUserId,
    rewardAiRequests: REWARD_AI_REQUESTS_REFERRER,
    message: `Parrain récompensé ! +${REWARD_AI_REQUESTS_REFERRER} requête IA gratuite.`,
  }, 'Récompense activée');
});

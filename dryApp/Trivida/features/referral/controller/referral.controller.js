/**
 * Referral Controller — Programme de parrainage Trivida
 *
 * Endpoints :
 *   GET  /referral/validate?code=XXX  → (public) info du code, AUCUNE attribution
 *   GET  /referral/code               → Obtenir ou générer son code de parrainage
 *   GET  /referral/stats              → Statistiques de parrainage (sans emails)
 *   POST /referral/claim              → (protect) réclamer la récompense du CODE
 *   POST /referral/validate           → (protect) alias idempotent de /claim (compat frontend)
 *   POST /referral/reward             → activer la récompense du parrain (idempotent)
 *
 * Sécurité (audit 12/09/2026) :
 *   - L'identité vient TOUJOURS du token (req.user), jamais du body.
 *   - Idempotence garantie au niveau base par l'index unique partiel
 *     { referredUserId } (E11000 → 409 REFERRAL_ALREADY_CLAIMED) et par des
 *     mises à jour atomiques conditionnelles ($inc protégé par flag).
 *   - Récompenses et seuil centralisés dans config/database.js (env).
 *   - Codes d'erreur métier stables exposés via err.apiCode → data.code.
 */
const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const config = require('../../../../../config/database');

// ─── IMPORTS DES SCHÉMAS ─────────────────────────────────────────────────
const ReferralSchema = require('../model/referral.schema');

// Récompenses / seuil centralisés (config/database.js, surchargeables par env)
const REWARD_NEW_USER = config.REFERRAL.rewardNewUser;
const REWARD_REFERRER = config.REFERRAL.rewardReferrer;
const ACTIVITY_THRESHOLD = config.REFERRAL.activityThreshold;

// ─── CODES D'ERREUR MÉTIER ────────────────────────────────────────────────
const E = {
  REFERRAL_CODE_REQUIRED: 'REFERRAL_CODE_REQUIRED',
  REFERRAL_CODE_INVALID: 'REFERRAL_CODE_INVALID',
  REFERRAL_CODE_INACTIVE: 'REFERRAL_CODE_INACTIVE',
  REFERRAL_SELF_REFERRAL: 'REFERRAL_SELF_REFERRAL',
  REFERRAL_ALREADY_CLAIMED: 'REFERRAL_ALREADY_CLAIMED',
  REFERRAL_REWARD_ALREADY_GRANTED: 'REFERRAL_REWARD_ALREADY_GRANTED',
  REFERRAL_SERVICE_UNAVAILABLE: 'REFERRAL_SERVICE_UNAVAILABLE',
};

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

/**
 * Récupère le modèle User Trivida (schéma générique, champ aiBonusRequests)
 */
function getTrividaUserModel(req) {
  return req.getModel('User');
}

/**
 * Normalise un code de parrainage (uppercase + trim)
 */
function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

/**
 * Conversion de l'erreur d'index unique (E11000 sur referredUserId) → 409 métier.
 */
function toAlreadyClaimedError(err) {
  const key = err?.keyValue ? Object.keys(err.keyValue)[0] : null;
  if (err?.code === 11000 && key === 'referredUserId') {
    return httpError('Vous avez déjà utilisé un code de parrainage.', 409, E.REFERRAL_ALREADY_CLAIMED);
  }
  return err;
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
  if (!Referral) throw httpError('Service de parrainage indisponible', 503, E.REFERRAL_SERVICE_UNAVAILABLE);

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
      await Referral.findOne({ referralCode: code, deleted: { $ne: true } }) && attempts < 10
    );

    if (attempts >= 10) {
      // Fallback : code aléatoire pur
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      code = 'TRI';
      for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    try {
      referral = await Referral.create({
        referrerId: userId,
        referrerEmail: userEmail,
        referralCode: code,
      });
    } catch (e) {
      if (e?.code === 11000 && Object.keys(e.keyValue || {})[0] === 'referralCode') {
        // Collision très rare de code → rèessayer une fois avec un code pur
        referral = await Referral.create({
          referrerId: userId,
          referrerEmail: userEmail,
          referralCode: `TRI${chars.charAt(Math.floor(Math.random() * chars.length))}${chars.charAt(Math.floor(Math.random() * chars.length))}${chars.charAt(Math.floor(Math.random() * chars.length))}${chars.charAt(Math.floor(Math.random() * chars.length))}`,
        });
      } else {
        throw e;
      }
    }
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
    aiRequestsEarned: totalRewarded * REWARD_REFERRER,
    // Valeurs de référence (issues de la config serveur, plus de hardcode frontend)
    rewardPerReferral: REWARD_REFERRER,
    activityThreshold: ACTIVITY_THRESHOLD,
  }, 'Code de parrainage');
});

/**
 * GET /referral/stats
 * Statistiques détaillées du parrainage (AVEC privacy : pas d'emails)
 */
exports.getStats = asyncHandler(async (req, res) => {
  const Referral = getReferralModel(req);
  if (!Referral) throw httpError('Service de parrainage indisponible', 503, E.REFERRAL_SERVICE_UNAVAILABLE);

  const userId = req.user._id;

  const referrals = await Referral.find({ referrerId: userId, deleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .lean();

  const stats = {
    totalInvited: referrals.length,
    pending: referrals.filter(r => r.status === 'pending').length,
    completed: referrals.filter(r => r.status === 'completed').length,
    rewarded: referrals.filter(r => r.status === 'rewarded').length,
    premiumDaysEarned: referrals.filter(r => r.status === 'rewarded').length * REWARD_REFERRER,
    aiRequestsEarned: referrals.filter(r => r.status === 'rewarded').length * REWARD_REFERRER,
    // Privacy : on n'expose PAS les emails (aucune donnée PII dans /stats)
    referrals: referrals.map(r => ({
      status: r.status,
      invitedAt: r.invitedAt,
      registeredAt: r.registeredAt,
      rewardedAt: r.rewardedAt,
      channel: r.channel,
    })),
  };

  sendResponse(res, stats, 'Statistiques de parrainage');
});

/**
 * GET /referral/validate (public — ?code=XXX)
 * Point d'arrivée du lien partagé : valide un code et renvoie les infos du
 * parrain, sans authentification. STRICTEMENT INFORMATIF — aucune attribution,
 * aucun crédit, aucune mutation. La réclamation passe par POST /referral/claim.
 */
exports.getReferralInfo = asyncHandler(async (req, res) => {
  const Referral = getReferralModel(req);
  if (!Referral) throw httpError('Service de parrainage indisponible', 503, E.REFERRAL_SERVICE_UNAVAILABLE);

  const normalizedCode = normalizeCode(req.query.code);

  if (normalizedCode.length < 4) {
    throw httpError('Code de parrainage invalide.', 400, E.REFERRAL_CODE_INVALID);
  }

  const referral = await Referral.findOne({ referralCode: normalizedCode, deleted: { $ne: true } }).lean();
  if (!referral) {
    throw httpError('Code de parrainage introuvable.', 404, E.REFERRAL_CODE_INVALID);
  }
  if (referral.active === false) {
    throw httpError('Code de parrainage inactif.', 400, E.REFERRAL_CODE_INACTIVE);
  }

  let referrerName = 'Un ami';
  try {
    const User = getTrividaUserModel(req);
    const referrer = await User.findById(referral.referrerId).select('name').lean();
    if (referrer?.name) referrerName = referrer.name;
  } catch (e) {
    // Silencieux — on affiche « Un ami » en secours
  }

  const payload = {
    code: normalizedCode,
    valid: true,
    active: referral.active !== false,
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
  <div class="small">Code valide : ${REWARD_NEW_USER} requête IA gratuite pour ton filleul comme pour toi.</div>
</div></body></html>`;
    return res.type('html').send(html);
  }

  sendResponse(res, payload, 'Code de parrainage valide');
});

/**
 * POST /referral/claim (protect)
 * Réclamer la récompense de parrainage pour un code.
 * Body: { code: string }
 *
 * Sécurité & idempotence :
 *   - Le userId vient du token (req.user._id), jamais du body.
 *   - 7 vérifications en séquence (voir code).
 *   - Attribution atomique via updateOne conditionnel sur status + referredUserId null.
 *   - Double-claim rendu impossible par l'index unique partiel { referredUserId }
 *     (E11000 → 409 REFERRAL_ALREADY_CLAIMED), y compris en requêtes simultanées.
 *   - Réponse idempotente : si le code a déjà été attaché à CET utilisateur,
 *     on renvoie déjàClaimed:true sans re-créditer (retry réseau sûr).
 */
exports.claimReferral = asyncHandler(async (req, res) => {
  const Referral = getReferralModel(req);
  if (!Referral) throw httpError('Service de parrainage indisponible', 503, E.REFERRAL_SERVICE_UNAVAILABLE);

  const { code } = req.body;
  if (!code || typeof code !== 'string' || !code.trim()) {
    throw httpError('Le code de parrainage est requis.', 400, E.REFERRAL_CODE_REQUIRED);
  }

  const normalizedCode = normalizeCode(code);
  const userId = req.user._id;
  const userEmail = req.user.email;

  if (normalizedCode.length < 4) {
    throw httpError('Code de parrainage invalide.', 400, E.REFERRAL_CODE_INVALID);
  }

  // 1. Le code existe-t-il ?
  const referral = await Referral.findOne({ referralCode: normalizedCode, deleted: { $ne: true } });
  if (!referral) {
    throw httpError('Code de parrainage introuvable.', 404, E.REFERRAL_CODE_INVALID);
  }

  // 2. Le code est-il actif ?
  if (referral.active === false) {
    throw httpError('Code de parrainage inactif.', 400, E.REFERRAL_CODE_INACTIVE);
  }

  // 3. L'utilisateur ne se parraine pas lui-même.
  if (String(referral.referrerId) === String(userId)) {
    throw httpError('Vous ne pouvez pas utiliser votre propre code.', 400, E.REFERRAL_SELF_REFERRAL);
  }

  // 4. Idempotence : ce code est déjà rattaché à CET utilisateur ?
  //    (retry réseau après un claim réussi → pas de double crédit, réponse OK)
  if (referral.referredUserId && String(referral.referredUserId) === String(userId)) {
    return sendResponse(res, {
      code: normalizedCode,
      alreadyClaimed: true,
      rewardAiRequests: referral.referredReward || REWARD_NEW_USER,
      referrerName: req.user.name || 'Votre ami',
      message: 'Vous utilisez déjà ce code de parrainage.',
    }, 'Code de parrainage déjà validé');
  }

  // 5. Ce code est déjà été utilisé par un AUTRE filleul ?
  if (referral.referredUserId) {
    throw httpError('Ce code de parrainage a déjà été utilisé.', 409, E.REFERRAL_ALREADY_CLAIMED);
  }

  // 6. L'utilisateur a-t-il DÉJÀ un parrainage actif (par un autre code) ?
  //    Deux requêtes simultanées ici sont possibles → l'index unique partiel
  //    referrUserId joue le rôle de verrou final en cas de course.
  const existingClaim = await Referral.findOne({
    referredUserId: userId,
    status: { $in: ['completed', 'rewarded'] },
    deleted: { $ne: true },
    _id: { $ne: referral._id },
  });
  if (existingClaim) {
    throw httpError('Vous avez déjà validé un code de parrainage.', 409, E.REFERRAL_ALREADY_CLAIMED);
  }

  // 7. Attribution atomique du code à ce filleul (un seul gagnant en concurrence).
  //    Ne matche que si le code est encore libre (referredUserId null && status pending).
  let claimed;
  try {
    claimed = await Referral.findOneAndUpdate(
      {
        _id: referral._id,
        referredUserId: null,
        status: 'pending',
        deleted: { $ne: true },
      },
      {
        $set: {
          referredUserId: userId,
          referredEmail: userEmail,
          status: 'completed',
          registeredAt: new Date(),
        },
      },
      { new: true }
    );
  } catch (e) {
    // Course perdue contre un autre code du même utilisateur (index unique).
    throw toAlreadyClaimedError(e);
  }

  if (!claimed) {
    // L'attribution vient d'être perdue (un autre requête l'a emportée).
    const fresh = await Referral.findById(referral._id).lean();
    if (fresh && fresh.referredUserId && String(fresh.referredUserId) === String(userId)) {
      return sendResponse(res, {
        code: normalizedCode,
        alreadyClaimed: true,
        rewardAiRequests: fresh.referredReward || REWARD_NEW_USER,
        referrerName: req.user.name || 'Votre ami',
        message: 'Vous utilisez déjà ce code de parrainage.',
      }, 'Code de parrainage déjà validé');
    }
    throw httpError('Ce code de parrainage a déjà été utilisé.', 409, E.REFERRAL_ALREADY_CLAIMED);
  }

  // 8. Récompense immédiate pour le filleul : +1 requête IA (bonus permanent).
  //    GARANTIE : seul le gagnant atomique (étape 7) atteint ce $inc.
  const User = getTrividaUserModel(req);
  if (User) {
    try {
      await User.findByIdAndUpdate(
        userId,
        { $inc: { aiBonusRequests: REWARD_NEW_USER } },
        { new: true }
      );
    } catch (e) {
      console.warn('[Referral] Impossible d’ajouter le bonus IA au filleul:', e.message);
    }
  }

  sendResponse(res, {
    code: normalizedCode,
    alreadyClaimed: false,
    claimedReferralId: claimed._id,
    referrerName: req.user.name || 'Votre ami',
    rewardAiRequests: REWARD_NEW_USER,
    message: `Bienvenue ! Vous recevez +${REWARD_NEW_USER} requête IA gratuite grâce à votre parrainage.`,
  }, 'Code de parrainage validé');
});

/**
 * POST /referral/validate (protect) — ALIAS IDEMPOTENT de POST /referral/claim.
 * Conservé pour compatibilité du frontend existant (RegisterScreen + ReferralContext).
 * Body: { code: string }
 */
exports.validateCode = asyncHandler(async (req, res) => {
  return exports.claimReferral(req, res);
});

/**
 * Helper — Vérifier et activer la récompense du parrain d'un filleul donné.
 * Appelé automatiquement par le sync push quand des transactions sont insérées.
 * Ne lève jamais d'erreur (fire-and-forget). IDEMPOTENT : le flag
 * referrerRewardGranted + mise à jour atomique garantissent un $inc unique.
 */
exports.maybeActivateRewardForUser = async function (referredUserId) {
  try {
    // Accès direct aux modèles Trivida (hors cycle request) via la fabrique tenant.
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

    // Ne récompenser qu'un filleul en attente non déjà récompensé.
    const referral = await Referral.findOne({
      referredUserId,
      status: 'completed',
      referrerRewardGranted: { $ne: true },
      deleted: { $ne: true },
    });
    if (!referral) return; // aucun parrainage éligible

    const txCount = await TxModel.countDocuments({ userId: referredUserId, deleted: { $ne: true } });
    if (txCount < ACTIVITY_THRESHOLD) return;

    // Attribution atomique du statut rewarded (un seul gagnant, même en parallèle).
    const updated = await Referral.findOneAndUpdate(
      {
        _id: referral._id,
        status: 'completed',
        referrerRewardGranted: { $ne: true },
        deleted: { $ne: true },
      },
      {
        $set: {
          status: 'rewarded',
          referrerReward: REWARD_REFERRER,
          referredReward: REWARD_REFERRER,
          rewardType: 'ai_requests',
          referrerRewardGranted: true,
          rewardedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) return; // course perdue → la récompense a déjà été accordée

    // $inc unique du parrain (protégé par le verrou atomique ci-dessus).
    if (User) {
      await User.findByIdAndUpdate(
        referral.referrerId,
        { $inc: { aiBonusRequests: REWARD_REFERRER } }
      );
      console.log(`🎁 [Referral] Parrain ${referral.referrerId} récompensé (+${REWARD_REFERRER} requête IA) via filleul ${referredUserId} (${txCount} transactions)`);
    }
  } catch (e) {
    console.warn('[Referral] maybeActivateRewardForUser:', e.message);
  }
};

/**
 * POST /referral/reward (protect)
 * Activer la récompense du parrain quand le filleul atteint le seuil d'activité.
 * Body: { referredUserId: string }
 *
 * Sécurité : l'appelant doit être le parrain du filleul visé (req.user.referrerId
 * === req.user), un utilisateur quelconque ne peut récompenser le parrain d'autrui.
 * Idempotence : findOneAndUpdate conditionnel sur status 'completed' +
 * referrerRewardGranted false → UN SEUL $inc, même en double appel / parallèle.
 */
exports.activateReward = asyncHandler(async (req, res) => {
  const Referral = getReferralModel(req);
  if (!Referral) throw httpError('Service de parrainage indisponible', 503, E.REFERRAL_SERVICE_UNAVAILABLE);

  const { referredUserId } = req.body;
  if (!referredUserId) {
    throw httpError('Le filleul est requis.', 400, E.REFERRAL_CODE_REQUIRED);
  }

  const userId = req.user._id;

  // Le parrain ne peut récompenser que SES PROPRES filleuls (pas ceux d'autrui).
  const referral = await Referral.findOne({
    referredUserId,
    referrerId: userId,
    status: 'completed',
    referrerRewardGranted: { $ne: true },
    deleted: { $ne: true },
  });
  if (!referral) {
    return sendResponse(res, null, 'Pas de parrainage en attente à récompenser.');
  }

  // Vérifier que le filleul a atteint le seuil d'activité
  const TransactionSchema = require('../../transaction/model/transaction.schema');
  let txCount = 0;
  try {
    const TxModel = req.getModel('TrividaTransaction', TransactionSchema);
    txCount = await TxModel.countDocuments({ userId: referredUserId, deleted: { $ne: true } });
  } catch (e) {
    return sendResponse(res, null, 'Impossible de vérifier les transactions.');
  }

  if (txCount < ACTIVITY_THRESHOLD) {
    return sendResponse(res, { txCount, threshold: ACTIVITY_THRESHOLD }, 'Seuil pas encore atteint.');
  }

  // Attribution atomique (un seul gagnant en cas de double appel).
  const updated = await Referral.findOneAndUpdate(
    {
      _id: referral._id,
      status: 'completed',
      referrerRewardGranted: { $ne: true },
      deleted: { $ne: true },
    },
    {
      $set: {
        status: 'rewarded',
        referrerReward: REWARD_REFERRER,
        referredReward: REWARD_REFERRER,
        rewardType: 'ai_requests',
        referrerRewardGranted: true,
        rewardedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!updated) {
    throw httpError('La récompense du parrain a déjà été accordée.', 409, E.REFERRAL_REWARD_ALREADY_GRANTED);
  }

  const User = getTrividaUserModel(req);
  if (User) {
    try {
      await User.findByIdAndUpdate(
        referral.referrerId,
        { $inc: { aiBonusRequests: REWARD_REFERRER } },
        { new: true }
      );
    } catch (e) {
      console.warn('[Referral] Impossible d’ajouter le bonus IA au parrain:', e.message);
    }
  }

  sendResponse(res, {
    referrerId: referral.referrerId,
    referredUserId,
    rewardAiRequests: REWARD_REFERRER,
    message: `Parrain récompensé ! +${REWARD_REFERRER} requête IA gratuite.`,
  }, 'Récompense activée');
});
const asyncHandler = require('express-async-handler');
const sendResponse = require('../../utils/http/response');

/**
 * Controleur AI Quota — Operations atomiques via MongoDB
 * ========================================================
 *
 * Principe : Toutes les ecritures utilisent findOneAndUpdate avec
 * des conditions atomiques ($lt, $or) combinees a des operations
 * atomiques ($inc, $set). MongoDB serialise les ecritures sur un
 * meme document, donc deux requetes simultanees ne peuvent PAS
 * depasser la limite quotidienne (race condition eliminee).
 *
 * Flux type :
 *   [Etape 1] Reset atomique du compteur si minuit passe
 *     -> findOneAndUpdate avec $or: [null, $lte: now]
 *     -> Se declenche UNE fois par jour au premier appel
 *
 *   [Etape 2] Incrementation atomique du compteur
 *     -> findOneAndUpdate avec aiRequestsToday: { $lt: dailyLimit }
 *     -> MongoDB serialise les ecritures : une seule requete passe
 *     -> Si aucun document trouve : quota epuise ou user inexistant
 *
 *   Grace a cette approche, meme avec 50 requetes simultanees,
 *   seules (dailyLimit) requetes seront acceptees par jour.
 */

const getNextMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  midnight.setMinutes(0, 0, 0);
  midnight.setSeconds(0, 0);
  return midnight;
};

const PLAN_LIMITS = { free: 3, premium: 20, business: 100 };
const getDailyLimit = (plan) => PLAN_LIMITS[plan] || 3;

/**
 * GET /ai-quota
 *
 * Retourne le nombre de requetes IA restantes aujourd hui.
 *
 * Atomicite :
 *   - Tentative de reset atomique via findOneAndUpdate
 *     (si aiRequestsResetAt est null ou dans le passe).
 *   - Si le reset n est pas necessaire, simple lecture findById.
 *   - Les deux cas sont combines pour economiser une requete DB.
 *
 * Response: { remaining, dailyLimit, resetAt }
 */
exports.getAiQuota = asyncHandler(async (req, res) => {
  const User = req.getModel('User');
  const userId = req.user._id;
  const now = new Date();

  // Tentative atomique : reset si minuit passe, avec retour du doc
  let user = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { aiRequestsResetAt: null },
        { aiRequestsResetAt: { $lte: now } },
      ],
    },
    {
      $set: {
        aiRequestsToday: 0,
        aiRequestsResetAt: getNextMidnight(),
      },
    },
    { new: true, select: 'aiRequestsToday aiRequestsResetAt premiumPlan' }
  );

  if (!user) {
    user = await User.findById(userId).select('aiRequestsToday aiRequestsResetAt premiumPlan');
  }

  if (!user) {
    return sendResponse(res, null, 'Utilisateur non trouve', false, undefined, 404);
  }

  const dailyLimit = getDailyLimit(user.premiumPlan);
  const remaining = Math.max(0, dailyLimit - (user.aiRequestsToday || 0));

  return sendResponse(res, { remaining, dailyLimit, resetAt: user.aiRequestsResetAt });
});

/**
 * POST /ai-request
 *
 * Consomme UNE requete IA de maniere ATOMIQUE.
 *
 * Pourquoi atomique ?
 *   Sans atomicite, deux requetes simultanees pourraient TOUTES LES
 *   DEUX lire aiRequestsToday = 4 (dailyLimit = 5), passer le check
 *   "4 < 5", et incrementer -> 5 et 6 (depassement de limite).
 *
 * Solution :
 *   [1] findOneAndUpdate avec $lt: dailyLimit + $inc: 1
 *       -> La condition ($lt) et la modification ($inc) sont executees
 *          dans la MEME operation MongoDB, verrouillee au niveau du
 *          document. MongoDB serialise les ecritures sur le meme
 *          document : deux requetes simultanees ne peuvent PAS passer
 *          toutes les deux le $lt.
 *       -> Une seule passe, l'autre recoit null et renvoie 429.
 *
 *   [2] Reset prealable si minuit passe
 *       -> findOneAndUpdate avec $or: [null, $lte: now]
 *       -> Seul le premier appel apres minuit declenche le reset.
 *
 * Response (success): { remaining, dailyLimit, resetAt }
 * Response (quota exceeded): { remaining: 0, dailyLimit, resetAt, quotaExceeded: true }
 *   Status: 429
 */
exports.consumeAiRequest = asyncHandler(async (req, res) => {
  const User = req.getModel('User');
  const userId = req.user._id;
  const plan = req.user.premiumPlan || 'free';
  const dailyLimit = getDailyLimit(plan);
  const now = new Date();
  const nextMidnight = getNextMidnight();

  // ── Etape 1 : Reset atomique si minuit passe ou jamais initialise ──
  // findOneAndUpdate avec $or: null OU $lte: now
  // Si aiRequestsResetAt est null (nouvel utilisateur) ou dans le passe, on reset
  // Sinon, findOneAndUpdate ne trouve rien et on continue
  await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { aiRequestsResetAt: null },
        { aiRequestsResetAt: { $lte: now } },
      ],
    },
    {
      $set: {
        aiRequestsToday: 0,
        aiRequestsResetAt: nextMidnight,
      },
    }
  );

  // ── Etape 2 : Incrementation atomique du compteur ──
  // findOneAndUpdate avec $lt: dailyLimit fait office de verrou :
  // MongoDB serialise les ecritures sur le meme document, donc
  // deux requetes simultanees ne peuvent PAS passer le $lt ensemble.
  // La condition et l'increment sont atomiques (meme operation).
  const result = await User.findOneAndUpdate(
    {
      _id: userId,
      aiRequestsToday: { $lt: dailyLimit },
    },
    {
      $inc: { aiRequestsToday: 1 },
    },
    { new: true, select: 'aiRequestsToday aiRequestsResetAt' }
  );

  if (!result) {
    const userExists = await User.findById(userId).select('_id');
    if (!userExists) {
      return sendResponse(res, null, 'Utilisateur non trouve', false, undefined, 404);
    }

    const user = await User.findById(userId).select('aiRequestsToday aiRequestsResetAt premiumPlan');
    return sendResponse(
      res,
      { remaining: 0, dailyLimit, resetAt: user?.aiRequestsResetAt || nextMidnight, quotaExceeded: true },
      'Limite de requetes IA atteinte. Revenez demain ou passez a un forfait superieur.',
      false, undefined, 429
    );
  }

  const remaining = Math.max(0, dailyLimit - (result.aiRequestsToday || 0));
  return sendResponse(res, { remaining, dailyLimit, resetAt: result.aiRequestsResetAt || nextMidnight });
});

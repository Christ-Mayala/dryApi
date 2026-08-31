/**
 * Analytics Controller — Trivida
 * 
 * Reçoit les événements du mobile et fournit les métriques de rétention.
 * 
 * Endpoints :
 *   POST /analytics/events    → Enregistrer des événements
 *   GET  /analytics/funnel    → Funnel d'activation
 *   GET  /analytics/retention → Métriques D1/D3/D7/D30
 *   GET  /analytics/events    → Événements avec filtres
 */
const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');

const AnalyticsEventSchema = require('../model/analyticsEvent.schema');

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /analytics/events
 * Enregistrer un lot d'événements depuis l'app mobile
 * Body: { events: [{ event, timestamp, date, props, platform }] }
 */
exports.trackEvents = asyncHandler(async (req, res) => {
  const EventModel = req.getModel('TrividaAnalyticsEvent', AnalyticsEventSchema);
  const userId = req.user._id;
  const { events } = req.body;
  
  if (!events || !Array.isArray(events)) {
    throw httpError('Le champ events est requis et doit être un tableau', 400);
  }
  
  // Transformer les événements pour MongoDB
  const docs = events.map(e => ({
    userId,
    event: e.event,
    date: e.date ? new Date(e.date) : new Date(e.timestamp || Date.now()),
    timestamp: e.timestamp,
    props: e.props || {},
    platform: e.platform || req.headers['x-platform'],
    appVersion: req.headers['x-app-version'],
  }));
  
  // InsertMany avec ordered:false pour ignorer les doublons
  let inserted = 0;
  try {
    const result = await EventModel.insertMany(docs, { ordered: false });
    inserted = result.length;
  } catch (e) {
    // Les erreurs de duplicate key sont ignorées
    if (e.insertedDocs) inserted = e.insertedDocs.length;
  }
  
  sendResponse(res, { inserted, total: events.length }, `${inserted} événement(s) enregistré(s)`);
});

/**
 * GET /analytics/funnel
 * Funnel d'activation complet
 * Retourne le nombre d'utilisateurs à chaque étape du funnel
 */
exports.getFunnel = asyncHandler(async (req, res) => {
  const EventModel = req.getModel('TrividaAnalyticsEvent', AnalyticsEventSchema);
  
  // Étapes du funnel dans l'ordre
  const FUNNEL_STEPS = [
    { event: 'app_open', label: 'Ouverture' },
    { event: 'onboarding_completed', label: 'Onboarding terminé' },
    { event: 'register_completed', label: 'Inscription' },
    { event: 'first_transaction', label: 'Première transaction' },
    { event: 'first_saving_goal', label: 'Premier objectif' },
    { event: 'day_return', label: 'Retour J+1' },
    { event: 'week_return', label: 'Retour J+7' },
  ];
  
  const funnel = await Promise.all(FUNNEL_STEPS.map(async (step) => {
    const uniqueUsers = await EventModel.distinct('userId', { event: step.event });
    return {
      event: step.event,
      label: step.label,
      users: uniqueUsers.length,
    };
  }));
  
  // Taux de conversion entre chaque étape
  const funnelWithConversion = funnel.map((step, i) => ({
    ...step,
    conversionFromPrevious: i > 0 && funnel[i-1].users > 0
      ? Math.round((step.users / funnel[i-1].users) * 100)
      : 100,
  }));
  
  sendResponse(res, funnelWithConversion, 'Funnel d\'activation');
});

/**
 * GET /analytics/retention
 * Métriques de rétention D1, D3, D7, D30
 * Query params: days (défaut 30)
 */
exports.getRetention = asyncHandler(async (req, res) => {
  const EventModel = req.getModel('TrividaAnalyticsEvent', AnalyticsEventSchema);
  const User = req.getModel('User');
  
  const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // Utilisateurs inscrits pendant la période
  const newUsers = await User.countDocuments({ createdAt: { $gte: since } });
  
  // Rétention D1 : utilisateurs qui reviennent le lendemain
  const retentionD1 = await _calcRetention(EventModel, since, 1);
  const retentionD3 = await _calcRetention(EventModel, since, 3);
  const retentionD7 = await _calcRetention(EventModel, since, 7);
  const retentionD30 = await _calcRetention(EventModel, since, 30);
  
  // DAU/WAU/MAU
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [dau, wau, mau] = await Promise.all([
    EventModel.distinct('userId', { date: { $gte: today } }).then(ids => ids.length),
    EventModel.distinct('userId', { date: { $gte: weekAgo } }).then(ids => ids.length),
    EventModel.distinct('userId', { date: { $gte: monthAgo } }).then(ids => ids.length),
  ]);
  
  sendResponse(res, {
    period: `${days} jours`,
    newUsers,
    retention: { D1: retentionD1, D3: retentionD3, D7: retentionD7, D30: retentionD30 },
    engagement: { DAU: dau, WAU: wau, MAU: mau },
    dauWauRatio: wau > 0 ? Math.round((dau / wau) * 100) : 0,
    wauMauRatio: mau > 0 ? Math.round((wau / mau) * 100) : 0,
  }, 'Métriques de rétention');
});

/**
 * GET /analytics/events
 * Événements avec filtres
 * Query params: event, userId, days, limit
 */
exports.getEvents = asyncHandler(async (req, res) => {
  const EventModel = req.getModel('TrividaAnalyticsEvent', AnalyticsEventSchema);
  
  const filter = {};
  if (req.query.event) filter.event = req.query.event;
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.days) {
    const since = new Date(Date.now() - parseInt(req.query.days) * 24 * 60 * 60 * 1000);
    filter.date = { $gte: since };
  }
  
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  
  const events = await EventModel.find(filter)
    .sort({ date: -1 })
    .limit(limit)
    .lean();
  
  sendResponse(res, events, 'Événements');
});

/**
 * GET /analytics/business-metrics
 * Métriques métier agrégées
 */
exports.getBusinessMetrics = asyncHandler(async (req, res) => {
  const EventModel = req.getModel('TrividaAnalyticsEvent', AnalyticsEventSchema);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [transactionsToday, transactionsWeek, transactionsMonth, goalsCompleted, lifeOsVisits, aiQuestions] = await Promise.all([
    EventModel.countDocuments({ event: 'transaction_created', date: { $gte: today } }),
    EventModel.countDocuments({ event: 'transaction_created', date: { $gte: weekAgo } }),
    EventModel.countDocuments({ event: 'transaction_created', date: { $gte: monthAgo } }),
    EventModel.countDocuments({ event: 'goal_completed', date: { $gte: monthAgo } }),
    EventModel.countDocuments({ event: 'lifeos_opened', date: { $gte: monthAgo } }),
    EventModel.countDocuments({ event: 'ai_question_sent', date: { $gte: monthAgo } }),
  ]);
  
  sendResponse(res, {
    transactions: { today: transactionsToday, week: transactionsWeek, month: transactionsMonth },
    goalsCompleted,
    lifeOsVisits,
    aiQuestions,
  }, 'Métriques métier');
});

// ─── Helpers ─────────────────────────────────────────────────────────────

async function _calcRetention(EventModel, since, dayOffset) {
  // Pour chaque jour dans la période, calculer le % d'utilisateurs qui reviennent
  const daysSince = Math.floor((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince < dayOffset) return null;
  
  const cutoffDate = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
  
  // Utilisateurs actifs avant le cutoff
  const activeBefore = await EventModel.distinct('userId', { 
    date: { $gte: since, $lt: cutoffDate },
    event: 'app_open',
  });
  
  if (activeBefore.length === 0) return null;
  
  // Combien reviennent après le cutoff
  const activeAfter = await EventModel.distinct('userId', {
    userId: { $in: activeBefore },
    date: { $gte: cutoffDate },
    event: 'app_open',
  });
  
  return Math.round((activeAfter.length / activeBefore.length) * 100);
}

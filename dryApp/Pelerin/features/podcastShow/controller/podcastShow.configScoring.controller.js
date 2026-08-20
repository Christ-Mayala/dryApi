const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const {
  getScoringConfig,
  setScoringOverrides,
  WEIGHT_KEYS,
  THRESHOLD_KEYS,
} = require('../../../services/podcastScoring.service');
const PodcastScoringConfigSchema = require('../model/podcastScoringConfig.schema');

// PUT /podcastShow/admin/config/scoring — admin. Modifie les seuils et poids
// du scoring depuis l'application, persistés en base (SANS éditer le .env).
// Corps : { weights?: { PODCAST_SCORE_*: nombre }, thresholds?: {...} }.
// Envoyer un objet vide ({}) pour une section = revenir à l'environnement.
module.exports = asyncHandler(async (req, res) => {
  const Config = req.getModel('PodcastScoringConfig', PodcastScoringConfigSchema);

  const parseSection = (raw, allowed, { min = 0 } = {}) => {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw httpError('Attendu : objet { VAR: nombre }', 400);
    }
    const parsed = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!allowed.includes(key)) throw httpError(`Clé inconnue : ${key}`, 400);
      const n = Number(value);
      if (!Number.isFinite(n) || n < min) {
        throw httpError(`Valeur invalide pour ${key} (nombre ≥ ${min} requis)`, 400);
      }
      parsed[key] = n;
    }
    return parsed;
  };

  const weights = parseSection(req.body?.weights, WEIGHT_KEYS);
  const thresholds = parseSection(req.body?.thresholds, THRESHOLD_KEYS, { min: 1 });

  if (weights === undefined && thresholds === undefined) {
    throw httpError('Rien à mettre à jour (weights et/ou thresholds attendus)', 400);
  }

  const update = {};
  if (weights !== undefined) update.weights = weights;
  if (thresholds !== undefined) update.thresholds = thresholds;
  update.updatedBy = req.user?.id || req.user?._id;

  const doc = await Config.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true, setDefaultsOnInsert: true });

  // Applique immédiatement en mémoire (le scoring lit ce cache à chaque appel).
  setScoringOverrides({ weights: doc.weights || {}, thresholds: doc.thresholds || {} });

  return sendResponse(res, getScoringConfig(), 'Configuration du scoring mise à jour');
});

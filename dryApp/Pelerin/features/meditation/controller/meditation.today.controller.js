const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const MeditationSchema = require('../model/meditation.schema');

/**
 * Méditation du jour — ROTATION QUOTIDIENNE DETERMINISTE.
 *
 * Au lieu de toujours renvoyer la méditation la plus récente par publishDate
 * (ce qui fige l'écran "méditation du jour" à la même valeur), on calcule un
 * indice stable depuis une époque fixe, modulo le nombre de méditations
 * publiées. Résultat :
 *  - chaque jour → une méditation (presque) différente,
 *  - un même jour → toujours la même méditation (reproductible, cacheable),
 *  - l'ordre est donné par `sort('publishDate')` (canon sédimentaire fixe).
 *
 * L'époque (EPOCH) est volontairement fixe et antérieure au premier seed afin
 * que l'indice soit stable quel que soit le moment où le serveur démarre.
 */
const EPOCH = new Date('2025-01-01T00:00:00.000Z');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Meditation', MeditationSchema);

  // On ne tourne que sur les méditations publiées (triées pour un ordre stable).
  const count = await Model.countDocuments({});
  if (count === 0) {
    throw httpError('Aucune méditation disponible pour le moment', 404);
  }

  const dayOffset = Math.floor((Date.now() - EPOCH.getTime()) / 86_400_000);
  const idx = ((dayOffset % count) + count) % count;

  const meditation = await Model.findOne({})
    .sort('publishDate')
    .skip(idx)
    .limit(1)
    .lean();

  if (!meditation) {
    throw httpError('Méditation du jour introuvable', 404);
  }

  return sendResponse(res, meditation, 'Méditation du jour');
});

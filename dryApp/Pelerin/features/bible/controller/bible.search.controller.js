const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const BibleVerseSchema = require('../model/bible.schema');

// GET /bible/search?q=amour&version=LSG1910&page=1&limit=20
// Recherche plein texte dans les versets (index "text" defini sur le schema).
module.exports = asyncHandler(async (req, res) => {
  const { q, version } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

  if (!q || String(q).trim().length < 2) {
    throw httpError('Le parametre de recherche "q" doit contenir au moins 2 caracteres', 400);
  }

  const filter = { $text: { $search: q } };
  if (version) {
    if (!BibleVerseSchema.statics.VERSIONS.includes(version)) {
      throw httpError('Version biblique inconnue', 400);
    }
    filter.version = version;
  }

  const Model = req.getModel('BibleVerse', BibleVerseSchema);
  const [data, total] = await Promise.all([
    Model.find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .skip((page - 1) * limit)
      .limit(limit),
    Model.countDocuments(filter),
  ]);

  return sendResponse(res, data, 'Resultats de recherche', true, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

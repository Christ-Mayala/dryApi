const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
// require différé : le contrôleur lit la propriété au moment de l'appel, ce qui
// permet de mocker le service dans les tests (et reste cohérent avec le style
// lazy-require utilisé ailleurs dans le projet).
const PodcastShowSchema = require('../model/podcastShow.schema');

// GET /podcastShow/discover?q= — admin. Recherche sur Podcast Index (jamais
// publié automatiquement) : l'admin vérifie chaque résultat (titre, auteur,
// description, image, langue, RSS, score) puis choisit d'importer via le flux
// RSS (POST /podcastShow/import). Les podcasts déjà importés sont signalés.
module.exports = asyncHandler(async (req, res) => {
  const q = String(req.query?.q || '').trim();
  if (q.length < 2) throw httpError('Recherche trop courte (2 caractères minimum)', 400);
  const max = Math.min(50, Math.max(1, Number(req.query?.max) || 25));

  let results;
  try {
    const { searchPodcastIndex } = require('../../../services/podcastIndex.service');
    results = await searchPodcastIndex({ q, max });
  } catch (err) {
    if (err?.code === 'PODCAST_INDEX_NOT_CONFIGURED') {
      return sendResponse(res, null, err.message, false, undefined, 503);
    }
    return sendResponse(res, null, `Recherche Podcast Index indisponible : ${String(err?.message || err).slice(0, 200)}`, false, undefined, 502);
  }

  // Déduplication : signale les flux déjà importés (rssUrl déjà en base).
  const Show = req.getModel('PodcastShow', PodcastShowSchema);
  const rssUrls = results.map((r) => r.rssUrl);
  const existing = await Show.find({ rssUrl: { $in: rssUrls } }).select('_id title rssUrl').lean();

  const byRss = new Map(existing.map((s) => [s.rssUrl, s]));
  const enriched = results.map((r) => ({
    ...r,
    alreadyImported: byRss.has(r.rssUrl),
    existingId: byRss.has(r.rssUrl) ? String(byRss.get(r.rssUrl)._id) : null,
  }));

  return sendResponse(res, enriched, 'Résultats de découverte');
});

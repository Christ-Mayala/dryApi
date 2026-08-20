const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

// POST /podcastShow/admin/config/test — admin. Teste EN DIRECT la connectivité
// de Podcast Index avec les clés configurées : une vraie recherche est émise.
// Réponse : { ok, configured, latencyMs, resultCount?, error?, statusCode? }.
// Toujours 200 (la réponse porte l'état) pour un affichage propre côté app.
module.exports = asyncHandler(async (req, res) => {
  const configured = Boolean(
    process.env.PODCASTINDEX_API_KEY && process.env.PODCASTINDEX_API_SECRET,
  );
  if (!configured) {
    return sendResponse(res, {
      ok: false,
      configured: false,
      error: 'Podcast Index non configuré (PODCASTINDEX_API_KEY / _SECRET manquantes)',
    }, 'Test de connectivité', true, undefined, 200);
  }

  const started = Date.now();
  try {
    const { searchPodcastIndex } = require('../../../services/podcastIndex.service');
    const results = await searchPodcastIndex({ q: 'prière chrétienne', max: 3 });
    return sendResponse(res, {
      ok: true,
      configured: true,
      latencyMs: Date.now() - started,
      resultCount: results.length,
    }, 'Connectivité Podcast Index OK', true, undefined, 200);
  } catch (err) {
    return sendResponse(res, {
      ok: false,
      configured: true,
      latencyMs: Date.now() - started,
      error: String(err?.message || err).slice(0, 300),
      statusCode: err?.response?.status || err?.code || null,
    }, 'Échec du test de connectivité', false, undefined, 200);
  }
});

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
// require différé : le contrôleur relit la propriété au moment de l'appel, ce
// qui permet de mocker le service dans les tests (même pattern que discover).

// POST /podcastShow/admin/discover/run — admin. Lance IMMÉDIATEMENT une passe
// d'auto-découverte Podcast Index (même pipeline que le cron quotidien) et
// renvoie le rapport complet : { searched, imported, skipped, results[] }.
// Rate-limiteur dédié (API tierce) : 20 recherches / minute / IP.
module.exports = asyncHandler(async (req, res) => {
  const { runAutoDiscoveryNow } = require('../../../services/podcastRss.scheduler');
  const report = await runAutoDiscoveryNow();
  return sendResponse(res, report, 'Auto-découverte exécutée');
});

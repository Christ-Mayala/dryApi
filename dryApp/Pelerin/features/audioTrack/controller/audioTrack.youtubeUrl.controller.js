const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getYoutubeAudioUrl } = require('../../../services/youtubeAudio.service');

/**
 * POST /audioTrack/youtube-url — { videoId } → { audioUrl }.
 *
 * Résout un videoId YouTube en URL de flux audio directe (via yt-dlp) pour une
 * écoute en ARRIÈRE-PLAN (écran éteint, notification, écran verrouillé) avec
 * le lecteur global — le même confort que les podcasts. Protégé (le lecteur
 * envoie le token) ; les URLs sont mises en cache 30 min côté serveur.
 */
module.exports = asyncHandler(async (req, res) => {
  const { videoId } = req.body || {};
  if (!videoId) {
    const err = new Error('videoId est requis');
    err.statusCode = 400;
    throw err;
  }

  const audioUrl = await getYoutubeAudioUrl(videoId);
  return sendResponse(res, { videoId, audioUrl }, 'Flux audio résolu');
});

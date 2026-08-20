const asyncHandler = require('express-async-handler');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const sendResponse = require('../../../../../dry/utils/http/response');
const AudioTrackSchema = require('../model/audioTrack.schema');
const { importYoutubePlaylist } = require('../../../services/youtubeAudio.service');

/**
 * POST /audioTrack/add-playlist — admin. Importe toutes les vidéos d'une
 * playlist YouTube (URL ou ID) dans la bibliothèque Audio, en tant que pistes
 * écoutables en arrière-plan. Déduplication par youtubeVideoId, filtre
 * « chrétien uniquement » appliqué.
 *
 * Body : { url, category? } — category : 'gospel' | 'louange' | 'enseignement'
 */
module.exports = asyncHandler(async (req, res) => {
  const Track = req.getModel('AudioTrack', AudioTrackSchema);
  const { url, playlistId, category } = req.body || {};
  const input = url || playlistId;
  if (!input || !String(input).trim()) {
    throw httpError('URL ou ID de playlist requis', 400);
  }
  const result = await importYoutubePlaylist(Track, String(input).trim(), category || 'gospel');
  return sendResponse(res, result, 'Import de playlist terminé');
});

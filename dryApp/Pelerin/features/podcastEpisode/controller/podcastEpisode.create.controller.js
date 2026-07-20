const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { pickDefined } = require('../../../../../dry/utils/data/pick');
const PodcastEpisodeSchema = require('../model/podcastEpisode.schema');
const PodcastShowSchema = require('../../podcastShow/model/podcastShow.schema');

// POST /podcastEpisode — admin. Audio : fichier uploade (champ "audio") OU
// lien externe (req.body.audioUrl) — au moins l'un des deux est requis,
// meme logique que audioTrack (voir features/audioTrack).
module.exports = asyncHandler(async (req, res) => {
  const Episode = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const Show = req.getModel('PodcastShow', PodcastShowSchema);

  const { showId, title, episodeNumber } = req.body;
  if (!showId || !title || !episodeNumber) {
    throw httpError('showId, title et episodeNumber sont requis', 400);
  }

  const show = await Show.findById(showId);
  if (!show) throw httpError('Émission introuvable', 400);

  const audioFile = req.files?.audio?.[0];
  const coverFile = req.files?.cover?.[0];
  const linkUrl = (req.body.audioUrl || '').trim();

  if (!audioFile && !linkUrl) {
    throw httpError('Fournis un fichier audio ou un lien.', 400);
  }

  const payload = {
    ...pickDefined(req.body, ['showId', 'title', 'description', 'season', 'episodeNumber', 'duration']),
    episodeNumber: Number(episodeNumber),
    season: req.body.season ? Number(req.body.season) : undefined,
    audioUrl: audioFile ? audioFile.path : linkUrl,
    isPublished:
      req.body.isPublished !== undefined ? req.body.isPublished === 'true' || req.body.isPublished === true : true,
    tags: req.body.tags
      ? String(req.body.tags).split(',').map((t) => t.trim()).filter(Boolean)
      : undefined,
  };
  if (audioFile) payload.audioPublicId = audioFile.filename;
  if (coverFile) {
    payload.coverUrl = coverFile.path;
    payload.coverPublicId = coverFile.filename;
  }

  const episode = await Episode.create(payload);
  return sendResponse(res, episode, 'Épisode créé');
});

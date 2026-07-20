const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { pickDefined } = require('../../../../../dry/utils/data/pick');
const { deleteCloudinaryAsset } = require('../../../services/cloudinaryCleanup.service');
const PodcastEpisodeSchema = require('../model/podcastEpisode.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const episode = await Model.findById(req.params.id).select('+audioPublicId +coverPublicId');
  if (!episode) throw httpError('Épisode introuvable', 404);

  Object.assign(
    episode,
    pickDefined(req.body, ['title', 'description', 'season', 'episodeNumber', 'duration']),
  );
  if (req.body.season !== undefined) episode.season = Number(req.body.season);
  if (req.body.episodeNumber !== undefined) episode.episodeNumber = Number(req.body.episodeNumber);
  if (req.body.tags !== undefined) {
    episode.tags = String(req.body.tags).split(',').map((t) => t.trim()).filter(Boolean);
  }
  if (req.body.isPublished !== undefined) {
    episode.isPublished = req.body.isPublished === 'true' || req.body.isPublished === true;
  }

  const audioFile = req.files?.audio?.[0];
  const coverFile = req.files?.cover?.[0];
  const linkUrl = (req.body.audioUrl || '').trim();

  if (audioFile) {
    await deleteCloudinaryAsset(episode.audioPublicId, 'video');
    episode.audioUrl = audioFile.path;
    episode.audioPublicId = audioFile.filename;
  } else if (linkUrl) {
    await deleteCloudinaryAsset(episode.audioPublicId, 'video');
    episode.audioUrl = linkUrl;
    episode.audioPublicId = undefined;
  }

  if (coverFile) {
    await deleteCloudinaryAsset(episode.coverPublicId, 'image');
    episode.coverUrl = coverFile.path;
    episode.coverPublicId = coverFile.filename;
  }

  await episode.save();
  return sendResponse(res, episode, 'Épisode mis à jour');
});

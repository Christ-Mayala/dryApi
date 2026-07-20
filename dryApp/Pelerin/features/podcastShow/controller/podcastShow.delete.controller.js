const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { deleteCloudinaryAsset } = require('../../../services/cloudinaryCleanup.service');
const PodcastShowSchema = require('../model/podcastShow.schema');
const PodcastEpisodeSchema = require('../../podcastEpisode/model/podcastEpisode.schema');

// Supprime l'emission ET tous ses episodes (jamais d'episode orphelin
// pointant vers une emission qui n'existe plus) + nettoyage Cloudinary.
module.exports = asyncHandler(async (req, res) => {
  const Show = req.getModel('PodcastShow', PodcastShowSchema);
  const Episode = req.getModel('PodcastEpisode', PodcastEpisodeSchema);

  const show = await Show.findById(req.params.id).select('+coverPublicId');
  if (!show) throw httpError('Émission introuvable', 404);

  const episodes = await Episode.find({ showId: show._id }).select('+audioPublicId +coverPublicId');

  await Promise.all([
    ...episodes.flatMap((ep) => [
      deleteCloudinaryAsset(ep.audioPublicId, 'video'),
      deleteCloudinaryAsset(ep.coverPublicId, 'image'),
    ]),
    deleteCloudinaryAsset(show.coverPublicId, 'image'),
  ]);

  await Episode.deleteMany({ showId: show._id });
  await show.deleteOne();

  return sendResponse(res, null, 'Émission et ses épisodes supprimés');
});

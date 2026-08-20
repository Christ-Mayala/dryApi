const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const PodcastEpisodeSchema = require('../model/podcastEpisode.schema');
const PodcastListenSchema = require('../model/podcastListen.schema');
const PodcastEpisodeFavoriteSchema = require('../model/podcastEpisodeFavorite.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const Listen = req.getModel('PodcastListen', PodcastListenSchema);
  const Favorite = req.getModel('PodcastEpisodeFavorite', PodcastEpisodeFavoriteSchema);

  const episode = await Model.findById(req.params.id);
  if (!episode) throw httpError('Épisode introuvable', 404);

  // Soft delete (comme Notes/Temoignage) : le fichier Cloudinary (audio/couverture)
  // est volontairement conserve tant que l'episode n'est pas purge definitivement,
  // pour rester recuperable en cas d'erreur plutot que de perdre l'audio d'un coup.
  episode.status = 'deleted';
  episode.updatedBy = req.user.id;
  await episode.save();

  // Données personnelles liées : plus de progression ni de favori pour cet épisode.
  await Promise.all([
    Listen.deleteMany({ episodeId: episode._id }),
    Favorite.deleteMany({ episodeId: episode._id }),
  ]);

  return sendResponse(res, null, 'Épisode supprimé');
});

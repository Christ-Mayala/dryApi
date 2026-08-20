const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const PodcastEpisodeSchema = require('../model/podcastEpisode.schema');
const PodcastEpisodeFavoriteSchema = require('../model/podcastEpisodeFavorite.schema');
const PodcastShowSchema = require('../../podcastShow/model/podcastShow.schema');

// GET /podcastEpisode/favorites — mes épisodes favoris (avec émission).
module.exports.listMine = asyncHandler(async (req, res) => {
  const Favorite = req.getModel('PodcastEpisodeFavorite', PodcastEpisodeFavoriteSchema);
  const Episode = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const Show = req.getModel('PodcastShow', PodcastShowSchema);

  const favorites = await Favorite.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);

  if (favorites.length === 0) {
    return sendResponse(res, [], 'Aucun favori');
  }

  const episodes = await Episode.find({ _id: { $in: favorites.map((f) => f.episodeId) } });
  const shows = await Show.find({ _id: { $in: episodes.map((e) => e.showId) } });
  const showById = new Map(shows.map((s) => [String(s._id), s]));

  const result = episodes.map((e) => ({
    ...e.toObject(),
    show: showById.get(String(e.showId))?.toObject() ?? null,
  }));

  return sendResponse(res, result, 'Épisodes favoris');
});

// POST /podcastEpisode/favorites/:id — ajouter un épisode aux favoris.
module.exports.add = asyncHandler(async (req, res) => {
  const Favorite = req.getModel('PodcastEpisodeFavorite', PodcastEpisodeFavoriteSchema);
  const Episode = req.getModel('PodcastEpisode', PodcastEpisodeSchema);

  const episode = await Episode.findById(req.params.id).select('_id');
  if (!episode) throw httpError('Épisode introuvable', 404);

  await Favorite.findOneAndUpdate(
    { userId: req.user._id, episodeId: episode._id },
    { $setOnInsert: { userId: req.user._id, episodeId: episode._id } },
    { upsert: true, returnDocument: 'after' },
  );
  return sendResponse(res, { episodeId: String(episode._id), favorite: true }, 'Épisode favori ajouté');
});

// DELETE /podcastEpisode/favorites/:id — retirer des favoris.
module.exports.remove = asyncHandler(async (req, res) => {
  const Favorite = req.getModel('PodcastEpisodeFavorite', PodcastEpisodeFavoriteSchema);
  await Favorite.deleteOne({ userId: req.user._id, episodeId: req.params.id });
  return sendResponse(res, { episodeId: String(req.params.id), favorite: false }, 'Favori retiré');
});

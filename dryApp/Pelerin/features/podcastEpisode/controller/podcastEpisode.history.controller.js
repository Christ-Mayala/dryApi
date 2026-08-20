const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PodcastEpisodeSchema = require('../model/podcastEpisode.schema');
const PodcastListenSchema = require('../model/podcastListen.schema');
const PodcastShowSchema = require('../../podcastShow/model/podcastShow.schema');

// GET /podcastEpisode/history — mes épisodes récemment écoutés (avec épisode +
// émission, pour affichage direct). Limité à 20.
module.exports = asyncHandler(async (req, res) => {
  const Listen = req.getModel('PodcastListen', PodcastListenSchema);
  const Episode = req.getModel('PodcastEpisode', PodcastEpisodeSchema);
  const Show = req.getModel('PodcastShow', PodcastShowSchema);

  const listens = await Listen.find({ userId: req.user._id })
    .sort({ lastPlayedAt: -1 })
    .limit(20);

  if (listens.length === 0) {
    return sendResponse(res, [], 'Historique vide');
  }

  const episodes = await Episode.find({ _id: { $in: listens.map((l) => l.episodeId) } });
  const epById = new Map(episodes.map((e) => [String(e._id), e]));

  const shows = await Show.find({ _id: { $in: episodes.map((e) => e.showId) } });
  const showById = new Map(shows.map((s) => [String(s._id), s]));

  const result = listens
    .map((l) => {
      const episode = epById.get(String(l.episodeId));
      if (!episode) return null;
      const show = showById.get(String(l.showId));
      return {
        ...l.toObject(),
        episode: episode.toObject(),
        show: show ? show.toObject() : null,
      };
    })
    .filter(Boolean);

  return sendResponse(res, result, 'Historique d’écoute');
});

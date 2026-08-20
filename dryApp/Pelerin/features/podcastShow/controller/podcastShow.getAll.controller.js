const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PodcastShowSchema = require('../model/podcastShow.schema');
const PodcastEpisodeSchema = require('../../podcastEpisode/model/podcastEpisode.schema');

// GET /podcastShow — public, emissions publiees uniquement.
// Paramètres : ?category= &search= &sort=featured|new|popular &limit=
// Chaque émission est enrichie de `episodeCount` (agrégation) et `isFeatured`,
// ce qui permet à l'app de construire les sections "À la une / Nouveautés /
// Populaires" en UNE requête.
module.exports = asyncHandler(async (req, res) => {
  const Show = req.getModel('PodcastShow', PodcastShowSchema);
  const Episode = req.getModel('PodcastEpisode', PodcastEpisodeSchema);

  const filter = { isPublished: true };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search && String(req.query.search).trim()) {
    const q = String(req.query.search).trim();
    // Regex échappée (anti-ReDoS) sur titre + auteur.
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ title: { $regex: escaped, $options: 'i' } }, { author: { $regex: escaped, $options: 'i' } }];
  }

  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const sort = String(req.query.sort || 'new');

  // Agrégation : filtre + tri + count d'épisodes par émission (un seul passage).
  const sortStage =
    sort === 'featured'
      ? { isFeatured: -1, createdAt: -1 }
      : sort === 'popular'
        ? { episodeCount: -1, createdAt: -1 }
        : { createdAt: -1 };

  // Note : l'agrégation contourne les middlewares de requête (pas de soft-delete
  // automatique) — on filtre donc `status` explicitement.
  const match = { ...filter, status: { $ne: 'deleted' } };

  const docs = await Show.aggregate([
    { $match: match },
    {
      $lookup: {
        from: Episode.collection.name,
        localField: '_id',
        foreignField: 'showId',
        as: 'episodes',
      },
    },
    {
      $addFields: {
        episodeCount: {
          $size: {
            $filter: {
              input: '$episodes',
              as: 'e',
              cond: {
                $and: [{ $eq: ['$$e.isPublished', true] }, { $ne: ['$$e.status', 'deleted'] }],
              },
            },
          },
        },
      },
    },
    { $project: { episodes: 0 } },
    { $sort: sortStage },
    { $limit: limit },
  ]);

  return sendResponse(res, docs, 'Émissions récupérées');
});

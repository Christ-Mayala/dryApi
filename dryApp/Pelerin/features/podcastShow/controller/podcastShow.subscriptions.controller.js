const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const PodcastShowSchema = require('../model/podcastShow.schema');
const PodcastSubscriptionSchema = require('../model/podcastSubscription.schema');

// GET /podcastShow/subscriptions — mes podcasts suivis (liste d'émissions,
// complétée en mémoire pour éviter les index créés par le plugin DRY).
module.exports.listMine = asyncHandler(async (req, res) => {
  const Subscription = req.getModel('PodcastSubscription', PodcastSubscriptionSchema);
  const Show = req.getModel('PodcastShow', PodcastShowSchema);

  const subs = await Subscription.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100);

  const shows = await Show.find({ _id: { $in: subs.map((s) => s.showId) } });
  const byId = new Map(shows.map((s) => [String(s._id), s]));

  const result = subs
    .map((s) => byId.get(String(s.showId)))
    .filter(Boolean)
    .map((show) => show.toObject ? show.toObject() : show);

  return sendResponse(res, result, 'Podcasts suivis');
});

// POST /podcastShow/subscriptions/:id — suivre un podcast.
module.exports.follow = asyncHandler(async (req, res) => {
  const Subscription = req.getModel('PodcastSubscription', PodcastSubscriptionSchema);
  const Show = req.getModel('PodcastShow', PodcastShowSchema);

  const show = await Show.findById(req.params.id);
  if (!show) throw httpError('Émission introuvable', 404);

  await Subscription.findOneAndUpdate(
    { userId: req.user._id, showId: show._id },
    { $setOnInsert: { userId: req.user._id, showId: show._id } },
    { upsert: true, returnDocument: 'after' },
  );
  return sendResponse(res, { showId: String(show._id), following: true }, 'Podcast suivi');
});

// DELETE /podcastShow/subscriptions/:id — ne plus suivre.
module.exports.unfollow = asyncHandler(async (req, res) => {
  const Subscription = req.getModel('PodcastSubscription', PodcastSubscriptionSchema);
  await Subscription.deleteOne({ userId: req.user._id, showId: req.params.id });
  return sendResponse(res, { showId: String(req.params.id), following: false }, 'Podcast retiré des suivis');
});

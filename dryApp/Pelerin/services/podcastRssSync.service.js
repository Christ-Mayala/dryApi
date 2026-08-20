/**
 * Service de synchronisation RSS des podcasts (dryApp/Pelerin).
 *
 * Partagé entre :
 *   - l'import RSS (création / mise à jour d'un podcast externe) ;
 *   - le bouton admin « Synchroniser maintenant » ;
 *   - le scheduler cron (voir podcastRss.scheduler.js).
 *
 * Principe : fetch + parse + normalisation du flux, puis upsert des épisodes
 * par `guid` (déduplication fiable), mise à jour des métadonnées du podcast et
 * de son état de synchronisation (lastSyncedAt / syncStatus / syncError).
 */
const { fetchAndNormalizeFeed } = require('./podcastRss.service');

/**
 * Synchronise un podcast externe.
 * @param {object} params
 * @param {import('mongoose').Model} params.Show    Modèle PodcastShow
 * @param {import('mongoose').Model} params.Episode Modèle PodcastEpisode
 * @param {object} params.show                      Document PodcastShow à synchroniser
 * @returns {Promise<object>} show mis à jour
 */
async function syncPodcastShow({ Show, Episode, show }) {
  try {
    const { show: feedShow, episodes } = await fetchAndNormalizeFeed(show.rssUrl);

    // Métadonnées : le flux RSS est la source de vérité pour un podcast externe.
    const updated = await Show.findByIdAndUpdate(
      show._id,
      {
        $set: {
          title: feedShow.title,
          description: feedShow.description || show.description,
          author: feedShow.author || show.author || '',
          coverUrl: feedShow.coverUrl || show.coverUrl || '',
          websiteUrl: feedShow.websiteUrl || show.websiteUrl || '',
          language: feedShow.language || show.language || 'fr',
          lastSyncedAt: new Date(),
          syncStatus: 'ok',
          syncError: null,
        },
      },
      { returnDocument: 'after' },
    );

    if (!updated) return show;

    // Upsert des épisodes par (showId, guid) — aucune duplication.
    for (const ep of episodes) {
      const existing = await Episode.findOne({ showId: show._id, guid: ep.guid }).select('playCount sizeBytes');
      const playCount = existing?.playCount ?? 0;
      await Episode.findOneAndUpdate(
        { showId: show._id, guid: ep.guid },
        {
          $set: {
            title: ep.title,
            description: ep.description,
            audioUrl: ep.audioUrl,
            coverUrl: ep.coverUrl || show.coverUrl || '',
            duration: ep.duration || existing?.duration || '',
            sizeBytes: ep.sizeBytes ?? existing?.sizeBytes ?? null,
            publishDate: ep.publishedAt,
            episodeNumber: ep.episodeNumber || existing?.episodeNumber || 1,
            season: ep.season || existing?.season || 1,
            isPublished: true,
            playCount,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
    }

    return updated;
  } catch (err) {
    // Échec (RSS inaccessible, invalide, timeout…) : on mémorise l'état et on
    // re-lève pour que l'appelant (contrôleur) puisse répondre 502 proprement.
    await Show.findByIdAndUpdate(show._id, {
      $set: {
        lastSyncedAt: new Date(),
        syncStatus: 'error',
        syncError: String(err?.message || err).slice(0, 300),
      },
    });
    throw err;
  }
}

/**
 * Synchronise tous les podcasts externes actifs (utilisé par le cron).
 * @param {object} params
 * @param {import('mongoose').Model} params.Show
 * @param {import('mongoose').Model} params.Episode
 * @returns {Promise<{ok: number, failed: number, errors: object[]}>}
 */
async function syncAllPodcasts({ Show, Episode }) {
  const shows = await Show.find({ rssUrl: { $ne: null, $ne: '' }, isPublished: true }).limit(200);
  const results = { ok: 0, failed: 0, errors: [] };

  for (const show of shows) {
    try {
      await syncPodcastShow({ Show, Episode, show });
      results.ok += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({ id: String(show._id), title: show.title, error: String(err?.message || err) });
    }
  }

  return results;
}

module.exports = { syncPodcastShow, syncAllPodcasts };

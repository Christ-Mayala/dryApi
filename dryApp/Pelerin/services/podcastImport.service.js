/**
 * Service d'import RSS des podcasts (dryApp/Pelerin).
 *
 * Logique d'import partagée entre :
 *   - le contrôleur POST /podcastShow/import (action admin explicite) ;
 *   - le seed des podcasts par défaut (podcastSeed.service.js) ;
 *   - l'auto-découverte planifiée (podcastRss.scheduler.js).
 *
 * Le score de pertinence est TOUJOURS calculé et stocké (transparence admin),
 * mais il ne gate une publication que pour les imports AUTOMATIQUES
 * (source = 'discover'). Une action explicite de l'administrateur importe
 * toujours en statut 'manual' et publié.
 */
const { fetchAndNormalizeFeed } = require('./podcastRss.service');
const { syncPodcastShow } = require('./podcastRssSync.service');
const { computePodcastScore, decideAutoPublish } = require('./podcastScoring.service');
const { categorizePodcast } = require('./podcastCategorization.service');

/**
 * Importe (ou met à jour) un podcast depuis son flux RSS + ses épisodes.
 * @param {object} params
 * @param {import('mongoose').Model} params.Show
 * @param {import('mongoose').Model} params.Episode
 * @param {string} params.rssUrl
 * @param {string} [params.category]  — catégorie produit (défaut 'autre')
 * @param {boolean} [params.isPublished]
 * @param {'manual'|'discover'|'auto'} [params.source] — 'manual' = action admin
 *   explicite (toujours publiée) ; 'discover'/'auto' = pipeline de score.
 * @returns {Promise<{show: object, created: boolean, decision?: object}>}
 */
async function importPodcastFromRss({ Show, Episode, rssUrl, category = 'autre', isPublished = true, source = 'manual' }) {
  // Valide le flux AVANT de créer quoi que ce soit (évite les podcasts vides).
  const { show: feedShow } = await fetchAndNormalizeFeed(rssUrl);

  // Catégorie : si l'appelant n'en précise pas une, on l'INFÈRE depuis le
  // titre + la description (chaque podcast va dans sa vraie catégorie :
  // dev personnel, famille, jeunesse… au lieu de tout laisser en
  // 'foi-spiritualite').
  if (!category || category === 'autre') {
    category = categorizePodcast(feedShow.title, feedShow.description);
  }

  // Score de pertinence — toujours calculé pour la transparence admin.
  const scored = computePodcastScore({
    title: feedShow.title,
    author: feedShow.author,
    description: feedShow.description,
    language: feedShow.language,
    categories: [],
    rssValid: true,
  });

  let autoStatus = 'manual';
  let publish = isPublished;
  let decision = null;

  // Pipeline automatique (découverte planifiée / import depuis les résultats
  // de recherche) : le score décide du sort du podcast.
  if (source === 'discover' || source === 'auto') {
    decision = decideAutoPublish(scored.score);
    autoStatus = decision.status;
    publish = decision.isPublished;
  }

  const fields = {
    category,
    isPublished: publish,
    title: feedShow.title,
    description: feedShow.description || '',
    author: feedShow.author || '',
    coverUrl: feedShow.coverUrl || '',
    websiteUrl: feedShow.websiteUrl || '',
    language: feedShow.language || 'fr',
    autoPublishStatus: autoStatus,
    score: scored.score,
    scoreBreakdown: scored.breakdown,
  };

  let show = await Show.findOne({ rssUrl });
  let created = false;

  if (show) {
    show = await Show.findByIdAndUpdate(show._id, { $set: fields }, { returnDocument: 'after' });
  } else {
    show = await Show.create({ ...fields, rssUrl });
    created = true;
  }

  // Insère/rafraîchit les épisodes du flux (déduplication par guid).
  await syncPodcastShow({ Show, Episode, show });

  return { show, created, decision };
}

module.exports = { importPodcastFromRss };

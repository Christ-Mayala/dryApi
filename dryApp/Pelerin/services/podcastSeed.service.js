/**
 * Seed des podcasts francophones par défaut (dryApp/Pelerin).
 *
 * Au démarrage du serveur, si le catalogue de podcasts externes est vide,
 * on importe une sélection de flux RSS chrétiens francophones réels et
 * stables. L'admin reste libre de les modifier / désactiver / supprimer, et
 * l'auto-découverte planifiée (Podcast Index) viendra enrichir le catalogue.
 *
 * Chaque URL est importée via le service d'import partagé (déduplication par
 * guid, jamais de ré-hébergement de l'audio). Une URL en échec n'empêche pas
 * les autres : les erreurs sont isolées et consignées.
 *
 * Désactivation : PODCAST_SEED_ENABLED=false.
 */
const { importPodcastFromRss } = require('./podcastImport.service');
const PodcastShowSchema = require('../features/podcastShow/model/podcastShow.schema');
const PodcastEpisodeSchema = require('../features/podcastEpisode/model/podcastEpisode.schema');

// Sélection de flux RSS chrétiens francophones (URLs réelles et stables).
const DEFAULT_PODCASTS = [
  {
    title: 'Enseignements — Christian Saboukoulou',
    rssUrl: 'https://feed.ausha.co/KXVXZHwK855A',
    category: 'enseignement',
  },
  {
    title: 'BA du christianisme',
    rssUrl: 'https://feeds.audiomeans.fr/feed/6446e36e-826a-4e69-8f58-b33b113794d9.xml',
    category: 'foi-spiritualite',
  },
  {
    title: 'Sanctuaire du Sacré-Cœur (Paray-le-Monial)',
    rssUrl: 'https://sacrecoeur-paray.org/feed/podcast/',
    category: 'priere',
  },
  {
    title: 'Foi & Quotidien',
    rssUrl: 'https://anchor.fm/s/e393162c/podcast/rss',
    category: 'vie-chretienne',
  },
  {
    title: "Puits de l'Évangile — Spiritualité",
    rssUrl: 'https://feed.ausha.co/gd9DpfKw5dXd',
    category: 'etude-biblique',
  },
  {
    title: 'Loyola Café',
    rssUrl: 'https://feed.ausha.co/B48J4H2POPej',
    category: 'foi-spiritualite',
  },
  {
    title: 'Place des religions (La Croix)',
    rssUrl: 'https://feed.ausha.co/bVOzmcG6wpjm',
    category: 'actualite',
  },
  {
    title: 'Pasteur John Piper vous répond',
    rssUrl: 'https://anchor.fm/s/11420f05c/podcast/rss',
    category: 'enseignement',
  },
];

/**
 * Importe les podcasts par défaut si le catalogue externe est vide.
 * @param {object} opts
 * @param {import('mongoose').Model} opts.Show
 * @param {import('mongoose').Model} opts.Episode
 * @param {string} [opts.appName]
 * @returns {Promise<{seeded: number, skipped: boolean, errors: string[]}>}
 */
async function seedDefaultPodcasts({ Show, Episode }) {
  const count = await Show.countDocuments({ rssUrl: { $ne: null, $ne: '' } });
  if (count > 0) {
    return { seeded: 0, skipped: true, errors: [] };
  }

  const errors = [];
  let seeded = 0;
  for (const p of DEFAULT_PODCASTS) {
    try {
      await importPodcastFromRss({
        Show,
        Episode,
        rssUrl: p.rssUrl,
        category: p.category,
        isPublished: true,
        source: 'manual',
      });
      seeded += 1;
      console.log(`[PODCAST-SEED] ✅ ${p.title}`);
    } catch (err) {
      errors.push(`${p.title}: ${String(err?.message || err).slice(0, 200)}`);
      console.error(`[PODCAST-SEED] ❌ ${p.title} — ${err?.message || err}`);
    }
  }
  return { seeded, skipped: false, errors };
}

module.exports = { seedDefaultPodcasts, DEFAULT_PODCASTS };

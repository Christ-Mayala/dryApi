/**
 * Moteur de catégorisation automatique des prédications de la maison.
 *
 * Analyse le titre de la vidéo par mots-clés (insensible à la casse et aux
 * accents) et renvoie une catégorie parmi : predication, enseignement,
 * temoignage, louange, autre. La catégorie explicite de la source YouTube
 * prime sur la catégorie déduite (voir housePreachingSync.service.js).
 */

// Liste canonique — doit rester synchrone avec
// src/features/housePreaching/types.ts (mobile) et le schema Mongoose.
const HOUSE_PREACHING_CATEGORIES = [
  'predication',
  'enseignement',
  'temoignage',
  'louange',
  'autre',
];

const DEFAULT_CATEGORY = 'predication';

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const CATEGORY_KEYWORDS = {
  louange: [
    'louange', 'adoration', 'chant', 'cantique', 'chorale', 'worship',
    'musique', 'medley', 'hymne', 'praise', 'gospel',
  ],
  temoignage: [
    'temoignage', 'temoignages', 'testimony', 'histoire de vie', 'mon histoire',
    'recit', 'miracles dans ma vie', 'grace vecue', 'dieu a agi',
  ],
  enseignement: [
    'enseignement', 'enseignements', 'etude biblique', 'etude de la bible',
    'cours', 'formation', 'doctrine', 'theologie', 'lesson', 'lecon',
    'apprendre', 'comprendre la bible', 'exegese', 'seminaire',
  ],
};

/**
 * Catégorise une prédication à partir de son titre.
 * @param {string} title
 * @returns {string} une catégorie de HOUSE_PREACHING_CATEGORIES.
 */
function categorizePreaching(title) {
  const haystack = normalize(title);
  if (!haystack) return DEFAULT_CATEGORY;

  let best = DEFAULT_CATEGORY;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const nk = normalize(kw);
      let idx = haystack.indexOf(nk);
      while (idx !== -1) {
        score++;
        idx = haystack.indexOf(nk, idx + nk.length);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  return best;
}

module.exports = {
  HOUSE_PREACHING_CATEGORIES,
  DEFAULT_CATEGORY,
  categorizePreaching,
};

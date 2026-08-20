/**
 * Catégorisation automatique des podcasts (dryApp/Pelerin).
 *
 * Attribue une catégorie produit (parmi les 12 de PodcastCategory) depuis le
 * titre + la description d'un flux RSS. Ordre du tableau = priorité : on teste
 * les catégories les plus spécifiques d'abord, la spiritualité générale sert
 * de fallback. Mots-clés français ET anglais (beaucoup de flux sont bilingues).
 *
 * Utilisée par :
 *   - podcastImport.service.js   (import RSS : seed, admin, découverte)
 *   - scripts de backfill        (reclasser les émissions déjà importées)
 */
const CATEGORY_KEYWORDS = [
  {
    category: 'dev-personnel',
    keywords: [
      // Cœur : mindset / croissance personnelle / coaching (ce que veut le
      // catalogue dev — pas la spiritualité générique).
      'développement personnel', 'developpement personnel', 'croissance personnelle',
      'personal growth', 'self-development', 'self help', 'self-help', 'self improvement',
      'mindset', 'état d’esprit', 'etat d esprit', 'mentalité', 'mentalite',
      'coaching', 'coach', 'coache', 'développement du potentiel', 'developpement du potentiel',
      'motivation', 'motivant', 'inspirant', 'confiance en soi', 'estime de soi', 'amour propre',
      'bien-être', 'wellbeing', 'wellness', 'santé mentale', 'mental health', 'psychologie',
      'psychology', 'productivité', 'productivity', 'habitudes', 'habits', 'discipline',
      'succès', 'success', 'réussite', 'reussite', 'objectifs', 'goals', 'potentiel',
      'counseling', 'counselling', 'conseil', 'conseils', 'sagesse pratique', 'outils pratiques',
    ],
  },
  {
    category: 'famille',
    keywords: [
      'famille', 'family', 'parent', 'parents', 'parentalité', 'parenting', 'mariage',
      'marriage', 'couple', 'enfants', 'children', 'éducation des enfants', 'père', 'mère',
      'foyer', 'home and family', 'relation conjugale',
    ],
  },
  {
    category: 'jeunesse',
    keywords: [
      'jeunesse', 'youth', 'jeunes', 'ados', 'adolescent', 'adolescents', 'teen', 'teens',
      'étudiants', 'students', 'génération', 'generation z', 'kids',
    ],
  },
  {
    category: 'leadership',
    keywords: [
      'leadership', 'leader', 'leaders', 'manager', 'management', 'entrepreneur',
      'entrepreneuriat', 'entreprise', 'business', 'pastorat', 'ministère', 'ministry',
      'influence', 'vision',
    ],
  },
  {
    category: 'louange',
    keywords: [
      'louange', 'worship', 'musique', 'music', 'chant', 'chanté', 'chants', 'song', 'songs',
      'adoration', 'gospel', 'chorale', 'hymne', 'hymn',
    ],
  },
  {
    category: 'priere',
    keywords: [
      'prière', 'priere', 'prayer', 'prie', 'intercession', 'intercessory', 'jeûne',
      'fasting', 'adoration continue',
    ],
  },
  {
    category: 'etude-biblique',
    keywords: [
      'étude biblique', 'etude biblique', 'bible study', 'étude de la bible', 'etude de la bible',
      'exégèse', 'exegese', 'exegesis', 'herméneutique', 'hermeneutics', 'commentaire biblique',
      'commentaire du jour', 'méditation biblique', 'meditation biblique', 'bible en 1 an',
    ],
  },
  {
    category: 'enseignement',
    keywords: [
      'enseignement', 'teaching', 'théologie', 'theologie', 'theology', 'doctrine', 'sermon',
      'prédication', 'predication', 'école du dimanche', 'sunday school', 'formation',
    ],
  },
  {
    category: 'temoignage',
    keywords: [
      'témoignage', 'temoignage', 'testimony', 'histoires', 'stories', 'story', 'récit',
      'recit', 'parcours de vie', 'conversion',
    ],
  },
  {
    category: 'actualite',
    keywords: [
      'actualité', 'actualite', 'news', 'info', 'quotidien', 'daily', 'journal', 'revue de presse',
      'politique', 'société', 'societe', 'culture',
    ],
  },
  {
    category: 'vie-chretienne',
    keywords: [
      'vie chrétienne', 'vie chretienne', 'christian life', 'disciple', 'discipleship',
      'relation avec dieu', 'marche avec dieu', 'suivre jésus', 'sainteté', 'saintete',
      'caractère chrétien', 'chretien', 'chrétien', 'christian',
    ],
  },
];

const FALLBACK_CATEGORY = 'foi-spiritualite';

/**
 * Marqueurs FORTS (expressions multi-mots très spécifiques) testés en premier :
 * ils priment sur les mots génériques. Ex. « Évangile du jour » + description
 * qui mentionne « croissance personnelle » (au sens spirituel) ne doit PAS
 * atterrir en dev-personnel mais en etude-biblique.
 */
const STRONG_MARKERS = [
  {
    category: 'etude-biblique',
    keywords: [
      'évangile du jour', 'evangile du jour', 'lectures du jour', 'lectures bibliques',
      'commentaires sur les lectures', 'messe du jour', 'parole du jour',
      'lectio divina', 'homélie', 'homelie', 'bible en 1 an', 'bible in one year',
    ],
  },
  {
    // Avant 'enseignement' : « théologie » dans la bio de l'animateur ne doit
    // pas écraser un vrai podcast de témoignages / vies de saints.
    category: 'temoignage',
    keywords: [
      // Uniquement les signaux très spécifiques : le mot générique « témoignages »
      // traîne dans beaucoup de descriptions (ex. « témoignages d'entrepreneurs »)
      // et détournerait des podcasts business/dev vers temoignage.
      'vie des saints', 'histoire d’un saint', 'histoires de saints', 'témoin de la foi',
      'temoins de la foi', 'récit de conversion', 'recit de conversion', 'parcours de conversion',
    ],
  },
  {
    category: 'enseignement',
    keywords: [
      'prédication', 'predication', 'sermon', 'théologie', 'theologie', 'doctrine',
      'enseignement biblique', 'école du dimanche', 'sunday school', 'cours biblique',
    ],
  },
  {
    category: 'priere',
    keywords: ['intercession', 'jeûne', 'jeune et priere', 'adoration continue', 'chapelet', 'rosaire'],
  },
  {
    category: 'louange',
    keywords: ['musique chrétienne', 'musique chretienne', 'chorale', 'chants de louange', 'gospel'],
  },
];

/**
 * Catégorise un podcast depuis son titre et sa description.
 * @param {string} title
 * @param {string} [description]
 * @returns {string} l'une des 12 catégories produit.
 */
function categorizePodcast(title = '', description = '') {
  const haystack = `${title} ${description}`.toLowerCase();
  // 1. Marqueurs forts — signaux spécifiques, priorité absolue.
  for (const { category, keywords } of STRONG_MARKERS) {
    if (keywords.some((k) => haystack.includes(k.toLowerCase()))) {
      return category;
    }
  }
  // 2. Mots-clés génériques (les plus spécifiques d'abord).
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => haystack.includes(k.toLowerCase()))) {
      return category;
    }
  }
  return FALLBACK_CATEGORY;
}

/**
 * Détection de contenu CATHOLIQUE (marqueurs liturgiques / institutionnels).
 *
 * Le catalogue du Pèlerin est évangélique/charismatique : l'auto-découverte
 * ne doit pas importer de podcasts catholiques (messes, évangile du jour,
 * communautés religieuses…). Marqueurs de TITRE = signal très fort ; les
 * marqueurs de description ne comptent qu'en accumulation (≥ 2) pour éviter
 * les faux positifs sur des descriptions qui citent des sources catholiques.
 */
const CATHOLIC_TITLE_MARKERS = [
  'catholique', 'église catholique', 'eglise catholique', 'pape', 'vatican',
  'sacré-cœur', 'sacre-coeur', 'rosaire', 'chapelet', 'messe', 'homélie', 'homelie',
  'paroisse', 'curé', 'cure de', 'aumônier', 'aumonier', 'sœurs', 'soeurs',
  'servantes de', 'frères de saint-jean', 'frere de saint-jean', 'istituto', 'istitut',
  'amen media', 'papa spi', 'podcast domini', 'lectio divina', 'lectures du jour',
  'messe du jour', 'évangile du jour', 'evangile du jour', 'jour du seigneur',
  'sacrée histoire', 'sacree histoire', 'carmel', 'bénédictin', 'benedictin',
  'dominicain', 'franciscain', 'séminaire', 'seminaire', 'diocèse', 'diocese', 'paroisse',
  'rcf alsace', 'imitation de jésus-christ', 'divine volonté', 'divine volonte',
];

const CATHOLIC_DESC_MARKERS = [
  'catholique', 'église catholique', 'eglise catholique', 'pape', 'vatican',
  'messe', 'homélie', 'homelie', 'paroisse', 'curé', 'cure de', 'aumônier', 'aumonier',
  'sacré-cœur', 'sacre-coeur', 'rosaire', 'chapelet', 'sœur', 'soeur', 'frère de',
  'ordre religieux', 'diocèse', 'diocese', 'séminaire', 'seminaire', 'aumônerie',
  'aumonerie', 'catéchisme', 'catechisme', 'baptême catholique', 'vêpres', 'vespres',
  'liturgie', 'sacrement', 'eucharistie', 'confession', 'clergé', 'clerge', 'évêque', 'eveque',
  'frères de saint-jean', 'frere de saint-jean', 'missionnaires de', 'soeurs de', 'sœurs de',
  'rcf ', 'religieux dominicain', 'prêtre catholique', 'pretre catholique', 'divine volonté',
  'confesseur', 'nihil obstat', 'imprimatur', 'école de la divine volonté', 'ecole de la divine volonte',
];

/**
 * @param {string} [title]
 * @param {string} [description]
 * @param {string} [author] — l'auteur porte parfois le signal (ex. « À l'école
 *   de la Divine Volonté »), on l'ajoute au foin.
 * @returns {boolean} true si le podcast est clairement catholique.
 */
function isCatholicPodcast(title = '', description = '', author = '') {
  const t = title.toLowerCase();
  if (CATHOLIC_TITLE_MARKERS.some((m) => t.includes(m))) return true;
  const hay = `${description} ${author}`.toLowerCase();
  const hits = CATHOLIC_DESC_MARKERS.filter((m) => hay.includes(m)).length;
  return hits >= 2;
}

/** Liste des catégories produit reconnues (pour validation/backfill). */
const PRODUCT_CATEGORIES = [
  'foi-spiritualite',
  'enseignement',
  'vie-chretienne',
  'temoignage',
  'jeunesse',
  'dev-personnel',
  'priere',
  'famille',
  'leadership',
  'etude-biblique',
  'actualite',
  'louange',
];

module.exports = {
  categorizePodcast,
  isCatholicPodcast,
  CATEGORY_KEYWORDS,
  STRONG_MARKERS,
  PRODUCT_CATEGORIES,
  FALLBACK_CATEGORY,
};

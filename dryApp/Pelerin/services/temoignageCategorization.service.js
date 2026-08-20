/**
 * Moteur de catégorisation automatique des témoignages.
 *
 * Analyse le contenu (titre + avant + rencontre + après) par scoring de
 * mots-clés (insensible à la casse et aux accents) et renvoie une catégorie
 * thématique. Utilisé à la création si l'utilisateur n'a pas fourni de
 * catégorie valide. L'admin garde la main via PUT /temoignage/:id.
 */

// Liste canonique des catégories — doit rester synchrone avec
// src/features/temoignage/types.ts (mobile).
const TEMOIGNAGE_CATEGORIES = [
  'conversion',
  'guerison',
  'delivrance',
  'famille',
  'deuil',
  'travail',
  'foi',
  'autre',
];

const DEFAULT_CATEGORY = 'autre';

// Normalisation : minuscules + suppression des accents (diacritiques).
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Mots-clés par catégorie. Chaque entrée est normalisée à la volée.
const CATEGORY_KEYWORDS = {
  conversion: [
    'conversion', 'converti', 'convertie', 'nouvelle naissance', 'ne de nouveau',
    'nee de nouveau', 'rencontre avec dieu', 'jai donne ma vie', 'jai donne mon coeur',
    'accepte jesus', 'accepte christ', 'reviens a dieu', 'revenu a dieu', 'retour a dieu',
    'bapteme', 'baptise', 'baptisee', 'transformation', 'changement de vie',
    'vie nouvelle', 'nouvelle vie', 'repenti', 'repentance', 'perdu et retrouve',
    'loin de dieu', 'egare', 'egaree',
  ],
  guerison: [
    'guerison', 'gueri', 'guerie', 'guerir', 'maladie', 'malade', 'cancer',
    'tumeur', 'operation', 'opere', 'operee', 'hopital', 'hospitalise', 'infirme',
    'handicap', 'paralyse', 'paralysee', 'aveugle', 'cecite', 'sourd', 'muet',
    'douleur', 'souffrance physique', 'fibrome', 'diabete', 'ulcere', 'sida',
    'miracle de guerison', 'retabli', 'retablie', 'sante', 'medecins',
  ],
  delivrance: [
    'delivrance', 'delivre', 'delivree', 'delivrer', 'addiction', 'dependance',
    'alcool', 'alcoolique', 'drogue', 'toxicomane', 'cigarette', 'tabac',
    'pornographie', 'impurete', 'demon', 'demoniaque', 'oppression', 'possession',
    'esprit impur', 'malediction', 'sortilege', 'marabout', 'fetichisme',
    'prison', 'emprisonne', 'gang', 'violence', 'colere', 'haine', 'ranceur',
    'depression', 'idees noires', 'suicidaire', 'liberte', 'libere', 'libere',
  ],
  famille: [
    'famille', 'couple', 'mariage', 'marie', 'mariee', 'epoux', 'epouse',
    'conjoint', 'enfant', 'enfants', 'parent', 'parents', 'pere', 'mere',
    'fils', 'fille', 'frere', 'soeur', 'divorce', 'foyer', 'menage', 'famille recomposee',
    'belle-famille', 'beau-papa', 'belle-maman', 'grossesse', 'enceinte',
    'mariage en crise', 'relation familiale', 'heritage', 'dispute familiale',
  ],
  deuil: [
    'deuil', 'mort', 'decede', 'decedee', 'perdu un etre cher', 'perdu ma mere',
    'perdu mon pere', 'perdu mon enfant', 'enterrement', 'obseques', 'orphelin',
    'orpheline', 'veuve', 'veuf', 'chagrin', 'tristesse', 'consolation',
    'absent', 'disparu', 'disparue', 'tombe', 'sepulture',
  ],
  travail: [
    'travail', 'emploi', 'chomage', 'chomeur', 'entretien', 'recrutement',
    'entreprise', 'business', 'commerce', 'boutique', 'salaire', 'paie',
    'licencie', 'licenciee', 'deboire professionnel', 'echec professionnel',
    'etudes', 'examen', 'diplome', 'universite', 'ecole', 'classe', 'reussite scolaire',
    'argent', 'dette', 'dettes', 'finances', 'credit', 'pauvrete', 'provision',
    'sacre', 'impossible financierement',
  ],
  foi: [
    'foi', 'confiance en dieu', 'priere', 'prier', 'jeun', 'adoration',
    'louange', 'lecture de la bible', 'parole de dieu', 'verset',
    'doute', 'epreuve', 'tentation', 'combat spirituel', 'spirituel',
    'presence de dieu', 'amour de dieu', 'grace', 'misericorde', 'esperance',
    'abandon', 'soumission', 'obeissance', 'service', 'ministere', 'eglise',
  ],
};

/**
 * Catégorise un témoignage à partir de son contenu.
 * @param {string} text - title + before + encounter + after concaténés.
 * @returns {string} une catégorie de TEMOIGNAGE_CATEGORIES.
 */
function categorizeTemoignage(text) {
  const haystack = normalize(text);
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

/**
 * Valide qu'une catégorie fournie par le client est connue.
 * @param {string|null|undefined} category
 * @returns {string|null} la catégorie si valide, sinon null.
 */
function isValidTemoignageCategory(category) {
  return category && TEMOIGNAGE_CATEGORIES.includes(category) ? category : null;
}

module.exports = {
  TEMOIGNAGE_CATEGORIES,
  DEFAULT_CATEGORY,
  categorizeTemoignage,
  isValidTemoignageCategory,
};

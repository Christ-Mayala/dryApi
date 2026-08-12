#!/usr/bin/env node
/**
 * Seed du plan de lecture "Bible en 1 an" pour le tenant Pelerin.
 *
 * Repartit les 1189 chapitres de la Bible sur 365 jours de maniere
 * approximativement uniforme, avec :
 * - Ancien Testament (39 livres) : lus une fois
 * - Nouveau Testament (27 livres) : lus deux fois
 *
 * Usage : node scripts/seed/seed-pelerin-reading-plan.js
 */

require('dotenv').config();
const dns = require('dns');

try {
  dns.setServers(['1.1.1.1', '8.8.8.8', ...dns.getServers()]);
} catch (e) { /* best-effort */ }

const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');
const { BIBLE_BOOKS } = require('../../dryApp/Pelerin/seed.js');

const ReadingPlanSchema = require('../../dryApp/Pelerin/features/readingPlan/model/readingPlan.schema.js');

const APP_NAME = 'Pelerin';
const PLAN_TITLE = 'Bible en 1 an';
const PLAN_DESCRIPTION = 'Un parcours structuré pour lire l\'ensemble de la Bible en 365 jours. Ancien Testament lu une fois, Nouveau Testament lu deux fois.';

const THEMES_BY_BOOK = {
  genese: 'creation', exode: 'delivrance', levitique: 'saintete', nombres: 'desert', deuteronome: 'alliance',
  josue: 'conquete', juges: 'cycles', ruth: 'fidelite', '1samuel': 'royaute', '2samuel': 'royaute',
  '1rois': 'royaute', '2rois': 'exil', '1chroniques': 'culte', '2chroniques': 'culte', esdras: 'retour',
  nehemie: 'reconstruction', esther: 'delivrance', job: 'souffrance', psaumes: 'priere', proverbes: 'sagesse',
  ecclesiaste: 'sens', cantique: 'amour', esaie: 'prophetie', jeremie: 'prophetie', lamentations: 'deuil',
  ezechiel: 'prophetie', daniel: 'fidelite', osee: 'amour', joel: 'jugement', amos: 'justice',
  abdias: 'jugement', jonas: 'mission', michee: 'justice', nahum: 'jugement', habacuc: 'foi',
  sophonie: 'espoir', agee: 'temple', zacharie: 'promesse', malachie: 'alliance',
  matthieu: 'evangile', marc: 'evangile', luc: 'evangile', jean: 'evangile', actes: 'eglise',
  romains: 'doctrine', '1corinthiens': 'eglise', '2corinthiens': 'eglise', galates: 'liberte',
  ephesiens: 'identite', philippiens: 'joie', colossiens: 'souverainete', '1thessaloniciens': 'retour',
  '2thessaloniciens': 'retour', '1timothee': 'leadership', '2timothee': 'perseverance', tite: 'doctrine',
  philemon: 'grace', hebreux: 'superiorite', jacques: 'foi', '1pierre': 'esperance', '2pierre': 'avertissement',
  '1jean': 'amour', '2jean': 'verite', '3jean': 'hospitalite', jude: 'combat', apocalypse: 'victoire'
};

const REFLECTIONS = {
  creation: 'Dieu crée le monde avec ordre et beauté.',
  delivrance: 'Dieu délivre son peuple quand il crie vers lui.',
  saintete: 'La sainteté de Dieu appelle à une vie séparée.',
  desert: 'Le désert révèle le cœur et enseigne la dépendance.',
  alliance: 'Dieu établit une alliance durable avec son peuple.',
  conquete: 'La foi conduit à la victoire, même contre l\'impossible.',
  cycles: 'Les cycles d\'obéissance et d\'apostasie révèlent la grâce persistante de Dieu.',
  fidelite: 'Dieu écrit des histoires de fidélité là où on ne l\'attend pas.',
  royaute: 'Le royaume de Dieu se bâtit dans la fragilité humaine.',
  exil: 'L\'exil est une école de repentance et d\'espérance.',
  culte: 'Le culte renouvelle l\'alliance et recentre le cœur.',
  retour: 'Le retour à Dieu commence par un cœur qui se repent.',
  reconstruction: 'Reconstruire, c\'est d\'abord reconstruire ce qui compte le plus.',
  priere: 'La prière est le souffle de la vie spirituelle.',
  sagesse: 'La sagesse commence par la crainte de l\'Éternel.',
  sens: 'Chercher Dieu, c\'est trouver le sens de la vie.',
  amour: 'L\'amour de Dieu est plus fort que toute distance.',
  prophete: 'Les prophètes parlent au nom de Dieu pour rappeler l\'alliance.',
  souffrance: 'Dans la souffrance, Dieu reste présent.',
  foi: 'La foi choisit de faire confiance même quand tout s\'obscurcit.',
  esperance: 'L\'espérance ne déçoit point parce que Dieu est fidèle.',
  evangile: 'L\'évangile est une bonne nouvelle pour tous.',
  eglise: 'L\'Église est le peuple de Dieu en marche.',
  doctrine: 'La doctrine garde le cœur dans la vérité.',
  liberte: 'La liberté en Christ est un appel à aimer.',
  identite: 'En Christ, nous sommes une nouvelle création.',
  joie: 'La joie chrétienne ne dépend pas des circonstances.',
  souverainete: 'Christ règne sur toute chose.',
  retour: 'Nous attendons le retour glorieux de Jésus.',
  leadership: 'Le leadership spirituel est un service humble.',
  perseverance: 'Persévérer, c\'est garder les yeux fixés sur Dieu.',
  grace: 'La grâce suffit, même dans la faiblesse.',
  superiorite: 'Christ est supérieur à tout sacrifice ancien.',
  combat: 'Le combat spirituel se gagne par la vérité et la prière.',
  victoire: 'Enfin, la victoire : Dieu triomphe de tout.',
  temple: 'Le temple de Dieu, c\'est désormais le cœur du croyant.',
  promesse: 'Les promesses de Dieu sont oui et amen.',
  jugement: 'Le jugement appelle à la repentance avant tout.',
  justice: 'Dieu aime la justice et veut la voir établie.',
  mission: 'La mission commence par une rencontre avec Dieu.',
  egglise: 'L\'Église grandit quand elle prie et annonce.',
  encouragement: 'Les Écritures encouragent à persévérer dans la foi.',
  priere_intercession: 'Intercéder, c\'est porter les autres devant Dieu.',
  adoration: 'Adorer, c\'est reconnaître que Dieu est digne.',
  louange: 'La louange transforme l\'atmosphère du cœur.',
  mariage: 'Le mariage reflète l\'amour fidèle de Dieu.',
  sagesse_pratique: 'La sagesse s\'applique au quotidien.',
  souffrance_esperance: 'Même dans l\'épreuve, l\'espérance demeure.',
  promesse_alliance: 'L\'alliance de Dieu est éternelle.',
  royaume_david: 'Le royaume de David annonce le royaume de Christ.',
  prophetie_accomplissement: 'Les prophéties trouvent leur accomplissement en Jésus.',
  retour_exil: 'Le retour de l\'exil préfigure la rédemption finale.',
  grace_sauvetage: 'La grâce sauve là où le mérite échoue.',
  loi_amour: 'La loi trouve son accomplissement dans l\'amour.',
  wilderness: 'Le désert prépare à la Terre promise.',
  courage: 'Dieu donne le courage pour avancer.',
  patience: 'La patience porte du fruit en son temps.',
  humilite: 'L\'humilité ouvre la porte à la grâce.',
  reconciliation: 'Dieu réconcilie ce qui était divisé.',
  renovation: 'Dieu renouvelle ce qui est usé.',
  victoire_finale: 'La victoire finale appartient à Dieu.'
};

function buildReadingPlan() {
  const days = [];
  let day = 1;

  const otBooks = BIBLE_BOOKS.filter((b) => b.testament === 'AT');
  const ntBooks = BIBLE_BOOKS.filter((b) => b.testament === 'NT');

  const otChapters = [];
  const ntChapters = [];

  for (const book of otBooks) {
    for (let c = 1; c <= book.chapterCount; c++) {
      otChapters.push({ bookCode: book.code, chapter: c, theme: THEMES_BY_BOOK[book.code] || 'general' });
    }
  }

  for (const book of ntBooks) {
    for (let c = 1; c <= book.chapterCount; c++) {
      ntChapters.push({ bookCode: book.code, chapter: c, theme: THEMES_BY_BOOK[book.code] || 'general' });
    }
  }

  // NT lu deux fois : on duplique
  const doubledNT = [...ntChapters, ...ntChapters];
  const total = otChapters.length + doubledNT.length;

  // Repartition approximative sur 365 jours
  const otPerDay = Math.max(1, Math.floor(otChapters.length / 365));
  const ntPerDay = Math.max(1, Math.floor(doubledNT.length / 365));

  let otIndex = 0;
  let ntIndex = 0;

  while (day <= 365) {
    const batch = [];

    for (let i = 0; i < otPerDay && otIndex < otChapters.length; i++) {
      batch.push(otChapters[otIndex++]);
    }
    for (let i = 0; i < ntPerDay && ntIndex < doubledNT.length; i++) {
      batch.push(doubledNT[ntIndex++]);
    }

    if (batch.length === 0) break;

    const primary = batch[0];
    const theme = primary.theme || 'general';
    const reflection = REFLECTIONS[theme] || 'Médite ce passage et laisse Dieu te parler.';

    days.push({
      day,
      bookCode: primary.bookCode,
      chapter: primary.chapter,
      verseStart: 1,
      verseEnd: undefined,
      theme,
      reflection,
      estimatedMinutes: Math.max(8, Math.min(25, batch.length * 5)),
      label: `Jour ${day} : ${theme}`,
    });

    day++;
  }

  return days;
}

const main = async () => {
  console.log('[seed-reading-plan] Connexion au cluster MongoDB Atlas...');
  await connectCluster();

  const db = getTenantDB(APP_NAME);
  console.log(`[seed-reading-plan] Base cible : ${db.name}`);

  const ReadingPlan = getModel(APP_NAME, 'ReadingPlan', ReadingPlanSchema);

  const existing = await ReadingPlan.findOne({ title: PLAN_TITLE });
  if (existing) {
    console.log(`[seed-reading-plan] Plan "${PLAN_TITLE}" deja present. Suppression et recreation...`);
    await ReadingPlan.deleteOne({ _id: existing._id });
  }

  const days = buildReadingPlan();
  console.log(`[seed-reading-plan] ${days.length} jours generes.`);

  const plan = await ReadingPlan.create({
    title: PLAN_TITLE,
    description: PLAN_DESCRIPTION,
    theme: 'lecture-annuelle',
    icon: 'calendar-outline',
    durationDays: days.length,
    isPublished: true,
    days,
    label: 'Plan de lecture annuel',
  });

  console.log(`[seed-reading-plan] Plan cree : ${plan.title} (${plan.durationDays} jours)`);
  process.exit(0);
};

main().catch((err) => {
  console.error('[seed-reading-plan] Erreur fatale :', err);
  process.exit(1);
});

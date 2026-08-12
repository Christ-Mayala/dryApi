#!/usr/bin/env node
/**
 * Migration idempotente d'enrichissement du contenu Pelerin.
 *
 * Complète le seed de base (`seed.js`) en ajoutant, sans jamais toucher ni
 * supprimer le contenu existant :
 *  - des PARCOURS additionnels (thèmes sous-représentés dans le seed de base)
 *    pour offrir plus de choix ("Pathways"),
 *  - une large gamme de QUIZ de niveau "facile" couvrant la Bible dans sa
 *    globalité (Ancien / Nouveau Testament, thématiques de foi, prière…).
 *
 * Idempotence : chaque document est upserté par son `title` (parcours) ou par
 * sa `question` (quiz) — un second lancement ne crée pas de doublons et ne
 * modifie que le document s'il a changé. Les progrès utilisateurs
 * (ParcoursProgress) référencent un parcours par `_id`, donc restent valides.
 *
 * Usage : npm run seed:pelerin-content
 */

require('dotenv').config();
const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const ParcoursSchema = require('../../dryApp/Pelerin/features/parcours/model/parcours.schema');
const QuizSchema = require('../../dryApp/Pelerin/features/quiz/model/quiz.schema');

const APP_NAME = 'Pelerin';
const log = (m) => console.log(`[seed-pelerin-content] ${m}`);

// Trois nouveaux parcours ("Pathways") : prière quotidienne, foi au travail,
// Esprit-Saint — pour élargir le sentiment de choix/utilisateur.
const TODAY_PARCOURS = [
  {
    title: `Prière quotidienne`,
    description: `Un parcours pour apprendre à s'asseoir chaque jour avec Dieu, sans formalisme. Cinq minutes par jour suffisent pour cultiver un cœur de prière.`,
    theme: 'priere',
    icon: 'hand-left-outline',
    estimatedDays: 7,
    isPublished: true,
    steps: [
      { order: 1, title: `Un moment pour soi, un moment pour Dieu`, bookCode: 'matthieu', chapter: 6, verseStart: 6, meditation: `Jésus ne demande pas un discours quand on prie : il demande un cœur ouvert.`, reflectionQuestion: `Quel pèse sur toi aujourd'hui que tu pourrais déposer en prière ?`, practicalExercise: `Fixe-toi 2 minutes : souris, parle ou écris une confidence à haute voix.` },
      { order: 2, title: `La prière sincère`, bookCode: 'romains', chapter: 8, verseStart: 26, meditation: `L’Esprit intercède pour nous avec des soupirs que la parole ne peut dire.`, reflectionQuestion: `Où ressens-tu le plus le poids du monde sur toi ?`, practicalExercise: `Respire profondément et prie simplement : "Seigneur, je suis là".` },
      { order: 3, title: `Prière pour ceux qui nous blessent`, bookCode: 'luc', chapter: 6, verseStart: 27, meditation: `Aimer ses bourreaux, c’est la prière transformée en action concrète.`, reflectionQuestion: `Y a-t-il quelqu’un dont tu portes encore rancœur ?`, practicalExercise: `Prié pour une personne difficile aujourd'hui, sans la nommer.` },
      { order: 4, title: `Le Seigneur est avec toi dans la prière`, bookCode: 'matthieu', chapter: 18, verseStart: 19, meditation: `Où deux ou trois s’unissent dans ma prière, le Seigneur est là.`, reflectionQuestion: `Qui pourrait prier avec toi aujourd'hui ?`, practicalExercise: `Envoie un message court à un ami : "Je prie pour toi aujourd'hui".` },
      { order: 5, title: `Demander sans craindre`, bookCode: '1john', chapter: 5, verseStart: 14, meditation: `La prière audacieuse est ancrée dans la confiance, pas dans l’orgueil.`, reflectionQuestion: `Quel don de Dieu pourrais-tu demander sans hésiter ?`, practicalExercise: `Écris une demande audacieuse et place-la dans un endroit visible.` },
      { order: 6, title: `Remercier dans l’adversité`, bookCode: '1thessaloniciens', chapter: 5, verseStart: 16, meditation: `Remercier, ce n’est pas minimiser la douleur : c’est reconnaître la présence de Dieu au milieu d’elle.`, reflectionQuestion: `Pourquoi trouves-tu si difficile de remercier aujourd'hui ?`, practicalExercise: `Liste trois choses, même petites, pour lesquelles tu peux remercier.` },
      { order: 7, title: `Une prière de nuit`, bookCode: 'psaumes', chapter: 4, verseStart: 4, meditation: `La prière du soir n’est pas un bilan : c’est une remise en toi-même dans les bras du berger.`, reflectionQuestion: `Quel mot garderais-tu de cette semaine de prière ?`, practicalExercise: `Revoyez ta semaine en silence, puis prie une phrase simple de lâcher-prise.` },
    ],
  },
  {
    title: `Vivre la foi au travail et à l’école`,
    description: `Chaque lieu de vie (bureau, salle de classe, réunion…) est un théâtre d’opportunité. Ce parcours t’aide à vivre ta foi là où tu es chaque jour.`,
    theme: 'vie-quotidienne',
    icon: 'briefcase-outline',
    estimatedDays: 5,
    isPublished: true,
    steps: [
      { order: 1, title: `Ton lieu de vie est une mission`, bookCode: 'matthieu', chapter: 5, verseStart: 13, meditation: `Tu n’es pas là par hasard : tu es la lumière pour ce lieu.`, reflectionQuestion: `Quel regard les autres portent-t-ils sur toi ?`, practicalExercise: `Aujourd'hui, agis d’abord comme un sursis pour quelqu’un.` },
      { order: 2, title: `L’honêteté en débats`, bookCode: 'proverbes', chapter: 12, verseStart: 22, meditation: `La vérité est un terrain d’entraînement de la foi au travail.`, reflectionQuestion: `As-tu déjà "embellé" un fait pour paraître mieux ?`, practicalExercise: `Choisis un moment d’honnêteté difficile et choisis la vérité.` },
      { order: 3, title: `Servir sans attendre la reconnaissance`, bookCode: '2corinthiens', chapter: 4, verseStart: 5, meditation: `On ne sert Dieu que dans l’ombre, mais la récompense vient en pleine lumière.`, reflectionQuestion: `Quel geste invisible pourrais-tu faire aujourd'hui ?`, practicalExercise: `Accomplit une tâche ingrate sans en parler.` },
      { order: 4, title: `Un esprit de service dans la compétition`, bookCode: 'philippiens', chapter: 2, verseStart: 3, meditation: `La grandeur chrétienne se mesure à ce qu’on donne, pas à ce qu’on prend.`, reflectionQuestion: `Où te sens-tu "au-dessus" des autres dans ta vie de tous les jours ?`, practicalExercise: `Offre un compliment authentique à un collègue ou un voisin.` },
      { order: 5, title: `La paix dans l’angoisse professionnelle`, bookCode: 'philippiens', chapter: 4, verseStart: 6, meditation: `La paix que Dieu donne déborde les échecs de ton rapport.`, reflectionQuestion: `Quel est ton "prochain grand défi" ?`, practicalExercise: `Liste tes sources d’anxiété, puis remet-les une par une en prière.` },
    ],
  },
  {
    title: `L’Esprit-Saint dans ma vie`,
    description: `Ces six journées t’invitent à reconnaître les "petits" signes de la présence de l’Esprit dans le quotidien.`,
    theme: 'esprit-saint',
    icon: 'flash-outline',
    estimatedDays: 6,
    isPublished: true,
    steps: [
      { order: 1, title: `Reconnaître la voix intérieure`, bookCode: 'jean', chapter: 10, verseStart: 27, meditation: `L’Esprit ne crie pas : il murmure. Apprends à reconnaître le "toi" que tu as en toi.`, reflectionQuestion: `Quand as-tu le plus senti la paix intérieure cette semaine ?`, practicalExercise: `Prends 5 minutes de silence, sans écran, à écouter.` },
      { order: 2, title: `La force dans la faiblesse`, bookCode: '2corinthiens', chapter: 12, verseStart: 9, meditation: `L’Esprit se manifeste le plus fort là où nous sommes fragiles.`, reflectionQuestion: `Quelle faiblesse portes-tu comme une honte ?`, practicalExercise: `Partage une faiblesse à une personne de confiance aujourd'hui.` },
      { order: 3, title: `L’amour comme preuve`, bookCode: '1corinthiens', chapter: 13, verseStart: 4, meditation: `On reconnaît l’Esprit à l’amour qu’il produit, pas aux émotions.`, reflectionQuestion: `Qui t’énerve le plus en ce moment ?`, practicalExercise: `Agit avec calme et bonté envers cette personne, sans la mentionner.` },
      { order: 4, title: `La résilience espérée`, bookCode: 'romains', chapter: 15, verseStart: 13, meditation: `L’Esprit est le Dieu de l’espérance : il remplit de joie dans l’espérance.`, reflectionQuestion: `Que te demande le "demain" que tu affrontes ?`, practicalExercise: `Note une parole d’espérance et lis-la trois fois.` },
      { order: 5, title: `L’unité dans la diversité`, bookCode: '1corinthiens', chapter: 12, verseStart: 12, meditation: `Chaque don, chaque personne, chaque voix compte à l’Esprit.`, reflectionQuestion: `Quel don caches-tu ?`, practicalExercise: `Mets en avant un don que tu as vu chez quelqu’un d’autre aujourd'hui.` },
      { order: 6, title: `Agir par confiance`, bookCode: 'galates', chapter: 5, verseStart: 6, meditation: `Marcher par l’Esprit, c’est ne plus compter sur ses propres forces.`, reflectionQuestion: `Quel "plan" tiens-tu à cacher à Dieu aujourd'hui ?`, practicalExercise: `Dépose un projet sur lequel tu comptes encore en prière silencieuse.` },
    ],
  },
];

// 20 quiz niveau FACILE, couvrant AT, NT et thématiques de foi, sans
// ambiguïté de réponse (pour rester accessible à un·e débutant·e).
const TODAY_QUIZZES = [
  // Ancien Testament
  { question: `Qui a construit une arque pour survivre au déluge ?`, options: ['Noé', 'Abraham', 'Moïse', 'David'], correctAnswerIndex: 0, explanation: `Genèse 6-9 : Dieu charge Noé de construire une arque pour sauver sa famille et les animaux.`, theme: 'ancien-testament', difficulty: 'easy', bookCode: 'genese' },
  { question: `Quel roi d’Israël est resté célèbre pour sa sagesse ?`, options: ['Salomon', 'Saül', 'David', 'Esaïe'], correctAnswerIndex: 0, explanation: `Salomon, fils de David, demande la sagesse à Dieu et en devient le symbole (1 Rois 3).`, theme: 'ancien-testament', difficulty: 'easy', bookCode: '1rois' },
  { question: `Combien de fois l’Égypte a-t-elle été frappée ?`, options: ['10', '7', '12', '3'], correctAnswerIndex: 0, explanation: `Exode 7-12 décrit dix fléaux successifs avant que Pharaon ne lâche le peuple.`, theme: 'ancien-testament', difficulty: 'easy', bookCode: 'exode' },
  { question: `Qui a combattu le géant Goliath avec une fronde ?`, options: ['David', 'Samson', 'Josué', 'Gédéon'], correctAnswerIndex: 0, explanation: `1 Samuel 17 : le jeune David vainc Goliath grâce à la foi et une fronde.`, theme: 'ancien-testament', difficulty: 'easy', bookCode: '1samuel' },
  { question: `Dans quel livre trouve-t-on la loi des dix commandements ?`, options: ['Exode', 'Lévitique', 'Nombres', 'Deutéronome'], correctAnswerIndex: 0, explanation: `Exode 20 contient la loi des dix commandements donnée à Moïse.`, theme: 'ancien-testament', difficulty: 'easy', bookCode: 'exode' },
  { question: `Quel prophète a été mis dans la fosse aux lions et non blessé ?`, options: ['Daniel', 'Jonas', 'Ézéchiel', 'Jérémie'], correctAnswerIndex: 0, explanation: `Daniel 6 : il est livré aux lions mais Dieu ferme la gueule du félin.`, theme: 'ancien-testament', difficulty: 'easy', bookCode: 'daniel' },
  { question: `Quel livre de la Bible est le plus poétique ?`, options: ['Psaumes', 'Proverbes', 'Job', 'Ésaïe'], correctAnswerIndex: 0, explanation: `Les Psaumes sont des prières/chants poétiques adressés à Dieu.`, theme: 'ancien-testament', difficulty: 'easy', bookCode: 'psaumes' },
  // Nouveau Testament
  { question: `Quel apôtre a trahi Jésus pour trente pièces d’argent ?`, options: ['Judas Iscariot', 'Pierre', 'Thomas', 'Jean'], correctAnswerIndex: 0, explanation: `Matthieu 26 rapporte que Judas livre Jésus aux autorités pour trente pièces d’argent.`, theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'matthieu' },
  { question: `Qui a condamné Jésus à la crucifixion ?`, options: ['Pilate', 'Hérode', 'César', 'Nicolas'], correctAnswerIndex: 0, explanation: `Pilate, gouverneur romain, décide de la crucifixion de Jésus.`, theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'luc' },
  { question: `Quel évangile raconte le mieux l’enfance de Jésus ?`, options: ['Luc', 'Matthieu', 'Jean', 'Marc'], correctAnswerIndex: 0, explanation: `Luc 1-2 détaille l’annonce, la naissance et l’enfance de Jésus.`, theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'luc' },
  { question: `Combien d’anges sont apparus aux bergers ?`, options: ['Une foule céleste', 'Deux', 'Trois', 'Cinq'], correctAnswerIndex: 0, explanation: `Luc 2 parle d’une "multitude de la garde céleste" annonçant la naissance de Jésus.`, theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'luc' },
  { question: `Que signifie le nom "Emmanuel" ?`, options: ['Dieu avec nous', 'Sauveur', 'Roi des rois', 'Agneau de Dieu'], correctAnswerIndex: 0, explanation: `Matthieu 1 : Emmanuel signifie "Dieu est avec nous".`, theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'matthieu' },
  { question: `Qui a ressuscité un mort avant sa propre crucifixion ?`, options: ['Jésus', 'Moïse', 'Élisée', 'Pierre'], correctAnswerIndex: 0, explanation: `Jésus a ressuscité Luckas (Lazare) et plus tard ressortira de sa tombe.`, theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'jean' },
  { question: `Combien de disciples proches Jésus a-t-il choisis ?`, options: ['12', '10', '7', '70'], correctAnswerIndex: 0, explanation: `Les Évangiles nomment les douze apôtres choisis par Jésus.`, theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'matthieu' },
  // Thématiques de foi / prière
  { question: `Quel est le premier commandement du Décalogue ?`, options: ['Aimer Dieu de tout son cœur', 'Ne pas voler', 'Ne pas tuer', 'Ne pas porter de faux témoignage'], correctAnswerIndex: 0, explanation: `Exode 20:3-4 : "Tu aimeras l’Éternel ton Dieu de tout ton cœur."`, theme: 'feu-dieu', difficulty: 'easy', bookCode: 'exode' },
  { question: `Que faut-il faire pour l’autre, selon Jésus ?`, options: ['Aimer son prochain comme soi-même', 'Prier chaque matin', 'Donner dix pour cents', 'Aller à l’église'], correctAnswerIndex: 0, explanation: `Marc 12:31 : "Tu aimeras ton prochain comme toi-même".`, theme: 'amour', difficulty: 'easy', bookCode: 'marc' },
  { question: `Comment la foi vient-elle ?`, options: ['En entendant', 'En lisant seulement', 'En voyant', 'En naissant'], correctAnswerIndex: 0, explanation: `Romains 10:17 : "La foi vient en entendant."`, theme: 'foi', difficulty: 'easy', bookCode: 'romains' },
  { question: `Quel don saint Paul appelle-t-il "la plus grande chose" ?`, options: ['La prophétie', 'La foi', 'L’espérance', 'L’amour'], correctAnswerIndex: 3, explanation: `1 Corinthiens 13 : sans l’amour, rien de rien vaut. L’amour est le don suprême.`, theme: 'amour', difficulty: 'easy', bookCode: '1corinthiens' },
  { question: `Comment Jésus a-t-il commencé son ministère à Nazareth ?`, options: ['Il a enseigné dans la synagogue', 'Il a guéri un malade', 'Il a changé de l’eau en vin', 'Il a marché sur l’eau'], correctAnswerIndex: 0, explanation: `Luc 4 : Jésus lit en synagogue à Nazareth et annonce sa mission.`, theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'luc' },
  { question: `Quel est le signe que Moïse a montré pour prouver la présence de Dieu ?`, options: ['La nuée et le feu', 'Une arche', 'Une croix', 'Un rocher'], correctAnswerIndex: 0, explanation: `Exode 13 et 14 : la nuée et le feu guident le peuple de nuit.`, theme: 'ancien-testament', difficulty: 'easy', bookCode: 'exode' },
];

async function main() {
  log('Connexion au cluster MongoDB Atlas...');
  await connectCluster();
  const db = getTenantDB(APP_NAME);
  log(`Base cible : ${db.name} (tenant '${APP_NAME}')`);
  if (db.name !== `${APP_NAME}DB`) {
    throw new Error(`Garde-fou : base cible inattendue (${db.name}), attendu ${APP_NAME}DB. Abandon.`);
  }

  const Parcours = getModel(APP_NAME, 'Parcours', ParcoursSchema);
  const Quiz = getModel(APP_NAME, 'Quiz', QuizSchema);

  // ---- Parcours (upsert par title) ----
  let parcoursUpserted = 0;
  for (const p of TODAY_PARCOURS) {
    const res = await Parcours.updateOne(
      { title: p.title },
      { $set: { ...p } },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    if (Number(res.upsertedCount) || Number(res.modifiedCount)) parcoursUpserted++;
  }
  log(`Parcours : ${TODAY_PARCOURS.length} vérifiés, ${parcoursUpserted} créés/modifiés.`);

  // ---- Quiz (upsert par question) ----
  let quizUpserted = 0;
  for (const q of TODAY_QUIZZES) {
    const res = await Quiz.updateOne(
      { question: q.question },
      { $set: { ...q } },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    if (Number(res.upsertedCount) || Number(res.modifiedCount)) quizUpserted++;
  }
  log(`Quiz : ${TODAY_QUIZZES.length} vérifiés, ${quizUpserted} créés/modifiés.`);

  const totalParcours = await Parcours.countDocuments({});
  const totalQuizEasy = await Quiz.countDocuments({ difficulty: 'easy' });
  log(`Totaux Pelerin → parcours: ${totalParcours}, quiz easy: ${totalQuizEasy}`);

  log('Import terminé.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-pelerin-content] Erreur fatale :', err);
    process.exit(1);
  });

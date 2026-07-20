const path = require('path');

// Reference canonique des 66 livres bibliques (canon protestant, coherent avec
// Louis Segond 1910, Darby et King James — aucun livre deuterocanonique).
// order = ordre d'apparition standard, chapterCount = nombre de chapitres.
const BIBLE_BOOKS = [
  // Ancien Testament (39 livres)
  { order: 1, code: 'genese', nameFr: 'Genèse', nameEn: 'Genesis', testament: 'AT', chapterCount: 50 },
  { order: 2, code: 'exode', nameFr: 'Exode', nameEn: 'Exodus', testament: 'AT', chapterCount: 40 },
  { order: 3, code: 'levitique', nameFr: 'Lévitique', nameEn: 'Leviticus', testament: 'AT', chapterCount: 27 },
  { order: 4, code: 'nombres', nameFr: 'Nombres', nameEn: 'Numbers', testament: 'AT', chapterCount: 36 },
  { order: 5, code: 'deuteronome', nameFr: 'Deutéronome', nameEn: 'Deuteronomy', testament: 'AT', chapterCount: 34 },
  { order: 6, code: 'josue', nameFr: 'Josué', nameEn: 'Joshua', testament: 'AT', chapterCount: 24 },
  { order: 7, code: 'juges', nameFr: 'Juges', nameEn: 'Judges', testament: 'AT', chapterCount: 21 },
  { order: 8, code: 'ruth', nameFr: 'Ruth', nameEn: 'Ruth', testament: 'AT', chapterCount: 4 },
  { order: 9, code: '1samuel', nameFr: '1 Samuel', nameEn: '1 Samuel', testament: 'AT', chapterCount: 31 },
  { order: 10, code: '2samuel', nameFr: '2 Samuel', nameEn: '2 Samuel', testament: 'AT', chapterCount: 24 },
  { order: 11, code: '1rois', nameFr: '1 Rois', nameEn: '1 Kings', testament: 'AT', chapterCount: 22 },
  { order: 12, code: '2rois', nameFr: '2 Rois', nameEn: '2 Kings', testament: 'AT', chapterCount: 25 },
  { order: 13, code: '1chroniques', nameFr: '1 Chroniques', nameEn: '1 Chronicles', testament: 'AT', chapterCount: 29 },
  { order: 14, code: '2chroniques', nameFr: '2 Chroniques', nameEn: '2 Chronicles', testament: 'AT', chapterCount: 36 },
  { order: 15, code: 'esdras', nameFr: 'Esdras', nameEn: 'Ezra', testament: 'AT', chapterCount: 10 },
  { order: 16, code: 'nehemie', nameFr: 'Néhémie', nameEn: 'Nehemiah', testament: 'AT', chapterCount: 13 },
  { order: 17, code: 'esther', nameFr: 'Esther', nameEn: 'Esther', testament: 'AT', chapterCount: 10 },
  { order: 18, code: 'job', nameFr: 'Job', nameEn: 'Job', testament: 'AT', chapterCount: 42 },
  { order: 19, code: 'psaumes', nameFr: 'Psaumes', nameEn: 'Psalms', testament: 'AT', chapterCount: 150 },
  { order: 20, code: 'proverbes', nameFr: 'Proverbes', nameEn: 'Proverbs', testament: 'AT', chapterCount: 31 },
  { order: 21, code: 'ecclesiaste', nameFr: 'Ecclésiaste', nameEn: 'Ecclesiastes', testament: 'AT', chapterCount: 12 },
  { order: 22, code: 'cantique', nameFr: 'Cantique des cantiques', nameEn: 'Song of Solomon', testament: 'AT', chapterCount: 8 },
  { order: 23, code: 'esaie', nameFr: 'Ésaïe', nameEn: 'Isaiah', testament: 'AT', chapterCount: 66 },
  { order: 24, code: 'jeremie', nameFr: 'Jérémie', nameEn: 'Jeremiah', testament: 'AT', chapterCount: 52 },
  { order: 25, code: 'lamentations', nameFr: 'Lamentations', nameEn: 'Lamentations', testament: 'AT', chapterCount: 5 },
  { order: 26, code: 'ezechiel', nameFr: 'Ézéchiel', nameEn: 'Ezekiel', testament: 'AT', chapterCount: 48 },
  { order: 27, code: 'daniel', nameFr: 'Daniel', nameEn: 'Daniel', testament: 'AT', chapterCount: 12 },
  { order: 28, code: 'osee', nameFr: 'Osée', nameEn: 'Hosea', testament: 'AT', chapterCount: 14 },
  { order: 29, code: 'joel', nameFr: 'Joël', nameEn: 'Joel', testament: 'AT', chapterCount: 3 },
  { order: 30, code: 'amos', nameFr: 'Amos', nameEn: 'Amos', testament: 'AT', chapterCount: 9 },
  { order: 31, code: 'abdias', nameFr: 'Abdias', nameEn: 'Obadiah', testament: 'AT', chapterCount: 1 },
  { order: 32, code: 'jonas', nameFr: 'Jonas', nameEn: 'Jonah', testament: 'AT', chapterCount: 4 },
  { order: 33, code: 'michee', nameFr: 'Michée', nameEn: 'Micah', testament: 'AT', chapterCount: 7 },
  { order: 34, code: 'nahum', nameFr: 'Nahum', nameEn: 'Nahum', testament: 'AT', chapterCount: 3 },
  { order: 35, code: 'habacuc', nameFr: 'Habacuc', nameEn: 'Habakkuk', testament: 'AT', chapterCount: 3 },
  { order: 36, code: 'sophonie', nameFr: 'Sophonie', nameEn: 'Zephaniah', testament: 'AT', chapterCount: 3 },
  { order: 37, code: 'aggee', nameFr: 'Aggée', nameEn: 'Haggai', testament: 'AT', chapterCount: 2 },
  { order: 38, code: 'zacharie', nameFr: 'Zacharie', nameEn: 'Zechariah', testament: 'AT', chapterCount: 14 },
  { order: 39, code: 'malachie', nameFr: 'Malachie', nameEn: 'Malachi', testament: 'AT', chapterCount: 4 },
  // Nouveau Testament (27 livres)
  { order: 40, code: 'matthieu', nameFr: 'Matthieu', nameEn: 'Matthew', testament: 'NT', chapterCount: 28 },
  { order: 41, code: 'marc', nameFr: 'Marc', nameEn: 'Mark', testament: 'NT', chapterCount: 16 },
  { order: 42, code: 'luc', nameFr: 'Luc', nameEn: 'Luke', testament: 'NT', chapterCount: 24 },
  { order: 43, code: 'jean', nameFr: 'Jean', nameEn: 'John', testament: 'NT', chapterCount: 21 },
  { order: 44, code: 'actes', nameFr: 'Actes', nameEn: 'Acts', testament: 'NT', chapterCount: 28 },
  { order: 45, code: 'romains', nameFr: 'Romains', nameEn: 'Romans', testament: 'NT', chapterCount: 16 },
  { order: 46, code: '1corinthiens', nameFr: '1 Corinthiens', nameEn: '1 Corinthians', testament: 'NT', chapterCount: 16 },
  { order: 47, code: '2corinthiens', nameFr: '2 Corinthiens', nameEn: '2 Corinthians', testament: 'NT', chapterCount: 13 },
  { order: 48, code: 'galates', nameFr: 'Galates', nameEn: 'Galatians', testament: 'NT', chapterCount: 6 },
  { order: 49, code: 'ephesiens', nameFr: 'Éphésiens', nameEn: 'Ephesians', testament: 'NT', chapterCount: 6 },
  { order: 50, code: 'philippiens', nameFr: 'Philippiens', nameEn: 'Philippians', testament: 'NT', chapterCount: 4 },
  { order: 51, code: 'colossiens', nameFr: 'Colossiens', nameEn: 'Colossians', testament: 'NT', chapterCount: 4 },
  { order: 52, code: '1thessaloniciens', nameFr: '1 Thessaloniciens', nameEn: '1 Thessalonians', testament: 'NT', chapterCount: 5 },
  { order: 53, code: '2thessaloniciens', nameFr: '2 Thessaloniciens', nameEn: '2 Thessalonians', testament: 'NT', chapterCount: 3 },
  { order: 54, code: '1timothee', nameFr: '1 Timothée', nameEn: '1 Timothy', testament: 'NT', chapterCount: 6 },
  { order: 55, code: '2timothee', nameFr: '2 Timothée', nameEn: '2 Timothy', testament: 'NT', chapterCount: 4 },
  { order: 56, code: 'tite', nameFr: 'Tite', nameEn: 'Titus', testament: 'NT', chapterCount: 3 },
  { order: 57, code: 'philemon', nameFr: 'Philémon', nameEn: 'Philemon', testament: 'NT', chapterCount: 1 },
  { order: 58, code: 'hebreux', nameFr: 'Hébreux', nameEn: 'Hebrews', testament: 'NT', chapterCount: 13 },
  { order: 59, code: 'jacques', nameFr: 'Jacques', nameEn: 'James', testament: 'NT', chapterCount: 5 },
  { order: 60, code: '1pierre', nameFr: '1 Pierre', nameEn: '1 Peter', testament: 'NT', chapterCount: 5 },
  { order: 61, code: '2pierre', nameFr: '2 Pierre', nameEn: '2 Peter', testament: 'NT', chapterCount: 3 },
  { order: 62, code: '1jean', nameFr: '1 Jean', nameEn: '1 John', testament: 'NT', chapterCount: 5 },
  { order: 63, code: '2jean', nameFr: '2 Jean', nameEn: '2 John', testament: 'NT', chapterCount: 1 },
  { order: 64, code: '3jean', nameFr: '3 Jean', nameEn: '3 John', testament: 'NT', chapterCount: 1 },
  { order: 65, code: 'jude', nameFr: 'Jude', nameEn: 'Jude', testament: 'NT', chapterCount: 1 },
  { order: 66, code: 'apocalypse', nameFr: 'Apocalypse', nameEn: 'Revelation', testament: 'NT', chapterCount: 22 },
];

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;

  // bibleBook — reference statique des 66 livres, prealable a l'import des versets.
  const bibleBookSchema = require('./features/bibleBook/model/bibleBook.schema.js');
  const BibleBook = getModel(appName, 'BibleBook', bibleBookSchema);
  const bookDocs = BIBLE_BOOKS.map((b) => ({ ...b, label: b.nameFr }));
  const booksCreated = await BibleBook.insertMany(bookDocs, { ordered: false }).catch((err) => {
    // insertMany avec des codes deja presents (relance du seed) -> ignorer les doublons
    if (err.writeErrors) return err.insertedDocs || [];
    throw err;
  });
  count += booksCreated.length || 0;
  await logSeed({
    appName,
    feature: 'bibleBook',
    modelName: 'BibleBook',
    schemaPath: path.join(__dirname, 'features', 'bibleBook', 'model', 'bibleBook.schema.js'),
    ids: (booksCreated || []).map((d) => d._id),
  });

  // bible (versets) — le texte des 3 versions (Louis Segond 1910, Darby, King James)
  // est trop volumineux pour ce seed de demo ; l'import complet ne fait PAS partie de
  // ce seed generique. Il se fait via un script dedie et idempotent :
  //   scripts/seed/seed-pelerin-bible.js   (npm run seed:pelerin-bible)
  // Source des donnees + licence : voir dryApp/Pelerin/README.md ("Feature bible").

  // ══════════════════════════════════════════════════════════════════
  //  DONNEES DE DEMO — additif uniquement (chaque bloc verifie s'il a deja
  //  seede avant d'inserer, jamais de deleteMany : voir convention documentee
  //  dans scripts/seed/seed-all.js).
  // ══════════════════════════════════════════════════════════════════

  // quiz — questions bibliques de demo (reponse/explication redigees pour ce projet).
  const quizSchema = require('./features/quiz/model/quiz.schema.js');
  const Quiz = getModel(appName, 'Quiz', quizSchema);
  if (await Quiz.countDocuments() === 0) {
    const quizDocs = [
      { question: 'Qui a construit une arche pour survivre au deluge ?', options: ['Noe', 'Abraham', 'Moise', 'David'], correctAnswerIndex: 0, explanation: 'Selon Genese 6-9, Dieu demande a Noe de construire une arche pour sauver sa famille et les animaux du deluge.', theme: 'ancien-testament', difficulty: 'easy', bookCode: 'genese' },
      { question: 'Dans quelle ville Jesus est-il ne, selon les evangiles ?', options: ['Bethleem', 'Nazareth', 'Jerusalem', 'Capernaum'], correctAnswerIndex: 0, explanation: 'Luc 2 situe la naissance de Jesus a Bethleem, ville de David, lors du recensement de Cesar Auguste.', theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'luc' },
      { question: 'Combien de disciples proches Jesus a-t-il choisis (les "douze") ?', options: ['12', '10', '7', '70'], correctAnswerIndex: 0, explanation: 'Les evangiles nomment douze apotres choisis par Jesus pour l\'accompagner et poursuivre sa mission.', theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'matthieu' },
      { question: 'Qui a trahi Jesus contre trente pieces d\'argent ?', options: ['Judas Iscariot', 'Pierre', 'Thomas', 'Jean'], correctAnswerIndex: 0, explanation: 'Matthieu 26 rapporte que Judas Iscariot livre Jesus aux autorites pour trente pieces d\'argent.', theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'matthieu' },
      { question: 'Quel roi d\'Israel est reste celebre pour sa sagesse ?', options: ['Salomon', 'Saul', 'David', 'Ezechias'], correctAnswerIndex: 0, explanation: 'Salomon, fils de David, demande a Dieu la sagesse pour gouverner (1 Rois 3) et en reste le symbole biblique.', theme: 'sagesse', difficulty: 'medium', bookCode: '1rois' },
      { question: 'Qui a vaincu le geant Goliath avec une fronde ?', options: ['David', 'Samson', 'Josue', 'Gedeon'], correctAnswerIndex: 0, explanation: '1 Samuel 17 raconte le combat entre le jeune David et le geant philistin Goliath.', theme: 'ancien-testament', difficulty: 'easy', bookCode: '1samuel' },
      { question: 'Quel apotre renie Jesus trois fois avant le chant du coq ?', options: ['Pierre', 'Andre', 'Jacques', 'Philippe'], correctAnswerIndex: 0, explanation: 'Les quatre evangiles rapportent le triple reniement de Pierre pendant la nuit de l\'arrestation de Jesus.', theme: 'nouveau-testament', difficulty: 'medium', bookCode: 'luc' },
      { question: 'Sur le chemin de quelle ville Saul (futur Paul) rencontre-t-il le Christ ressuscite ?', options: ['Damas', 'Rome', 'Antioche', 'Ephese'], correctAnswerIndex: 0, explanation: 'Actes 9 decrit la conversion de Saul de Tarse sur la route de Damas.', theme: 'nouveau-testament', difficulty: 'medium', bookCode: 'actes' },
      { question: 'Combien de plaies frappent l\'Egypte dans le livre de l\'Exode ?', options: ['10', '7', '12', '3'], correctAnswerIndex: 0, explanation: 'Exode 7-12 decrit dix plaies successives avant que Pharaon ne laisse partir le peuple hebreu.', theme: 'ancien-testament', difficulty: 'medium', bookCode: 'exode' },
      { question: 'Quel est le premier livre du Nouveau Testament ?', options: ['Matthieu', 'Marc', 'Jean', 'Actes'], correctAnswerIndex: 0, explanation: 'Le Nouveau Testament s\'ouvre par l\'evangile selon Matthieu.', theme: 'nouveau-testament', difficulty: 'easy', bookCode: 'matthieu' },
      { question: 'Qui interprete les songes de Pharaon et devient gouverneur d\'Egypte ?', options: ['Joseph', 'Benjamin', 'Ruben', 'Juda'], correctAnswerIndex: 0, explanation: 'Genese 41 raconte comment Joseph, fils de Jacob, interprete les songes de Pharaon et est eleve au pouvoir.', theme: 'ancien-testament', difficulty: 'medium', bookCode: 'genese' },
      { question: 'Dans le livre de Jonas, quel animal avale le prophete ?', options: ['Un grand poisson', 'Une baleine bleue', 'Un requin', 'Un serpent de mer'], correctAnswerIndex: 0, explanation: 'Jonas 1-2 parle d\'un "grand poisson" envoye par Dieu pour engloutir Jonas trois jours et trois nuits.', theme: 'ancien-testament', difficulty: 'hard', bookCode: 'jonas' },
    ];
    const quizCreated = await Quiz.insertMany(quizDocs);
    count += quizCreated.length;
    await logSeed({ appName, feature: 'quiz', modelName: 'Quiz', schemaPath: path.join(__dirname, 'features', 'quiz', 'model', 'quiz.schema.js'), ids: quizCreated.map((d) => d._id) });
    console.log(`[Pelerin] quiz : ${quizCreated.length} question(s) creee(s).`);
  } else {
    console.log('[Pelerin] quiz : deja seede, ignore.');
  }

  // meditation — verset + reflexion + priere guidee (redaction originale pour ce projet).
  const meditationSchema = require('./features/meditation/model/meditation.schema.js');
  const Meditation = getModel(appName, 'Meditation', meditationSchema);
  if (await Meditation.countDocuments() === 0) {
    const meditationDocs = [
      { title: 'La paix qui depasse toute intelligence', bookCode: 'philippiens', chapter: 4, verseStart: 6, verseEnd: 7, reflection: 'L\'inquietude prend souvent toute la place quand on la laisse faire. Ce passage invite a autre chose : deposer ce qui pese, dans la priere, et laisser une paix qui ne s\'explique pas garder le coeur. Ce n\'est pas l\'absence de probleme, c\'est une presence au milieu du probleme.', prayer: 'Seigneur, je te confie ce qui m\'inquiete aujourd\'hui. Garde mon coeur et mes pensees dans ta paix. Amen.', publishDate: new Date() },
      { title: 'Un avenir et une esperance', bookCode: 'jeremie', chapter: 29, verseStart: 11, reflection: 'Meme dans les periodes d\'incertitude, cette promesse rappelle que Dieu n\'a pas oublie ceux qu\'il aime. Il ne s\'agit pas d\'un avenir sans epreuve, mais d\'un avenir qui a un sens et une direction.', prayer: 'Seigneur, aide-moi a te faire confiance pour demain, meme quand je ne vois pas le chemin. Amen.', publishDate: new Date(Date.now() - 86400000) },
      { title: 'Je suis le bon berger', bookCode: 'jean', chapter: 10, verseStart: 11, reflection: 'Un berger connait chacune de ses brebis. Se savoir connu et garde, un a un, change la maniere de traverser les moments de doute ou de solitude.', prayer: 'Merci Seigneur de me connaitre et de me garder. Aide-moi a reconnaitre ta voix aujourd\'hui. Amen.', publishDate: new Date(Date.now() - 2 * 86400000) },
      { title: 'La force dans la faiblesse', bookCode: '2corinthiens', chapter: 12, verseStart: 9, reflection: 'Nos limites ne sont pas un obstacle a l\'oeuvre de Dieu, elles sont souvent l\'endroit ou sa force se manifeste le plus clairement.', prayer: 'Seigneur, dans mes faiblesses, montre ta force. Je choisis de m\'appuyer sur toi aujourd\'hui. Amen.', publishDate: new Date(Date.now() - 3 * 86400000) },
      { title: 'Aimer son prochain', bookCode: 'marc', chapter: 12, verseStart: 31, reflection: 'Aimer son prochain comme soi-meme commence souvent par un geste simple : ecouter, pardonner, tendre la main. C\'est un choix qui se renouvelle chaque jour.', prayer: 'Seigneur, donne-moi un coeur qui aime concretement les personnes que je croise aujourd\'hui. Amen.', publishDate: new Date(Date.now() - 4 * 86400000) },
      { title: 'Le repos pour les fatigues', bookCode: 'matthieu', chapter: 11, verseStart: 28, reflection: 'Cette invitation s\'adresse a ceux qui portent un fardeau, visible ou invisible. Venir, tel quel, fatigue, sans rien devoir prouver avant.', prayer: 'Seigneur, je viens a toi avec ma fatigue. Merci de m\'offrir un repos que je ne peux pas me donner moi-meme. Amen.', publishDate: new Date(Date.now() - 5 * 86400000) },
    ];
    const meditationCreated = await Meditation.insertMany(meditationDocs);
    count += meditationCreated.length;
    await logSeed({ appName, feature: 'meditation', modelName: 'Meditation', schemaPath: path.join(__dirname, 'features', 'meditation', 'model', 'meditation.schema.js'), ids: meditationCreated.map((d) => d._id) });
    console.log(`[Pelerin] meditation : ${meditationCreated.length} entree(s) creee(s).`);
  } else {
    console.log('[Pelerin] meditation : deja seede, ignore.');
  }

  // devPersonnel — bibliotheque de developpement personnel centre sur Christ, par theme.
  const devPersonnelSchema = require('./features/devPersonnel/model/devPersonnel.schema.js');
  const DevPersonnel = getModel(appName, 'DevPersonnel', devPersonnelSchema);
  if (await DevPersonnel.countDocuments() === 0) {
    const devPersonnelDocs = [
      { title: 'La discipline qui porte du fruit', theme: 'discipline', content: 'La discipline n\'est pas une contrainte exterieure, c\'est un entrainement du coeur. Comme un sportif s\'entraine pour la course, la discipline spirituelle (priere reguliere, lecture, silence) forme peu a peu un caractere capable de tenir dans la duree.', bookCode: 'hebreux', chapter: 12, verseStart: 11 },
      { title: 'Remettre sa confiance entre ses mains', theme: 'confiance', content: 'Faire confiance, c\'est accepter de ne pas tout comprendre tout en avancant. Ce n\'est pas une confiance aveugle, c\'est une confiance fondee sur ce que l\'on connait deja de la fidelite de Dieu.', bookCode: 'proverbes', chapter: 3, verseStart: 5 },
      { title: 'Fortifie-toi et prends courage', theme: 'courage', content: 'Le courage biblique n\'est pas l\'absence de peur, c\'est avancer malgre elle, en sachant qu\'on n\'est pas seul. C\'est une invitation repetee tout au long des Ecritures a ceux qui font face a l\'inconnu.', bookCode: 'josue', chapter: 1, verseStart: 9 },
      { title: 'La patience qui construit le caractere', theme: 'patience', content: 'La patience n\'est pas passive : elle transforme celui qui la pratique. Chaque epreuve traversee avec perseverance forge quelque chose de durable.', bookCode: 'romains', chapter: 5, verseStart: 3 },
      { title: 'L\'amour qui ne cherche pas son interet', theme: 'amour', content: 'Un amour qui ne se resume pas a un sentiment, mais a une maniere concrete de considerer les autres avant soi-meme, patiemment, sans calcul.', bookCode: '1corinthiens', chapter: 13, verseStart: 4 },
      { title: 'Libere par le pardon', theme: 'pardon', content: 'Pardonner ne signifie pas oublier ou minimiser ce qui a fait mal. C\'est choisir de ne plus laisser cette blessure diriger sa vie, et recevoir soi-meme le pardon offert.', bookCode: 'matthieu', chapter: 6, verseStart: 14 },
      { title: 'S\'abaisser pour grandir', theme: 'humilite', content: 'L\'humilite n\'est pas se devaloriser, c\'est avoir une vue juste de soi-meme : ni plus, ni moins. C\'est ce qui rend possible une vraie ecoute des autres.', bookCode: 'jacques', chapter: 4, verseStart: 10 },
      { title: 'Courir la course avec perseverance', theme: 'perseverance', content: 'Tenir sur la duree demande de se defaire de ce qui alourdit inutilement et de garder les yeux fixes sur ce qui compte vraiment.', bookCode: 'hebreux', chapter: 12, verseStart: 1 },
      { title: 'Servir pour diriger', theme: 'leadership', content: 'Le modele de leadership propose par Jesus renverse les logiques habituelles : diriger, c\'est d\'abord servir, pas dominer.', bookCode: 'marc', chapter: 10, verseStart: 45 },
      { title: 'Une nouvelle creation en Christ', theme: 'identite', content: 'Ce que l\'on a fait, subi ou rate ne definit pas qui l\'on est de maniere definitive. L\'identite en Christ propose un regard neuf, pas fonde sur la performance mais sur une relation.', bookCode: '2corinthiens', chapter: 5, verseStart: 17 },
    ];
    const devPersonnelCreated = await DevPersonnel.insertMany(devPersonnelDocs);
    count += devPersonnelCreated.length;
    await logSeed({ appName, feature: 'devPersonnel', modelName: 'DevPersonnel', schemaPath: path.join(__dirname, 'features', 'devPersonnel', 'model', 'devPersonnel.schema.js'), ids: devPersonnelCreated.map((d) => d._id) });
    console.log(`[Pelerin] devPersonnel : ${devPersonnelCreated.length} entree(s) creee(s).`);
  } else {
    console.log('[Pelerin] devPersonnel : deja seede, ignore.');
  }

  // parcours — parcours spirituels guides (contenu editorial original pour ce projet).
  const parcoursSchema = require('./features/parcours/model/parcours.schema.js');
  const Parcours = getModel(appName, 'Parcours', parcoursSchema);
  if (await Parcours.countDocuments() === 0) {
    const parcoursDocs = [
      {
        title: 'Decouvrir Jesus',
        description: 'Un premier pas pour decouvrir qui est Jesus a travers les evangiles : sa vie, ses paroles, sa mission.',
        theme: 'decouverte', icon: 'sunny-outline', estimatedDays: 7, isPublished: true,
        steps: [
          { order: 1, title: 'Un enfant pas comme les autres', bookCode: 'luc', chapter: 2, verseStart: 1, verseEnd: 20, meditation: 'La naissance de Jesus a Bethleem, dans la simplicite plutot que dans le prestige.', reflectionQuestion: 'Qu\'est-ce que cette simplicite t\'inspire ?', practicalExercise: 'Note un moment simple de ta journee ou tu as ressenti la presence de Dieu.' },
          { order: 2, title: 'Les premiers pas de sa mission', bookCode: 'luc', chapter: 4, verseStart: 14, verseEnd: 21, meditation: 'Jesus annonce sa mission : bonne nouvelle, liberte, guerison.', reflectionQuestion: 'Dans quel domaine as-tu besoin d\'une bonne nouvelle aujourd\'hui ?', practicalExercise: 'Ecris une courte priere pour ce domaine.' },
          { order: 3, title: 'Il enseigne avec autorite', bookCode: 'matthieu', chapter: 5, verseStart: 1, verseEnd: 12, meditation: 'Les Beatitudes renversent les criteres habituels de reussite.', reflectionQuestion: 'Quelle beatitude te touche le plus aujourd\'hui ?', practicalExercise: 'Choisis une beatitude et vis-la concretement aujourd\'hui.' },
          { order: 4, title: 'Il se soucie des personnes', bookCode: 'luc', chapter: 19, verseStart: 1, verseEnd: 10, meditation: 'Jesus va vers Zachee, une personne rejetee par les autres.', reflectionQuestion: 'Qui pourrais-tu regarder differemment aujourd\'hui ?', practicalExercise: 'Contacte une personne que tu as mise de cote.' },
          { order: 5, title: 'La croix et la resurrection', bookCode: 'jean', chapter: 20, verseStart: 1, verseEnd: 18, meditation: 'Le tombeau vide change tout : la mort n\'a pas le dernier mot.', reflectionQuestion: 'Qu\'est-ce que la resurrection change concretement pour toi ?', practicalExercise: 'Ecris dans ton journal ce que tu retiens de ce parcours.' },
        ],
      },
      {
        title: 'Apprendre le pardon',
        description: 'Un parcours pour comprendre et pratiquer le pardon, recu et donne.',
        theme: 'pardon', icon: 'heart-outline', estimatedDays: 6, isPublished: true,
        steps: [
          { order: 1, title: 'Recevoir le pardon', bookCode: 'psaumes', chapter: 103, verseStart: 8, verseEnd: 12, meditation: 'Avant de pardonner aux autres, se laisser rejoindre par le pardon que Dieu offre.', reflectionQuestion: 'Qu\'est-ce qui t\'empeche de recevoir pleinement ce pardon ?', practicalExercise: 'Ecris ce que tu as besoin de deposer aujourd\'hui.' },
          { order: 2, title: 'La mesure du pardon', bookCode: 'matthieu', chapter: 18, verseStart: 21, verseEnd: 22, meditation: 'Le pardon n\'a pas de limite comptable.', reflectionQuestion: 'Y a-t-il une situation ou tu comptes encore les torts ?', practicalExercise: 'Nomme cette situation, sans obligation d\'agir tout de suite.' },
          { order: 3, title: 'Pardonner ne veut pas dire oublier', bookCode: 'genese', chapter: 50, verseStart: 15, verseEnd: 21, meditation: 'Joseph pardonne a ses freres sans nier ce qu\'ils ont fait.', reflectionQuestion: 'Comment concilier memoire et pardon ?', practicalExercise: 'Ecris une lettre (non envoyee) a la personne concernee.' },
          { order: 4, title: 'Un chemin, pas un interrupteur', bookCode: 'colossiens', chapter: 3, verseStart: 13, meditation: 'Le pardon est souvent progressif, pas instantane.', reflectionQuestion: 'Ou en es-tu sur ce chemin aujourd\'hui ?', practicalExercise: 'Fixe-toi une prochaine petite etape realiste.' },
        ],
      },
      {
        title: 'Surmonter les epreuves',
        description: 'Traverser les moments difficiles en gardant un ancrage spirituel.',
        theme: 'epreuves', icon: 'shield-outline', estimatedDays: 7, isPublished: true,
        steps: [
          { order: 1, title: 'Nommer ce qui pese', bookCode: 'psaumes', chapter: 42, verseStart: 1, verseEnd: 5, meditation: 'Les psaumes n\'evitent pas la plainte, ils l\'expriment devant Dieu.', reflectionQuestion: 'Qu\'est-ce qui pese sur toi en ce moment ?', practicalExercise: 'Ecris-le, sans filtre, comme une priere.' },
          { order: 2, title: 'Ne pas rester seul', bookCode: 'ecclesiaste', chapter: 4, verseStart: 9, verseEnd: 12, meditation: 'Traverser une epreuve seul est plus difficile qu\'accompagne.', reflectionQuestion: 'Qui pourrait t\'accompagner dans ce que tu vis ?', practicalExercise: 'Envoie un message a cette personne aujourd\'hui.' },
          { order: 3, title: 'La force renouvelee', bookCode: 'esaie', chapter: 40, verseStart: 29, verseEnd: 31, meditation: 'La force ne vient pas seulement de soi.', reflectionQuestion: 'Ou puises-tu ta force habituellement ?', practicalExercise: 'Prends 10 minutes de calme aujourd\'hui, sans ecran.' },
          { order: 4, title: 'Une esperance qui tient', bookCode: 'romains', chapter: 8, verseStart: 28, meditation: 'Cette promesse ne nie pas la difficulte, elle affirme qu\'elle n\'a pas le dernier mot.', reflectionQuestion: 'Quelle esperance concrete gardes-tu pour la suite ?', practicalExercise: 'Ecris une phrase d\'esperance a relire dans les jours difficiles.' },
          { order: 5, title: 'Ce que cette epreuve construit', bookCode: 'jacques', chapter: 1, verseStart: 2, verseEnd: 4, meditation: 'Une epreuve traversee laisse parfois quelque chose de solide.', reflectionQuestion: 'Qu\'as-tu appris de toi-meme dans ce parcours ?', practicalExercise: 'Partage ce que tu as vecu avec une personne de confiance.' },
        ],
      },
      {
        title: 'Grandir dans son identite en Christ',
        description: 'Comprendre qui l\'on est vraiment, au-dela des etiquettes et des echecs.',
        theme: 'identite', icon: 'sparkles-outline', estimatedDays: 5, isPublished: true,
        steps: [
          { order: 1, title: 'Connu avant meme de naitre', bookCode: 'psaumes', chapter: 139, verseStart: 13, verseEnd: 16, meditation: 'Ton existence n\'est pas un accident.', reflectionQuestion: 'Qu\'est-ce que cela change de te savoir connu ainsi ?', practicalExercise: 'Ecris trois choses que tu apprecies chez toi.' },
          { order: 2, title: 'Une nouvelle creation', bookCode: '2corinthiens', chapter: 5, verseStart: 17, meditation: 'Le passe ne definit pas entierement qui tu deviens.', reflectionQuestion: 'Quelle etiquette du passe voudrais-tu deposer ?', practicalExercise: 'Ecris cette etiquette puis raye-la symboliquement.' },
          { order: 3, title: 'Enfant, pas esclave', bookCode: 'romains', chapter: 8, verseStart: 15, verseEnd: 16, meditation: 'La relation avec Dieu n\'est pas fondee sur la peur mais sur une filiation.', reflectionQuestion: 'Ta relation avec Dieu est-elle plutot marquee par la peur ou la confiance ?', practicalExercise: 'Ecris une priere simple, comme a un pere de confiance.' },
          { order: 4, title: 'Fait pour porter du fruit', bookCode: 'jean', chapter: 15, verseStart: 5, meditation: 'Ton identite se deploie en lien avec Christ, pas isolement.', reflectionQuestion: 'Dans quel domaine aimerais-tu porter plus de fruit ?', practicalExercise: 'Choisis une action concrete cette semaine dans ce domaine.' },
        ],
      },
    ];
    const parcoursCreated = await Parcours.insertMany(parcoursDocs);
    count += parcoursCreated.length;
    await logSeed({ appName, feature: 'parcours', modelName: 'Parcours', schemaPath: path.join(__dirname, 'features', 'parcours', 'model', 'parcours.schema.js'), ids: parcoursCreated.map((d) => d._id) });
    console.log(`[Pelerin] parcours : ${parcoursCreated.length} parcours cree(s).`);
  } else {
    console.log('[Pelerin] parcours : deja seede, ignore.');
  }

  // temoignage — exemples de demonstration CLAIREMENT fictifs, pour tester l'ecran.
  // Le vrai temoignage personnel (isFeatured) est a remplacer par le contenu reel de
  // l'auteur du projet avant toute mise en production.
  const temoignageSchema = require('./features/temoignage/model/temoignage.schema.js');
  const Temoignage = getModel(appName, 'Temoignage', temoignageSchema);
  if (await Temoignage.countDocuments() === 0) {
    const temoignageDocs = [
      {
        title: '[EXEMPLE] Un nouveau depart', authorName: 'Temoignage de demonstration',
        before: 'Ceci est un exemple de temoignage genere pour tester l\'application. Avant, la personne fictive de cet exemple se sentait perdue et sans direction claire dans sa vie.',
        encounter: 'Dans cet exemple, une rencontre avec la foi lors d\'un moment difficile marque un tournant.',
        after: 'Depuis, dans ce scenario fictif, un sentiment de paix et une nouvelle direction accompagnent son quotidien. — A remplacer par un vrai temoignage avant mise en production.',
        category: 'exemple', isApproved: true, isFeatured: true,
      },
      {
        title: '[EXEMPLE] Retrouver l\'espoir', authorName: 'Temoignage de demonstration',
        before: 'Exemple fictif : une periode d\'epreuve et de decouragement.',
        encounter: 'Exemple fictif : le soutien d\'une communaute et un temps de priere regulier.',
        after: 'Exemple fictif : un espoir retrouve, pas a pas.',
        category: 'exemple', isApproved: true, isFeatured: false,
      },
      {
        title: '[EXEMPLE] Le pardon qui libere', authorName: 'Temoignage de demonstration',
        before: 'Exemple fictif : une blessure ancienne jamais vraiment traitee.',
        encounter: 'Exemple fictif : un cheminement personnel autour du pardon.',
        after: 'Exemple fictif : un poids en moins et une relation restauree.',
        category: 'exemple', isApproved: true, isFeatured: false,
      },
    ];
    const temoignageCreated = await Temoignage.insertMany(temoignageDocs);
    count += temoignageCreated.length;
    await logSeed({ appName, feature: 'temoignage', modelName: 'Temoignage', schemaPath: path.join(__dirname, 'features', 'temoignage', 'model', 'temoignage.schema.js'), ids: temoignageCreated.map((d) => d._id) });
    console.log(`[Pelerin] temoignage : ${temoignageCreated.length} exemple(s) cree(s) [DEMO, a remplacer].`);
  } else {
    console.log('[Pelerin] temoignage : deja seede, ignore.');
  }

  // audioTrack — URLS PLACEHOLDER (example.com), a remplacer par de vrais liens
  // externes legaux avant mise en production. Sert uniquement a tester l'ecran/liste.
  const audioTrackSchema = require('./features/audioTrack/model/audioTrack.schema.js');
  const AudioTrack = getModel(appName, 'AudioTrack', audioTrackSchema);
  if (await AudioTrack.countDocuments() === 0) {
    const audioTrackDocs = [
      { title: '[EXEMPLE] Chant Gospel 1', artist: 'A definir', category: 'gospel', url: 'https://example.com/audio/gospel-1', duration: '3:45' },
      { title: '[EXEMPLE] Louange du matin', artist: 'A definir', category: 'louange', url: 'https://example.com/audio/louange-1', duration: '4:12' },
      { title: '[EXEMPLE] Podcast — Grandir dans la foi ep.1', artist: 'A definir', category: 'podcast', url: 'https://example.com/audio/podcast-1', duration: '22:00' },
      { title: '[EXEMPLE] Enseignement — Le pardon', artist: 'A definir', category: 'enseignement', url: 'https://example.com/audio/enseignement-1', duration: '18:30' },
    ];
    const audioTrackCreated = await AudioTrack.insertMany(audioTrackDocs);
    count += audioTrackCreated.length;
    await logSeed({ appName, feature: 'audioTrack', modelName: 'AudioTrack', schemaPath: path.join(__dirname, 'features', 'audioTrack', 'model', 'audioTrack.schema.js'), ids: audioTrackCreated.map((d) => d._id) });
    console.log(`[Pelerin] audioTrack : ${audioTrackCreated.length} piste(s) creee(s) [URLs placeholder a remplacer].`);
  } else {
    console.log('[Pelerin] audioTrack : deja seede, ignore.');
  }

  console.log(`[Pelerin] Seed termine : ${count} document(s) cree(s) au total.`);
  return { count };
};

// Expose la reference canonique des 66 livres pour reutilisation par d'autres scripts
// (ex: scripts/seed/seed-pelerin-bible.js) sans la retyper a la main.
module.exports.BIBLE_BOOKS = BIBLE_BOOKS;

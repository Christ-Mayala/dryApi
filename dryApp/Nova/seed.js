const path = require('path');

const EspacesSchema = require('./features/espaces/model/espaces.schema');
const PagesSchema = require('./features/pages/model/pages.schema');
const BlocsSchema = require('./features/blocs/model/blocs.schema');
const BasesSchema = require('./features/bases/model/bases.schema');
const ElementsSchema = require('./features/elements/model/elements.schema');
const CommentairesSchema = require('./features/commentaires/model/commentaires.schema');
const ModelesSchema = require('./features/modeles/model/modeles.schema');
const ConnexionsSchema = require('./features/connexions/model/connexions.schema');
const FavorisSchema = require('./features/favoris/model/favoris.schema');
const NotificationsSchema = require('./features/notifications/model/notifications.schema');
const ParametresSchema = require('./features/parametres/model/parametres.schema');
const PublicationsSchema = require('./features/publications/model/publications.schema');
const IaSchema = require('./features/ia/model/ia.schema');
const seedTrivida = require('./seeds/trivida.seed');

/**
 * Seed Nova — idempotent et additif.
 *
 * Objectif : rendre l'application immediatement testable avec un espace de
 * travail credible : espaces, pages hierarchisees, blocs de contenu, bases de
 * donnees avec elements, modeles, connexions, favoris, notifications,
 * parametres, publications et requetes IA.
 *
 * Le seed ne fait JAMAIS de deleteMany/drop : pour chaque entite, on cherche par
 * cle naturelle puis on cree uniquement si l'entite est absente. Relancer le
 * script ne duplique donc rien.
 *
 * @param {{ appName: string, getModel: Function, logSeed: Function }} ctx
 * @returns {Promise<{ count: number }>}
 */
module.exports = async ({ appName, getModel, logSeed }) => {
  const Espace = getModel(appName, 'Espace', EspacesSchema);
  const Page = getModel(appName, 'Page', PagesSchema);
  const Bloc = getModel(appName, 'Bloc', BlocsSchema);
  const Base = getModel(appName, 'Base', BasesSchema);
  const Element = getModel(appName, 'Element', ElementsSchema);
  const Commentaire = getModel(appName, 'Commentaire', CommentairesSchema);
  const Modele = getModel(appName, 'Modele', ModelesSchema);
  const Connexion = getModel(appName, 'Connexion', ConnexionsSchema);
  const Favori = getModel(appName, 'Favori', FavorisSchema);
  const Notification = getModel(appName, 'Notification', NotificationsSchema);
  const Parametre = getModel(appName, 'Parametre', ParametresSchema);
  const Publication = getModel(appName, 'Publication', PublicationsSchema);
  const RequeteIA = getModel(appName, 'RequeteIA', IaSchema);

  let count = 0;
  const tousLesIds = [];
  const journal = [];

  const maintenant = new Date();
  const jour = (n) => new Date(maintenant.getTime() + n * 24 * 60 * 60 * 1000);

  /**
   * Fabrique un "createur idempotent" pour une feature : cherche par cle
   * naturelle (avec includeDeleted) puis cree si absent. Les ids crees sont
   * agreges au journal pour le logSeed final.
   */
  const suivi = (feature, modelName) => {
    const ids = [];
    journal.push({
      feature,
      modelName,
      schemaPath: path.join(__dirname, 'features', feature, 'model', `${feature}.schema.js`),
      ids,
    });
    return async (Model, cle, donnees = {}) => {
      const existant = await Model.findOne({ ...cle, includeDeleted: true });
      if (existant) return existant;
      const cree = await Model.create({ ...donnees, ...cle });
      count += 1;
      ids.push(cree._id);
      tousLesIds.push(cree._id);
      return cree;
    };
  };

  const creerEspace = suivi('espaces', 'Espace');
  const creerPage = suivi('pages', 'Page');
  const creerBloc = suivi('blocs', 'Bloc');
  const creerBase = suivi('bases', 'Base');
  const creerElement = suivi('elements', 'Element');
  const creerCommentaire = suivi('commentaires', 'Commentaire');
  const creerModele = suivi('modeles', 'Modele');
  const creerConnexion = suivi('connexions', 'Connexion');
  const creerFavori = suivi('favoris', 'Favori');
  const creerNotification = suivi('notifications', 'Notification');
  const creerParametre = suivi('parametres', 'Parametre');
  const creerPublication = suivi('publications', 'Publication');
  const creerRequeteIA = suivi('ia', 'RequeteIA');

  // ---------------------------------------------------------------
  // 1. Espaces
  // ---------------------------------------------------------------
  const espaceIng = await creerEspace(Espace, { nom: 'Ingénierie' }, {
    icone: '🏢',
    description: "Espace de travail de l'équipe technique.",
    visibilite: 'ouvert',
    ordre: 0,
    estPrive: false,
  });

  const espaceMkt = await creerEspace(Espace, { nom: 'Marketing' }, {
    icone: '🏢',
    description: "Espace de travail de l'équipe marketing.",
    visibilite: 'ferme',
    ordre: 1,
    estPrive: false,
  });

  // ---------------------------------------------------------------
  // 2. Pages hierarchisees
  // ---------------------------------------------------------------
  const pageWiki = await creerPage(Page, { titre: 'Wiki Ingénierie', espaceId: espaceIng._id }, {
    icone: '📚', section: 'equipe', favori: true, ordre: 0, derniereVisite: jour(-1),
  });
  const pageArchi = await creerPage(Page, { titre: 'Architecture', espaceId: espaceIng._id }, {
    icone: '🏗️', section: 'equipe', parentId: pageWiki._id, ordre: 1, derniereVisite: jour(0),
  });
  const pageGuide = await creerPage(Page, { titre: "Guide d'intégration", espaceId: espaceIng._id }, {
    icone: '🧩', section: 'equipe', parentId: pageWiki._id, ordre: 2, derniereVisite: jour(-3),
  });
  const pageRunbooks = await creerPage(Page, { titre: 'Runbooks', espaceId: espaceIng._id }, {
    icone: '🚑', section: 'equipe', parentId: pageWiki._id, ordre: 3, derniereVisite: jour(-7),
  });
  const pageReunion = await creerPage(Page, { titre: 'Notes de réunion', espaceId: espaceIng._id }, {
    icone: '📝', section: 'equipe', ordre: 4, derniereVisite: jour(-2),
  });
  const pageSprint = await creerPage(Page, { titre: 'Tableau de Sprint', espaceId: espaceIng._id }, {
    icone: '📊', section: 'equipe', favori: true, ordre: 5, derniereVisite: jour(0),
  });
  const pageCampagne = await creerPage(Page, { titre: 'Campagne Q1', espaceId: espaceMkt._id }, {
    icone: '📣', section: 'equipe', favori: true, ordre: 0, derniereVisite: jour(-1),
  });
  const pageCalendrier = await creerPage(Page, { titre: 'Calendrier Éditorial', espaceId: espaceMkt._id }, {
    icone: '🗓️', section: 'equipe', ordre: 1, derniereVisite: jour(-5),
  });
  const pageJournal = await creerPage(Page, { titre: 'Journal personnel', espaceId: espaceIng._id }, {
    icone: '🔒', section: 'prive', ordre: 6, derniereVisite: jour(-10),
  });
  const pageOneOnOne = await creerPage(Page, { titre: 'Notes 1:1', espaceId: espaceIng._id }, {
    icone: '🤝', section: 'prive', ordre: 7, derniereVisite: jour(-4),
  });
  const pageTransverse = await creerPage(Page, { titre: 'Projets transverses', espaceId: espaceMkt._id }, {
    icone: '🌐', section: 'partage', ordre: 2, derniereVisite: jour(-6),
  });

  // ---------------------------------------------------------------
  // 3. Blocs de contenu (page Wiki Ingénierie, Architecture, Campagne Q1)
  // ---------------------------------------------------------------
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'titre_1', ordre: 0 }, {
    contenu: 'Wiki Ingénierie',
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'paragraphe', ordre: 1 }, {
    contenu:
      "Bienvenue dans le wiki de l'ingénierie. Ce document centralise l'architecture, les guides d'intégration et les procédures de l'équipe.",
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'sommaire', ordre: 2 }, {});
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'titre_2', ordre: 3 }, {
    contenu: 'Démarrage rapide',
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'liste_a_puces', ordre: 4 }, {
    contenu: 'Cloner le dépôt\nInstaller les dépendances\nLancer l\'environnement local',
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'liste_numerotee', ordre: 5 }, {
    contenu: 'Créer une branche\nDévelopper la fonctionnalité\nOuvrir une pull request\nFaire relire le code',
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'a_faire', ordre: 6 }, {
    contenu: "Configurer son accès au VPN", proprietes: { coche: true },
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'a_faire', ordre: 7 }, {
    contenu: 'Lire la charte de contribution', proprietes: { coche: false },
  });
  const blocBascule = await creerBloc(Bloc, { pageId: pageWiki._id, type: 'bascule', ordre: 8 }, {
    contenu: 'Comment se déroule un déploiement ?',
    enfants: [{ type: 'paragraphe', contenu: 'Le déploiement est déclenché par la pipeline CI/CD à chaque fusion sur main.' }],
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'paragraphe', ordre: 9 }, {
    contenu: 'Détail du déploiement continu.',
    parentId: blocBascule._id,
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'encadre', ordre: 10 }, {
    contenu: 'Pensez à mettre à jour ce wiki après chaque changement majeur.',
    proprietes: { emoji: '💡' },
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'citation', ordre: 11 }, {
    contenu: 'La simplicité est la sophistication suprême.',
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'code', ordre: 12 }, {
    contenu: "const demarrer = () => console.log('Service démarré');",
    proprietes: { langage: 'javascript' },
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'separateur', ordre: 13 }, {});
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'math', ordre: 14 }, {
    contenu: 'E = mc^2',
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'image', ordre: 15 }, {
    proprietes: { url: 'https://images.unsplash.com/photo-1518770660439-4636190af475', legende: 'Schéma du système' },
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'signet', ordre: 16 }, {
    contenu: 'Documentation Node.js',
    proprietes: { url: 'https://nodejs.org/docs/latest/api/' },
  });
  const blocColonne = await creerBloc(Bloc, { pageId: pageWiki._id, type: 'colonne', ordre: 17 }, {
    enfants: [{ type: 'paragraphe', contenu: 'Colonne gauche' }, { type: 'paragraphe', contenu: 'Colonne droite' }],
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'paragraphe', ordre: 18 }, {
    contenu: 'Colonne gauche', parentId: blocColonne._id,
  });
  await creerBloc(Bloc, { pageId: pageWiki._id, type: 'paragraphe', ordre: 19 }, {
    contenu: 'Colonne droite', parentId: blocColonne._id,
  });

  await creerBloc(Bloc, { pageId: pageArchi._id, type: 'titre_1', ordre: 0 }, {
    contenu: 'Architecture',
  });
  await creerBloc(Bloc, { pageId: pageArchi._id, type: 'paragraphe', ordre: 1 }, {
    contenu: "Vue d'ensemble des services et de leurs interactions.",
  });
  await creerBloc(Bloc, { pageId: pageArchi._id, type: 'titre_2', ordre: 2 }, {
    contenu: 'Services',
  });
  await creerBloc(Bloc, { pageId: pageArchi._id, type: 'liste_a_puces', ordre: 3 }, {
    contenu: "API Gateway\nService d'authentification\nService de contenu\nService de notifications",
  });
  await creerBloc(Bloc, { pageId: pageArchi._id, type: 'encadre', ordre: 4 }, {
    contenu: "Toute nouvelle dépendance doit être validée en revue d'architecture.",
    proprietes: { emoji: '⚠️' },
  });
  await creerBloc(Bloc, { pageId: pageArchi._id, type: 'code', ordre: 5 }, {
    contenu: 'docker compose up -d',
    proprietes: { langage: 'bash' },
  });
  await creerBloc(Bloc, { pageId: pageArchi._id, type: 'lien_page', ordre: 6 }, {
    contenu: 'Wiki Ingénierie',
    proprietes: { pageId: String(pageWiki._id) },
  });
  await creerBloc(Bloc, { pageId: pageArchi._id, type: 'ia_resume', ordre: 7 }, {
    contenu: 'Résumé généré automatiquement par l\'IA.',
  });

  await creerBloc(Bloc, { pageId: pageCampagne._id, type: 'titre_1', ordre: 0 }, {
    contenu: 'Campagne Q1',
  });
  await creerBloc(Bloc, { pageId: pageCampagne._id, type: 'paragraphe', ordre: 1 }, {
    contenu: 'Objectifs et plan de la campagne du premier trimestre.',
  });
  await creerBloc(Bloc, { pageId: pageCampagne._id, type: 'a_faire', ordre: 2 }, {
    contenu: 'Valider le budget avec la direction', proprietes: { coche: false },
  });
  await creerBloc(Bloc, { pageId: pageCampagne._id, type: 'image', ordre: 3 }, {
    proprietes: { url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f' },
  });
  await creerBloc(Bloc, { pageId: pageCampagne._id, type: 'separateur', ordre: 4 }, {});

  // ---------------------------------------------------------------
  // 4. Bases de donnees
  // ---------------------------------------------------------------
  const baseSprint = await creerBase(Base, { titre: 'Tableau de Sprint' }, {
    icone: '📊',
    espaceId: espaceIng._id,
    pageId: pageSprint._id,
    enLigne: true,
    proprietes: [
      { nom: 'Statut', type: 'statut', options: { groupes: ['À faire', 'En cours', 'Terminé'] } },
      { nom: 'Assigné', type: 'selection', options: { options: ['Awa', 'Bakary', 'Cissé', 'Diop'] } },
      { nom: 'Priorité', type: 'selection', options: { options: ['Basse', 'Moyenne', 'Haute'] } },
      { nom: 'Sprint', type: 'selection', options: { options: ['Sprint 12', 'Sprint 13'] } },
      { nom: 'Échéance', type: 'date', options: {} },
    ],
    vues: [
      { nom: 'Tableau', type: 'tableau', proprietesVisibles: ['Statut', 'Assigné', 'Priorité', 'Sprint', 'Échéance'] },
      { nom: 'Kanban', type: 'kanban', groupes: [{ propriete: 'Statut' }], proprietesVisibles: ['Assigné', 'Priorité'] },
      { nom: 'Calendrier', type: 'calendrier', proprietesVisibles: ['Échéance'] },
    ],
  });

  const baseMarketing = await creerBase(Base, { titre: 'Campagne Marketing' }, {
    icone: '📊',
    espaceId: espaceMkt._id,
    pageId: pageCampagne._id,
    enLigne: true,
    proprietes: [
      { nom: 'Statut', type: 'statut', options: { groupes: ['À faire', 'En cours', 'Terminé'] } },
      { nom: 'Canal', type: 'selection', options: { options: ['Blog', 'Réseaux sociaux', 'E-mail', 'Vidéo'] } },
      { nom: 'Budget', type: 'nombre', options: {} },
      { nom: 'Échéance', type: 'date', options: {} },
    ],
    vues: [
      { nom: 'Tableau', type: 'tableau', proprietesVisibles: ['Statut', 'Canal', 'Budget', 'Échéance'] },
      { nom: 'Kanban', type: 'kanban', groupes: [{ propriete: 'Statut' }], proprietesVisibles: ['Canal', 'Budget'] },
      { nom: 'Galerie', type: 'galerie', proprietesVisibles: ['Canal', 'Budget'] },
    ],
  });

  // ---------------------------------------------------------------
  // 5. Elements (lignes des bases)
  // ---------------------------------------------------------------
  const elements = [
    // Tableau de Sprint (Ingénierie)
    {
      baseId: baseSprint._id, titre: 'Mettre en place la CI/CD', assigne: 'Awa', priorite: 'haute',
      etiquette: 'infra', dateDebut: jour(-2), dateFin: jour(3),
      valeurs: { Statut: 'En cours', 'Assigné': 'Awa', 'Priorité': 'Haute', Sprint: 'Sprint 12', 'Échéance': jour(3).toISOString() },
    },
    {
      baseId: baseSprint._id, titre: "Refonte de l'API publique", assigne: 'Bakary', priorite: 'moyenne',
      etiquette: 'backend', dateDebut: jour(1), dateFin: jour(10),
      valeurs: { Statut: 'À faire', 'Assigné': 'Bakary', 'Priorité': 'Moyenne', Sprint: 'Sprint 12', 'Échéance': jour(10).toISOString() },
    },
    {
      baseId: baseSprint._id, titre: 'Migration de la base de données', assigne: 'Cissé', priorite: 'haute',
      etiquette: 'donnees', dateDebut: jour(-8), dateFin: jour(-4),
      valeurs: { Statut: 'Terminé', 'Assigné': 'Cissé', 'Priorité': 'Haute', Sprint: 'Sprint 12', 'Échéance': jour(-4).toISOString() },
    },
    {
      baseId: baseSprint._id, titre: 'Documentation des endpoints', assigne: 'Diop', priorite: 'basse',
      etiquette: 'docs', dateDebut: jour(2), dateFin: jour(7),
      valeurs: { Statut: 'En cours', 'Assigné': 'Diop', 'Priorité': 'Basse', Sprint: 'Sprint 13', 'Échéance': jour(7).toISOString() },
    },
    {
      baseId: baseSprint._id, titre: "Correction du bug d'authentification", assigne: 'Bakary', priorite: 'urgente',
      etiquette: 'bug', dateDebut: jour(-1), dateFin: jour(1),
      valeurs: { Statut: 'En cours', 'Assigné': 'Bakary', 'Priorité': 'Haute', Sprint: 'Sprint 13', 'Échéance': jour(1).toISOString() },
    },
    {
      baseId: baseSprint._id, titre: 'Optimisation des requêtes', assigne: 'Cissé', priorite: 'moyenne',
      etiquette: 'performance', dateDebut: jour(5), dateFin: jour(14),
      valeurs: { Statut: 'À faire', 'Assigné': 'Cissé', 'Priorité': 'Moyenne', Sprint: 'Sprint 13', 'Échéance': jour(14).toISOString() },
    },
    {
      baseId: baseSprint._id, titre: 'Tests de bout en bout', assigne: 'Diop', priorite: 'basse',
      etiquette: 'qualite', dateDebut: jour(9), dateFin: jour(18),
      valeurs: { Statut: 'À faire', 'Assigné': 'Diop', 'Priorité': 'Basse', Sprint: 'Sprint 13', 'Échéance': jour(18).toISOString() },
    },
    // Campagne Marketing
    {
      baseId: baseMarketing._id, titre: 'Lancement de la page produit', assigne: 'Awa', priorite: 'haute',
      etiquette: 'web', dateDebut: jour(-1), dateFin: jour(5),
      valeurs: { Statut: 'En cours', Canal: 'Blog', Budget: 2500, 'Échéance': jour(5).toISOString() },
    },
    {
      baseId: baseMarketing._id, titre: "Série d'articles de blog", assigne: 'Bakary', priorite: 'moyenne',
      etiquette: 'contenu', dateDebut: jour(3), dateFin: jour(12),
      valeurs: { Statut: 'À faire', Canal: 'Blog', Budget: 1200, 'Échéance': jour(12).toISOString() },
    },
    {
      baseId: baseMarketing._id, titre: 'Campagne réseaux sociaux', assigne: 'Cissé', priorite: 'haute',
      etiquette: 'social', dateDebut: jour(1), dateFin: jour(8),
      valeurs: { Statut: 'En cours', Canal: 'Réseaux sociaux', Budget: 3000, 'Échéance': jour(8).toISOString() },
    },
    {
      baseId: baseMarketing._id, titre: 'Newsletter de février', assigne: 'Diop', priorite: 'basse',
      etiquette: 'email', dateDebut: jour(-6), dateFin: jour(-3),
      valeurs: { Statut: 'Terminé', Canal: 'E-mail', Budget: 300, 'Échéance': jour(-3).toISOString() },
    },
    {
      baseId: baseMarketing._id, titre: 'Vidéo de présentation', assigne: 'Awa', priorite: 'moyenne',
      etiquette: 'video', dateDebut: jour(6), dateFin: jour(20),
      valeurs: { Statut: 'À faire', Canal: 'Vidéo', Budget: 4500, 'Échéance': jour(20).toISOString() },
    },
  ];

  for (const element of elements) {
    await creerElement(Element, { baseId: element.baseId, titre: element.titre }, element);
  }

  // ---------------------------------------------------------------
  // 6. Modeles (gabarits reutilisables)
  // ---------------------------------------------------------------
  const modeles = [
    {
      cle: { nom: 'Réunion hebdo' },
      data: {
        description: "Ordre du jour type pour la réunion hebdomadaire de l'équipe.",
        categorie: 'officiel', icone: '📅', espaceId: espaceIng._id,
        contenu: { sections: ['Participants', 'Points en cours', 'Décisions', 'Actions'] },
      },
    },
    {
      cle: { nom: 'Note de recherche' },
      data: {
        description: 'Structure pour consigner une exploration technique.',
        categorie: 'communaute', icone: '🔬', espaceId: espaceIng._id,
        contenu: { sections: ['Contexte', 'Pistes', 'Résultats', 'Recommandation'] },
      },
    },
    {
      cle: { nom: 'Rétrospective' },
      data: {
        description: 'Bilan de sprint : ce qui a marché, ce qui doit changer.',
        categorie: 'perso', icone: '🔄', espaceId: espaceIng._id,
        contenu: { sections: ['Points positifs', 'Points à améliorer', 'Actions'] },
      },
    },
    {
      cle: { nom: 'Plan de lancement' },
      data: {
        description: "Checklist de lancement d'une fonctionnalité ou d'un produit.",
        categorie: 'officiel', icone: '🚀', espaceId: espaceMkt._id,
        contenu: { sections: ['Objectifs', 'Audiences', 'Canaux', 'Jalons', 'Indicateurs'] },
      },
    },
    {
      cle: { nom: 'Journal quotidien' },
      data: {
        description: 'Gabarit de journal personnel quotidien.',
        categorie: 'perso', icone: '📓', espaceId: espaceIng._id,
        contenu: { sections: ['Humeur', 'Priorités', 'Notes', 'Gratitude'] },
      },
    },
    {
      cle: { nom: 'Fiche projet' },
      data: {
        description: "Fiche de synthèse d'un projet (objectifs, équipe, échéances).",
        categorie: 'officiel', icone: '📁', espaceId: espaceMkt._id,
        contenu: { sections: ['Contexte', 'Objectifs', 'Équipe', 'Échéances', 'Risques'] },
      },
    },
  ];

  // Galerie étendue : 50 gabarits supplémentaires couvrant les usages courants
  // (gestion de projet, produit, marketing, RH, finance, documentation...).
  const modelesSupplementaires = [
    ['Compte rendu de réunion', 'Synthèse des échanges, décisions et actions à la suite d’une réunion.', 'officiel', '🗒️', espaceIng._id, ['Participants', 'Ordre du jour', 'Décisions', 'Actions', 'Prochaine réunion']],
    ['Ordre du jour', 'Plan détaillé d’une réunion avec les sujets et les temps de parole.', 'officiel', '📋', espaceIng._id, ['Objectifs', 'Sujets', 'Intervenants', 'Durée', 'Documents']],
    ['Suivi de décisions', 'Registre des décisions prises et de leur avancement.', 'officiel', '✅', espaceIng._id, ['Décision', 'Responsable', 'Échéance', 'Statut', 'Commentaires']],
    ['Rétrospective de projet', 'Bilan de fin de projet : réussites, difficultés et enseignements.', 'officiel', '🔄', espaceIng._id, ['Contexte', 'Ce qui a marché', 'Ce qui doit changer', 'Actions', 'Merci']],
    ['Post-mortem incident', 'Analyse structurée d’un incident technique et des mesures correctives.', 'officiel', '🚨', espaceIng._id, ['Résumé', 'Chronologie', 'Impact', 'Cause racine', 'Actions correctives']],
    ['Spécification fonctionnelle', 'Description détaillée d’une fonctionnalité et de ses critères d’acceptation.', 'officiel', '📐', espaceIng._id, ['Contexte', 'Objectifs', 'User stories', 'Critères d’acceptation', 'Hors périmètre']],
    ['Document d’architecture', 'Vue d’ensemble technique : composants, flux et choix structurants.', 'officiel', '🏗️', espaceIng._id, ['Vue d’ensemble', 'Composants', 'Flux de données', 'Choix techniques', 'Risques']],
    ['Plan de test', 'Stratégie et cas de test pour valider une livraison.', 'officiel', '🧪', espaceIng._id, ['Périmètre', 'Environnements', 'Cas de test', 'Résultats', 'Validation']],
    ['Rapport de bug', 'Fiche standardisée pour décrire et suivre un défaut.', 'officiel', '🐞', espaceIng._id, ['Description', 'Étapes de reproduction', 'Comportement attendu', 'Comportement observé', 'Environnement']],
    ['Feuille de route produit', 'Vision produit et jalons planifiés sur plusieurs trimestres.', 'officiel', '🗺️', espaceMkt._id, ['Vision', 'Thèmes', 'Jalons', 'Dépendances', 'Indicateurs']],
    ['PRD produit', 'Document de référence pour cadrer une nouvelle fonctionnalité.', 'officiel', '📦', espaceMkt._id, ['Problème', 'Utilisateurs', 'Solution proposée', 'Métriques', 'Risques']],
    ['Analyse concurrentielle', 'Comparatif des acteurs du marché et de leurs positionnements.', 'communaute', '🔍', espaceMkt._id, ['Concurrents', 'Offres', 'Forces', 'Faiblesses', 'Opportunités']],
    ['Étude de marché', 'Synthèse des tendances, segments et opportunités d’un marché.', 'communaute', '📈', espaceMkt._id, ['Marché', 'Segments', 'Tendances', 'Concurrence', 'Conclusions']],
    ['Persona client', 'Portrait type d’un utilisateur cible et de ses besoins.', 'officiel', '👤', espaceMkt._id, ['Profil', 'Besoins', 'Frustrations', 'Objectifs', 'Citations']],
    ['Parcours utilisateur', 'Cartographie des étapes et points de contact du client.', 'officiel', '🛤️', espaceMkt._id, ['Étapes', 'Actions', 'Points de contact', 'Émotions', 'Opportunités']],
    ['Brief créatif', 'Cadrage d’une création graphique ou publicitaire.', 'communaute', '🎨', espaceMkt._id, ['Contexte', 'Objectifs', 'Cible', 'Message', 'Contraintes']],
    ['Plan éditorial', 'Organisation des publications et des thèmes de contenu.', 'officiel', '🗞️', espaceMkt._id, ['Thèmes', 'Formats', 'Calendrier', 'Canaux', 'Responsables']],
    ['Calendrier de contenu', 'Planning mensuel des publications sur les réseaux.', 'officiel', '📅', espaceMkt._id, ['Semaine', 'Sujet', 'Format', 'Canal', 'Statut']],
    ['Communiqué de presse', 'Modèle de communiqué pour annoncer une actualité.', 'communaute', '📰', espaceMkt._id, ['Titre', 'Accroche', 'Corps', 'Citations', 'Contact']],
    ['Plan de campagne', 'Organisation d’une campagne marketing multicanale.', 'officiel', '📣', espaceMkt._id, ['Objectifs', 'Audiences', 'Messages', 'Canaux', 'Budget']],
    ['Rapport de performance', 'Bilan des résultats d’un canal ou d’une campagne.', 'officiel', '📊', espaceMkt._id, ['Période', 'Objectifs', 'Résultats', 'Analyse', 'Recommandations']],
    ['Tableau de bord KPI', 'Définition et suivi des indicateurs clés.', 'officiel', '📉', espaceIng._id, ['Indicateurs', 'Définitions', 'Cibles', 'Fréquence', 'Responsables']],
    ['Budget prévisionnel', 'Prévision des revenus et dépenses par période.', 'officiel', '💰', espaceMkt._id, ['Revenus', 'Dépenses', 'Hypothèses', 'Scénarios', 'Validation']],
    ['Plan de trésorerie', 'Suivi des entrées et sorties de trésorerie.', 'officiel', '🏦', espaceMkt._id, ['Solde initial', 'Encaissements', 'Décaissements', 'Solde final', 'Alertes']],
    ['Devis client', 'Proposition chiffrée pour un client.', 'communaute', '🧾', espaceMkt._id, ['Client', 'Prestations', 'Quantités', 'Prix', 'Conditions']],
    ['Facture', 'Modèle de facture avec détails et mentions légales.', 'communaute', '💳', espaceMkt._id, ['Émetteur', 'Client', 'Lignes', 'TVA', 'Total']],
    ['Proposition commerciale', 'Document de vente présentant une offre et ses bénéfices.', 'communaute', '🤝', espaceMkt._id, ['Contexte', 'Besoins', 'Offre', 'Tarifs', 'Prochaines étapes']],
    ['Compte rendu d’entretien', 'Synthèse d’un entretien de recrutement ou client.', 'officiel', '🗣️', espaceIng._id, ['Participant', 'Contexte', 'Points clés', 'Évaluation', 'Suite']],
    ['Grille d’évaluation', 'Critères et barème pour évaluer une candidature ou un projet.', 'officiel', '📏', espaceIng._id, ['Critères', 'Barème', 'Observations', 'Note finale', 'Décision']],
    ['Plan de formation', 'Programme et objectifs d’une session de formation.', 'officiel', '🎓', espaceIng._id, ['Public', 'Objectifs', 'Programme', 'Méthodes', 'Évaluation']],
    ['Fiche de poste', 'Description des missions et compétences d’un poste.', 'officiel', '📇', espaceIng._id, ['Intitulé', 'Missions', 'Compétences', 'Conditions', 'Processus']],
    ['Onboarding nouvel employé', 'Parcours d’accueil et de prise de poste.', 'officiel', '🚪', espaceIng._id, ['Avant arrivée', 'Jour 1', 'Semaine 1', 'Premier mois', 'Contacts']],
    ['Entretien annuel', 'Support d’évaluation annuelle et de fixation d’objectifs.', 'officiel', '📝', espaceIng._id, ['Bilan', 'Réussites', 'Axes de progrès', 'Objectifs', 'Plan d’action']],
    ['Plan de carrière', 'Trajectoire professionnelle et étapes de développement.', 'perso', '🧭', espaceIng._id, ['Situation actuelle', 'Aspirations', 'Compétences à développer', 'Étapes', 'Échéances']],
    ['Manuel de procédures', 'Procédures internes et bonnes pratiques d’une équipe.', 'officiel', '📚', espaceIng._id, ['Objet', 'Périmètre', 'Procédures', 'Responsables', 'Révision']],
    ['Base de connaissances', 'Articles de référence pour répondre aux questions courantes.', 'communaute', '🧠', espaceIng._id, ['Catégorie', 'Question', 'Réponse', 'Références', 'Mise à jour']],
    ['FAQ interne', 'Questions fréquentes et réponses pour les équipes.', 'communaute', '❓', espaceIng._id, ['Question', 'Réponse', 'Public', 'Liens', 'Auteur']],
    ['Guide d’utilisation', 'Mode d’emploi pas à pas d’une fonctionnalité ou d’un outil.', 'officiel', '📖', espaceIng._id, ['Prérequis', 'Étapes', 'Captures', 'Astuces', 'Dépannage']],
    ['Tutoriel pas à pas', 'Tutoriel pédagogique avec étapes numérotées.', 'communaute', '🧑‍🏫', espaceIng._id, ['Objectif', 'Matériel', 'Étapes', 'Vérification', 'Pour aller plus loin']],
    ['Note de version', 'Changelog des nouveautés et corrections.', 'officiel', '🚀', espaceIng._id, ['Version', 'Nouveautés', 'Corrections', 'Ruptures', 'Date']],
    ['Journal de bord projet', 'Suivi quotidien ou hebdomadaire de l’avancement.', 'perso', '📔', espaceIng._id, ['Date', 'Avancement', 'Blocages', 'Décisions', 'Prochaines étapes']],
    ['Gestion des risques', 'Identification et suivi des risques d’un projet.', 'officiel', '⚠️', espaceIng._id, ['Risque', 'Probabilité', 'Impact', 'Mitigation', 'Responsable']],
    ['Registre des décisions', 'Historique des décisions importantes et de leur justification.', 'officiel', '🗃️', espaceIng._id, ['Date', 'Décision', 'Contexte', 'Alternatives', 'Conséquences']],
    ['Matrice RACI', 'Répartition des rôles et responsabilités par activité.', 'officiel', '🧩', espaceIng._id, ['Activité', 'Responsable', 'Approbateur', 'Consulté', 'Informé']],
    ['Plan de communication', 'Organisation et canaux de communication d’un projet.', 'officiel', '📢', espaceMkt._id, ['Objectifs', 'Audiences', 'Messages', 'Canaux', 'Calendrier']],
    ['Rétrospective trimestrielle', 'Bilan d’un trimestre et priorités du suivant.', 'officiel', '🗓️', espaceMkt._id, ['Résultats', 'Apprentissages', 'Difficultés', 'Priorités', 'Actions']],
    ['Objectifs OKR', 'Définition d’objectifs et de résultats clés mesurables.', 'officiel', '🎯', espaceMkt._id, ['Objectif', 'Résultats clés', 'Initiatives', 'Cibles', 'Suivi']],
    ['Brainstorming', 'Espace de production d’idées sans filtre.', 'perso', '💡', espaceIng._id, ['Question', 'Idées', 'Thèmes', 'Sélection', 'Prochaines étapes']],
    ['Carte mentale', 'Organisation visuelle des idées et de leurs liens.', 'perso', '🕸️', espaceIng._id, ['Sujet central', 'Branches', 'Sous-idées', 'Liens', 'Actions']],
    ['Checklist de lancement', 'Liste des vérifications avant la mise en ligne.', 'officiel', '🏁', espaceMkt._id, ['Produit', 'Marketing', 'Support', 'Technique', 'Communication']],
  ].map(([nom, description, categorie, icone, espaceId, sections]) => ({
    cle: { nom },
    data: { description, categorie, icone, espaceId, contenu: { sections } },
  }));

  modeles.push(...modelesSupplementaires);

  for (const { cle, data } of modeles) {
    await creerModele(Modele, cle, data);
  }

  // ---------------------------------------------------------------
  // 7. Connexions (integrations tierces)
  // ---------------------------------------------------------------
  const connexions = [
    { type: 'slack', nom: 'Slack', config: { canal: '#general', webhook: 'https://hooks.slack.com/services/xxx' } },
    { type: 'github', nom: 'GitHub', config: { organisation: 'acme', depotDefaut: 'api' } },
    { type: 'jira', nom: 'Jira', config: { projet: 'SPRINT', domaine: 'acme.atlassian.net' } },
    { type: 'google_drive', nom: 'Google Drive', config: { dossierRacine: 'NOVA/Exports' } },
    { type: 'figma', nom: 'Figma', config: { equipe: 'Design', fichierDefaut: 'Maquettes' } },
  ];
  for (const connexion of connexions) {
    await creerConnexion(Connexion, { type: connexion.type, nom: connexion.nom }, {
      config: connexion.config, espaceId: espaceIng._id, active: true,
    });
  }

  // ---------------------------------------------------------------
  // 8. Favoris
  // ---------------------------------------------------------------
  const favoris = [
    { page: pageWiki, ordre: 0 },
    { page: pageSprint, ordre: 1 },
    { page: pageCampagne, ordre: 2 },
    { page: pageArchi, ordre: 3 },
  ];
  for (const favori of favoris) {
    await creerFavori(Favori, { pageId: favori.page._id }, {
      espaceId: favori.page.espaceId, ordre: favori.ordre,
    });
  }

  // ---------------------------------------------------------------
  // 9. Notifications
  // ---------------------------------------------------------------
  const notifications = [
    {
      cle: { titre: 'Nouvelle mention dans Architecture' },
      data: { type: 'mention', message: 'Awa vous a mentionné dans la page Architecture.', pageId: pageArchi._id, lu: false },
    },
    {
      cle: { titre: 'Commentaire sur Wiki Ingénierie' },
      data: { type: 'commentaire', message: 'Un commentaire a été ajouté sur le wiki.', pageId: pageWiki._id, lu: false },
    },
    {
      cle: { titre: 'Page partagée avec vous' },
      data: { type: 'partage', message: 'Bakary a partagé « Campagne Q1 » avec vous.', pageId: pageCampagne._id, lu: false },
    },
    {
      cle: { titre: 'Rappel : échéance de sprint' },
      data: { type: 'rappel', message: 'Le sprint 13 se termine dans 3 jours.', pageId: pageSprint._id, lu: true },
    },
    {
      cle: { titre: 'Bienvenue sur NOVA' },
      data: { type: 'systeme', message: 'Votre espace de travail est prêt.', pageId: pageWiki._id, lu: true },
    },
    {
      cle: { titre: 'Commentaire résolu' },
      data: { type: 'commentaire', message: 'Cissé a résolu une discussion.', pageId: pageArchi._id, lu: true },
    },
  ];
  for (const { cle, data } of notifications) {
    await creerNotification(Notification, cle, data);
  }

  // ---------------------------------------------------------------
  // 10. Parametres de l'espace de travail
  // ---------------------------------------------------------------
  await creerParametre(Parametre, { nomEspace: 'Mon Espace' }, {
    espaceId: espaceIng._id,
    icone: '🪐',
    domaine: 'mon-espace.nova.site',
    apparence: 'clair',
    police: 'defaut',
    langue: 'fr',
    notifEmail: true,
    plan: 'plus',
  });

  // ---------------------------------------------------------------
  // 11. Publications
  // ---------------------------------------------------------------
  await creerPublication(Publication, { pageId: pageGuide._id, portee: 'web' }, {
    domaine: 'guide-integration.nova.site',
    acces: 'lecture',
    invites: [],
    actif: true,
  });
  await creerPublication(Publication, { pageId: pageTransverse._id, portee: 'personnes' }, {
    acces: 'edition',
    invites: [
      { email: 'awa@acme.test', role: 'editeur' },
      { email: 'bakary@acme.test', role: 'lecteur' },
    ],
    actif: true,
  });
  await creerPublication(Publication, { pageId: pageCalendrier._id, portee: 'invite' }, {
    domaine: 'calendrier-editorial.nova.site',
    acces: 'commentaire',
    invites: [{ email: 'cissé@acme.test', role: 'commentateur' }],
    actif: true,
  });

  // ---------------------------------------------------------------
  // 12. Requetes IA
  // ---------------------------------------------------------------
  const requetesIA = [
    {
      cle: { question: 'Quelle est la procédure de déploiement ?' },
      data: {
        type: 'question',
        reponse: "Le déploiement se fait via la pipeline CI/CD à chaque fusion sur la branche main, après passage des tests.",
        sources: [{ titre: 'Wiki Ingénierie', pageId: pageWiki._id }, { titre: 'Architecture', pageId: pageArchi._id }],
        modele: 'nova-ia', pageId: pageWiki._id, dureeMs: 820,
      },
    },
    {
      cle: { question: "Résume la page Campagne Q1" },
      data: {
        type: 'resume',
        reponse: 'La campagne Q1 vise à lancer la page produit, publier une série d\'articles et animer les réseaux sociaux, avec un budget global de 11 500.',
        sources: [{ titre: 'Campagne Q1', pageId: pageCampagne._id }],
        modele: 'nova-ia', pageId: pageCampagne._id, dureeMs: 1040,
      },
    },
    {
      cle: { question: 'Rédige une description pour la vidéo de présentation' },
      data: {
        type: 'redaction',
        reponse: 'Une vidéo de deux minutes présentant le produit, ses bénéfices et un appel à l\'action clair.',
        sources: [{ titre: 'Campagne Marketing', pageId: pageCampagne._id }],
        modele: 'nova-ia', pageId: pageCampagne._id, dureeMs: 1310,
      },
    },
    {
      cle: { question: 'Traduis les objectifs du sprint en anglais' },
      data: {
        type: 'traduction',
        reponse: 'Set up CI/CD, redesign the public API, migrate the database and fix the authentication bug.',
        sources: [{ titre: 'Tableau de Sprint', pageId: pageSprint._id }],
        modele: 'nova-ia', pageId: pageSprint._id, dureeMs: 640,
      },
    },
  ];
  for (const { cle, data } of requetesIA) {
    await creerRequeteIA(RequeteIA, cle, data);
  }

  // ---------------------------------------------------------------
  // 13. Commentaires (discussions sur pages/blocs)
  // ---------------------------------------------------------------
  const commentaires = [
    {
      cle: { pageId: pageArchi._id, auteurNom: 'Awa' },
      data: { contenu: "Peut-on préciser le rôle de l'API Gateway dans l'authentification ?", resolu: false, position: { x: 0, y: 2 } },
    },
    {
      cle: { pageId: pageWiki._id, auteurNom: 'Bakary' },
      data: { contenu: 'Le guide de démarrage rapide est très clair, merci !', resolu: true, position: { x: 0, y: 5 } },
    },
    {
      cle: { pageId: pageCampagne._id, auteurNom: 'Cissé' },
      data: { contenu: 'Il faudrait ajouter le budget prévisionnel de la vidéo.', resolu: false, position: { x: 0, y: 3 } },
    },
  ];
  for (const { cle, data } of commentaires) {
    await creerCommentaire(Commentaire, cle, data);
  }

  // ---------------------------------------------------------------
  // 14. Dossier Trivida (espace d'equipe, page maitre, tableaux, calendrier)
  // ---------------------------------------------------------------
  await seedTrivida({ appName, getModel, logSeed });

  // ---------------------------------------------------------------
  // Journalisation des ids crees
  // ---------------------------------------------------------------
  if (logSeed) {
    for (const entree of journal) {
      if (entree.ids.length) {
        await logSeed({
          appName,
          feature: entree.feature,
          modelName: entree.modelName,
          schemaPath: entree.schemaPath,
          ids: entree.ids,
        });
      }
    }
    if (tousLesIds.length) {
      await logSeed({
        appName,
        feature: 'nova',
        modelName: 'Seed',
        schemaPath: path.join(__dirname, 'seed.js'),
        ids: tousLesIds,
      });
    }
  }

  return { count };
};

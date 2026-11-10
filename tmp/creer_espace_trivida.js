/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/database');
const getModel = require('../dry/core/factories/modelFactory');

const WorkspacesSchema = require('../dryApp/Nova/features/workspaces/model/workspaces.schema');
const EspacesSchema = require('../dryApp/Nova/features/espaces/model/espaces.schema');
const PagesSchema = require('../dryApp/Nova/features/pages/model/pages.schema');
const BlocsSchema = require('../dryApp/Nova/features/blocs/model/blocs.schema');

const EMAIL_ADMIN = process.env.NOVA_ADMIN_EMAIL || 'admin@admin.com';
const NOM_ESPACE = 'Trivida';
const TITRE_PAGE_MAITRE = 'TRIVIDA — Dossier Maître du Projet';

/* ------------------------------------------------------------------ */
/* Contenu du document maître (blocs de la page principale)            */
/* ------------------------------------------------------------------ */
const BLOCS_MAITRE = [
  ['titre_1', 'TRIVIDA — Dossier Maître du Projet'],
  ['paragraphe', "The Intelligent Life Companion — Produit de CyberFusion Group · République du Congo. En production · Version documentée v3.x · Android / Google Play · Devise principale XAF · Horizon stratégique Vision 2030."],
  ['encadre', "Référentiel constitué à partir du Document Maître Trivida v3.0 et des documents techniques et stratégiques fournis. Les statuts techniques doivent être actualisés avant de les considérer comme des états de production vérifiés en novembre 2026.", '📌'],

  ['titre_2', '1. Identité et présentation générale'],
  ['paragraphe', "Nom : Trivida. Origine : « Tri » (trois dimensions essentielles de la vie) et « Vida » (vie, du latin vita)."],
  ['paragraphe', "Les trois piliers fondateurs :"],
  ['liste_a_puces', "Décider\nGérer\nConstruire"],
  ['paragraphe', "Catégorie : LifeTech — technologie au service de la progression personnelle et financière. Fondateur : Christ Gottlib MAYALA. Structure porteuse : CyberFusion Group."],
  ['paragraphe', "Trivida est un projet développé indépendamment au Congo, déjà disponible sur Google Play. Il ne doit pas être présenté comme une simple idée ou une application à concevoir."],
  ['titre_3', 'Mission officielle'],
  ['citation', "Aider chaque Africain, quel que soit son niveau de revenu, à construire une vie financière plus stable grâce à une meilleure gestion de son argent, de meilleures décisions, des habitudes positives et une intelligence artificielle accessible."],
  ['titre_3', 'Vision 2030'],
  ['paragraphe', "Construire le premier compagnon de vie intelligent d'Afrique francophone. Trivida doit devenir une application que les utilisateurs ouvrent chaque matin pour organiser leur journée et chaque soir pour comprendre leurs progrès. À long terme, la plateforme doit créer une passerelle entre particuliers, banques, Mobile Money, assurances, coopératives et solutions d'investissement."],
  ['titre_3', 'Positionnement'],
  ['paragraphe', "Trivida n'est pas : une banque, un portefeuille Mobile Money, une simple application de budget ou un chatbot IA."],
  ['paragraphe', "Trivida est un compagnon de vie intelligent conçu pour accompagner les Africains dans leurs finances, leurs objectifs, leurs décisions et leur progression personnelle."],

  ['titre_2', '2. Le problème auquel Trivida répond'],
  ['paragraphe', "En Afrique centrale, la gestion financière personnelle repose encore sur des méthodes peu structurées : cahiers personnels, conversations WhatsApp, tableurs Excel, mémoire personnelle, comptabilité informelle."],
  ['liste_a_puces', "On ne sait pas où part son argent → suivi des transactions et statistiques\nOn dépense sans planification → budgets et analyses\nOn prête sans suivi → gestion des dettes et remboursements\nOn n'arrive pas à économiser → objectifs d'épargne\nOn gère mal son petit commerce → module Business\nOn décide sans données → Trivida Intel\nOn abandonne ses objectifs → suivi de progression et accompagnement"],
  ['paragraphe', "Le véritable produit vendu par Trivida n'est pas seulement le suivi des dépenses : c'est la possibilité de construire progressivement une stabilité financière, même avec des revenus modestes."],

  ['titre_2', '3. Les cinq cerveaux de Trivida'],
  ['titre_3', 'Money Brain — Le cerveau financier'],
  ['liste_a_puces', "Revenus et dépenses\nBudgets et écarts budgétaires\nTrésorerie prévisionnelle\nÉpargne et objectifs\nDettes et remboursements\nAnalyse des habitudes de consommation\nScore de santé financière\nOptimisation des dépenses"],
  ['titre_3', 'Life Brain — L’organisation de la vie'],
  ['liste_a_puces', "LifeOS : tableau de bord quotidien\nObjectifs personnels\nMissions et tâches quotidiennes\nHabitudes\nNotifications contextuelles\nSuivi de progression\nRappels importants"],
  ['titre_3', 'Decision Brain — Le cerveau décisionnel'],
  ['liste_a_puces', "Purchase Simulator : puis-je acheter cet article ?\nGoal Simulator : impact sur un objectif\nDebt Simulator : comment rembourser ses dettes\nSavings Simulator : améliorer son épargne\nInvestment Simulator : impact d'un investissement\nComparaison de scénarios\nRecommandations adaptées aux données disponibles"],
  ['titre_3', 'Growth Brain — Le cerveau de progression'],
  ['liste_a_puces', "Health Score de 0 à 100\nDéfis hebdomadaires\nBadges et récompenses\nStreaks : jours consécutifs d'activité\nSuivi des objectifs atteints\nCoaching de progression\nClassements Business selon les droits d'accès"],
  ['titre_3', 'Companion Brain — La mémoire intelligente'],
  ['liste_a_puces', "Profil personnel intelligent\nObjectifs et préférences\nHistorique des interactions pertinentes\nContexte financier personnalisé\nAssistant IA conversationnel\nConseils contextualisés\nContinuité de l'accompagnement"],
  ['paragraphe', "Logique centrale : données personnelles → calculs financiers → analyse → prévision → simulation → décision → action → mesure des résultats → apprentissage."],
  ['encadre', "Règle architecturale fondamentale : les moteurs déterministes réalisent les calculs financiers. L'intelligence artificielle explique, synthétise et contextualise. Un LLM ne doit jamais inventer un solde ni calculer seul une donnée financière critique.", '⚠️'],

  ['titre_2', '4. Fonctionnalités et modules du produit'],
  ['liste_a_puces', "Authentification — inscription, connexion, Google OAuth\nDashboard — vue globale de la situation financière\nTransactions — revenus, dépenses, prêts, remboursements\nBudgets — définition et suivi des limites\nÉpargne — objectifs, versements, progression\nDettes — créances, emprunts, remboursements\nBusiness — activités commerciales et trésorerie\nClients — gestion de la clientèle\nFacturation — création et suivi des factures\nStocks — gestion des stocks commerciaux\nIA financière — conseils et analyses\nTrivida Intel — intelligence financière et décisionnelle\nLifeOS — organisation de la journée\nNotifications — alertes et rappels\nSécurité — PIN, biométrie et protection\nSynchronisation — sauvegarde et synchronisation cloud\nAbonnements — Free, Premium et Business\nPaiements — souscriptions via SenePay\nOCR — lecture de reçus\nCalculatrice — calculs et outils financiers"],

  ['titre_2', '5. État réel du développement'],
  ['titre_3', 'Classées complètes dans l’audit (juillet 2026)'],
  ['liste_a_puces', "Transactions\nDashboard\nModule Business\nÉpargne\nGoogle Auth\nNotifications\nBiométrie et PIN"],
  ['titre_3', 'Classées partielles dans l’audit'],
  ['liste_a_puces', "Dettes et prêts — hook de gestion en lecture seule, opérations incomplètes\nSynchronisation — pull différentiel incomplet, conflits non résolus\nOffline — pas de synchronisation complète en arrière-plan\nFreemium — restrictions peu ou pas appliquées\nSenePay — accès au checkout bloqué par des cartes commentées\nMode invité — expiration et migration inopérantes\nOCR — ML Kit absent, repli sur saisie manuelle\nCalculatrice Pro — TVA et convertisseur désactivés\nEmpty States — présents sur une partie seulement des écrans"],
  ['titre_3', 'Moteurs déjà présents'],
  ['liste_a_puces', "Classification des dépenses\nBudget et variance\nPrévision de trésorerie\nKPIs financiers\nScore de santé\nAnalyse de saisonnalité\nOptimisation des dépenses\nPurchase / Goal / Debt / Savings / Investment Simulator\nBreak-even\nAnalyse des marges et rentabilité des produits\nAnalyse des stocks\nBusiness Intelligence"],
  ['encadre', "Conséquence pour l'équipe : la priorité n'est pas d'ajouter toujours plus de fonctionnalités. Il faut aussi terminer, tester et fiabiliser ce qui est déjà développé.", '💡'],

  ['titre_2', '6. Architecture technique'],
  ['liste_a_puces', "Mobile — React Native / Expo SDK 54, TypeScript/JavaScript\nStockage local — SQLite\nPréférences et cache — AsyncStorage\nTokens sécurisés — SecureStore\nBackend — Node.js / Express (DRY API)\nBase de données — MongoDB\nAuthentification — JWT et Refresh Token\nIntelligence artificielle — FreeLLM\nPaiement — SenePay\nNotifications — Expo Notifications / BackgroundFetch\nContrôle de version — Git / GitHub"],
  ['titre_3', 'Principes techniques obligatoires'],
  ['liste_numerotee', "Respecter l'architecture DRY\nÉviter la duplication de la logique métier\nConserver le fonctionnement offline-first\nUtiliser SQLite pour les opérations locales appropriées\nUtiliser MongoDB comme persistance serveur\nProtéger les données de chaque utilisateur\nVérifier les autorisations côté serveur\nTester indépendamment les moteurs financiers\nNe jamais remplacer une règle métier par une instruction IA\nNe pas inventer de résultats lorsque les données sont insuffisantes"],

  ['titre_2', '7. Modèle économique (Freemium à trois niveaux)'],
  ['titre_3', 'Trivida Free — 0 XAF'],
  ['liste_a_puces', "Transactions illimitées\nDashboard et statistiques de base\nSynchronisation cloud sur un appareil\nMaximum 2 objectifs d'épargne\n3 requêtes IA par jour"],
  ['titre_3', 'Trivida Premium — 2 000 XAF / mois'],
  ['liste_a_puces', "Toutes les fonctionnalités Free\nSynchronisation multi-appareils\nModule Business\nExport PDF et Excel\nOCR\n20 requêtes IA par jour\nHistorique illimité\nSimulations et analyses avancées"],
  ['titre_3', 'Trivida Business — 8 000 XAF / mois'],
  ['liste_a_puces', "Toutes les fonctionnalités Premium\nTableau de bord multi-activités\n50 requêtes IA par jour\nSupport prioritaire"],
  ['paragraphe', "Une période d'essai de 7 jours est prévue pour les nouveaux utilisateurs."],
  ['titre_3', 'Sources de revenus futures'],
  ['liste_a_puces', "Partenariats bancaires\nPartenariats Mobile Money\nMicrocrédit et scoring financier\nFormations financières\nLicences White-label\nAPI B2B\nMarketplace de services\nDonnées agrégées et anonymisées, uniquement avec consentement"],
  ['encadre', "Ces revenus futurs ne doivent pas être comptabilisés comme des revenus déjà réalisés.", '⚠️'],

  ['titre_2', '8. Roadmap stratégique 2026–2030'],
  ['liste_a_puces', "2026 — Construire l'habitude : LifeOS, IntelProfile, Money Brain, Health Score\n2027 — Construire l'intelligence : IA prédictive, assistant vocal, anomalies, tontines\n2028 — Construire l'écosystème : Trivida Pay, investissements, scoring, partenariats\n2029–2030 — Construire la plateforme : API, expansion régionale, écosystème LifeTech"],
  ['paragraphe', "Vision géographique : République du Congo, Cameroun, Gabon, RDC, Sénégal, puis extension progressive à l'Afrique francophone."],

  ['titre_2', '9. Marché et positionnement concurrentiel'],
  ['paragraphe', "Cibles : particuliers, salariés, étudiants, familles, petits commerçants et entrepreneurs, personnes qui prêtent à leurs proches, utilisateurs avec des objectifs financiers."],
  ['liste_a_puces', "Cahier papier → pas d'analyse automatique → gestion numérique intelligente\nExcel → complexité et faible mobilité → interface mobile simplifiée\nWave / Orange Money → paiement et transfert → analyse et organisation financière\nYNAB / Mint → adaptation limitée au contexte local → français, XAF, tontines et prêts informels"],
  ['titre_3', 'Avantages concurrentiels'],
  ['liste_numerotee', "Adaptation au marché africain francophone\nDevise XAF intégrée\nGestion des tontines\nPrêts entre proches\nFonctionnement hors ligne\nFaible consommation de données\nModule de gestion commerciale\nIntelligence financière et simulations"],

  ['titre_2', '10. Objectifs et indicateurs de performance'],
  ['paragraphe', "Les chiffres suivants sont des objectifs stratégiques, pas des résultats déjà atteints."],
  ['liste_a_puces', "Téléchargements : 500 à 6 mois · 5 000 à 1 an · 100 000 à 3 ans\nUtilisateurs actifs mensuels : 200 · 2 000 · 50 000\nRétention J30 : 30 % · 40 % · 50 %\nConversion Free → Premium : 5 % · 8 % · 15 %\nRevenu mensuel récurrent : — · 500 USD · 20 000 USD"],
  ['titre_3', 'Indicateurs à suivre dans Nova'],
  ['liste_a_puces', "Acquisition — téléchargements, nouveaux comptes, sources, coût d'acquisition\nActivation — inscriptions terminées, première transaction, premier objectif, première utilisation de Trivida Intel\nEngagement — DAU, MAU, sessions, fréquence des transactions, utilisation de LifeOS\nRétention — J1, J7, J30, retours, objectifs actifs, streak moyen\nMonétisation — abonnements, conversion, revenus récurrents, résiliations, paiements échoués\nTechnique — disponibilité API, erreurs 5xx, latence moyenne et p95, échecs de synchronisation, incidents de sécurité, crashs mobiles"],

  ['titre_2', '11. Organisation de l’équipe'],
  ['paragraphe', "Le projet est porté par son fondateur, avec une équipe de collaborateurs qui participent à son développement et à sa gestion. Les noms et fonctions précises doivent être renseignés dans Nova, sans attribuer de responsabilités non définies officiellement."],
  ['titre_3', 'Fondateur / CEO — Christ Gottlib MAYALA'],
  ['liste_a_puces', "Vision · Stratégie · Décisions finales · Produit\nDéfinir la direction stratégique\nValider les fonctionnalités importantes\nArbitrer les priorités\nSuperviser les responsables\nSuivre les performances\nGérer les partenariats stratégiques\nValider les dépenses importantes"],
  ['titre_3', 'Responsable technique'],
  ['liste_a_puces', "Maintenir l'application mobile\nMaintenir dryApi\nContrôler la qualité du code\nGérer les mises en production\nCorriger les bugs\nSuperviser la sécurité\nVérifier les performances\nDocumenter les modifications techniques"],
  ['titre_3', 'Responsable produit'],
  ['liste_a_puces', "Recueillir les besoins\nDéfinir les parcours utilisateurs\nRédiger les spécifications\nOrganiser les tests fonctionnels\nSuivre la roadmap\nFaire remonter les retours utilisateurs"],
  ['titre_3', 'Marketing et commercial'],
  ['liste_a_puces', "Préparer les campagnes\nCréer les contenus\nDévelopper la communauté\nChercher des partenaires\nSuivre les prospects\nMesurer les résultats des campagnes"],

  ['titre_2', '12. Gouvernance et prise de décision'],
  ['liste_a_puces', "Vision stratégique → Fondateur\nPriorisation générale → Fondateur / Product Owner\nArchitecture technique → Responsable technique\nChoix UX/UI → Responsable produit avec validation\nMise en production → Responsable technique autorisé\nCampagnes marketing → Responsable marketing\nPartenariats → Fondateur / Responsable commercial\nDépenses importantes → Fondateur\nIncidents critiques → Responsable technique et fondateur"],
  ['titre_3', 'Règles de fonctionnement'],
  ['liste_numerotee', "Une tâche doit avoir un responsable unique\nUne tâche doit avoir une échéance\nToute modification importante doit être documentée\nAucun déploiement majeur sans validation\nChaque bug doit avoir une priorité et un statut\nLes décisions importantes doivent être conservées\nLes tâches terminées doivent être vérifiées avant clôture\nLes retards doivent être signalés et expliqués\nLes accès aux systèmes de production doivent être limités\nLes informations financières et données utilisateurs restent confidentielles"],

  ['titre_2', '13. Gestion du développement logiciel'],
  ['liste_a_puces', "Catégories : Frontend mobile, Backend API, Base de données, Intelligence artificielle, Trivida Intel, UX/UI, Sécurité, Tests et qualité, Infrastructure, Marketing, Commercial, Administration\nCycle : Backlog → À faire → En cours → En revue → En test → Terminé\nPriorités : P0 Critique, P1 Haute, P2 Normale, P3 Basse"],
  ['titre_3', 'Modèle obligatoire pour chaque tâche'],
  ['liste_a_puces', "Identifiant · Titre · Description · Module concerné\nResponsable · Collaborateurs\nPriorité · Statut\nDate de création · Date de début · Date limite\nEstimation · Temps réel\nDépendances · Critères d'acceptation\nPièces jointes · Commentaires · Historique des modifications"],
  ['titre_3', 'Gestion des bugs'],
  ['liste_a_puces', "Environnement concerné · Version de l'application\nDescription du problème · Étapes de reproduction\nRésultat attendu · Résultat obtenu\nLogs ou captures · Gravité\nResponsable de correction · Résolution\nTests de non-régression"],

  ['titre_2', '14. Réunions et communication interne'],
  ['titre_3', 'Réunion quotidienne — 10 à 15 minutes'],
  ['liste_numerotee', "Qu'ai-je terminé ?\nQue dois-je faire aujourd'hui ?\nQu'est-ce qui me bloque ?"],
  ['titre_3', 'Réunion hebdomadaire — 30 à 60 minutes'],
  ['liste_a_puces', "Avancement des tâches\nFonctionnalités livrées\nBugs ouverts\nRetards\nPriorités de la semaine suivante\nDécisions nécessaires"],
  ['titre_3', 'Réunion mensuelle — 1 à 2 heures'],
  ['liste_a_puces', "Résultats du mois\nÉvolution des utilisateurs\nPerformance financière\nSatisfaction des utilisateurs\nDépenses et revenus\nÉvaluation des collaborateurs\nObjectifs du mois suivant"],
  ['paragraphe', "Chaque réunion doit générer un compte rendu, des décisions et des tâches attribuées."],

  ['titre_2', '15. Gestion financière du projet'],
  ['titre_3', 'Dépenses à suivre'],
  ['liste_a_puces', "Hébergement backend\nBase de données\nServices IA\nStockage et sauvegardes\nDomaines\nOutils de développement\nCommunication et publicité\nFrais de paiement\nMaintenance\nDépenses administratives\nPrestations externes"],
  ['titre_3', 'Revenus à suivre'],
  ['liste_a_puces', "Abonnements Premium\nAbonnements Business\nPartenariats\nLicences\nServices B2B\nAutres revenus validés"],
  ['titre_3', 'Tableau de bord financier'],
  ['liste_a_puces', "Chiffre d'affaires = total des revenus\nDépenses = total des charges\nRésultat = revenus − dépenses\nMRR = revenus récurrents mensuels\nARR = MRR × 12\nARPU = revenus / utilisateurs payants\nTaux de conversion = payants / utilisateurs éligibles\nChurn = abonnements perdus / abonnements au début de période"],
  ['encadre', "Ne pas confondre chiffre d'affaires, encaissements et bénéfice.", '💡'],

  ['titre_2', '16. Partenariats et développement commercial'],
  ['liste_a_puces', "Banques — faciliter l'accès aux services financiers\nMTN Congo — opportunités stratégiques et innovation\nAirtel Congo — opportunités de collaboration\nCOOPEC — épargne et investissement\nInstitutions financières — distribution de produits financiers\nONG — inclusion financière\nUniversités — sensibilisation et acquisition\nIncubateurs — accompagnement et financement\nEntreprises — déploiement de solutions Business"],
  ['paragraphe', "Stratégie : démontrer aux partenaires la contribution de Trivida au développement de la culture financière, à l'amélioration des habitudes d'épargne, à l'identification des besoins financiers, à l'accompagnement des futurs clients des banques et à l'inclusion financière. L'approche recherchée est d'abord le partenariat stratégique, pas nécessairement l'intégration technique immédiate."],

  ['titre_2', '17. Risques et points de vigilance'],
  ['liste_a_puces', "Bugs financiers → perte de confiance → tests et validation\nPerte de données → insatisfaction majeure → sauvegardes et sync fiable\nFaible rétention → abandon → LifeOS et engagement\nDépendance aux fournisseurs IA → indisponibilité → architecture multi-fournisseurs\nCoûts d'infrastructure → rentabilité réduite → optimisation\nFaible conversion → revenus insuffisants → amélioration de l'offre Premium\nSécurité insuffisante → exposition des données → audit et contrôle d'accès\nManque de coordination → retards → gestion centralisée dans Nova\nDépendance au fondateur → ralentissement → délégation et documentation"],
  ['titre_3', 'Points à vérifier avant de déclarer le produit stabilisé'],
  ['liste_numerotee', "Synchronisation bidirectionnelle\nRésolution des conflits de synchronisation\nApplication effective des limites Freemium\nActivation des paiements et parcours d'abonnement\nExpiration du mode invité\nMigration des données invitées\nFonctionnement réel de l'OCR\nTests des moteurs financiers\nProtection des données personnelles\nSauvegardes et restauration"],
  ['encadre', "Deux décisions à revalider : (1) SenePay et les abonnements payants ont été retirés pour respecter le positionnement de distribution sur Google Play → le paiement est un sujet à revalider, pas une fonctionnalité commerciale confirmée. (2) Le document technique de juillet 2026 présente certains modules comme complets alors que l'audit détaillé les classe partiels → en cas de contradiction, utiliser l'audit détaillé comme référence historique puis confronter au code et à la production actuels.", '⚠️'],

  ['titre_2', '18. Identifiants et informations techniques de référence'],
  ['liste_a_puces', "Nom du projet — Trivida\nÉditeur — CyberFusion Group\nFondateur — Christ Gottlib MAYALA\nApplication mobile — trivida-v2\nBackend — dryApi\nFramework mobile — React Native / Expo\nPackage Android de référence — com.christ_mayala.trivida\nDevise — XAF\nLangue principale — Français\nCouleur principale — #006B4D\nCouleur secondaire — #005A41\nCouleur d'accentuation — #3EC29A\nSite de présentation — cyberfusion-group.vercel.app"],
  ['paragraphe', "Le projet ne dispose pas encore d'une structure juridique dédiée selon les dernières informations disponibles. Il faut distinguer la marque, le produit, le fondateur et la structure porteuse dans les documents commerciaux et administratifs."],

  ['titre_2', '19. Organisation dans Nova — architecture en 15 espaces'],
  ['liste_numerotee', "Direction générale — Vision, stratégie, objectifs, décisions\nProduct Management — Roadmap, fonctionnalités, spécifications\nDéveloppement Mobile — React Native, Expo, interfaces\nBackend & API — DRY API, MongoDB, sécurité\nTrivida Intel & IA — Moteurs financiers, intelligence artificielle\nDesign & UX/UI — Maquettes, parcours, design system\nQA & Tests — Bugs, tests, validation, qualité\nInfrastructure & DevOps — Déploiements, monitoring, sauvegardes\nMarketing & Communication — Campagnes, contenus, réseaux sociaux\nCommercial & Partenariats — Prospects, banques, collaborations\nFinance & Comptabilité — Budgets, charges, revenus\nSupport utilisateurs — Retours, demandes, incidents\nÉquipe & RH — Membres, responsabilités, disponibilité\nRéunions & Décisions — Comptes rendus et historique\nDocumentation — Documents techniques et procédures"],
  ['titre_3', 'Bases de données centrales à créer'],
  ['liste_a_puces', "Membres — collaborateurs, fonctions, accès\nTâches — travail à effectuer\nProjets — modules et chantiers\nBugs — anomalies et corrections\nRoadmap — fonctionnalités et échéances\nRéunions — comptes rendus\nDécisions — arbitrages officiels\nDocuments — cahiers des charges et documentation\nObjectifs — KPIs et résultats\nDépenses — charges du projet\nRevenus — recettes du projet\nPartenaires — organisations et contacts\nCampagnes — marketing et communication\nReleases — versions et déploiements"],
  ['titre_3', 'Vues à afficher sur le Dashboard Nova'],
  ['liste_a_puces', "Tâches ouvertes — données à connecter\nTâches en retard — données à connecter\nMembres actifs — données à connecter\nBugs critiques — données à connecter\nKanban général\nCalendrier des échéances\nRoadmap chronologique\nTâches par collaborateur\nBugs par gravité\nTableau de bord financier\nPage des décisions récentes"],

  ['titre_2', '20. Rôle de Nova — pilotage opérationnel'],
  ['paragraphe', "Nova est le système central de gestion de projet, de coordination et de suivi opérationnel de Trivida. Il travaille comme un Project Management Officer (PMO), Product Owner, assistant de direction et coordinateur technique, pour aider le fondateur et les collaborateurs à piloter Trivida de manière structurée, transparente et mesurable."],
  ['liste_a_puces', "Connaître les modules, les cinq cerveaux et l'architecture technique existante\nNe jamais considérer Trivida comme un projet à créer de zéro\nRespecter l'architecture DRY et l'approche offline-first\nVérifier le rôle et les responsabilités avant d'attribuer une tâche\nNe considérer une tâche terminée que lorsque son résultat est vérifié\nConsigner les décisions et créer les tâches issues des réunions\nDistinguer développé, à vérifier, partiel, en développement, planifié, abandonné\nSignaler retards, blocages, bugs critiques, risques et dépassements\nNe jamais inventer un montant ni présenter une fonctionnalité planifiée comme disponible"],
  ['titre_3', 'Rapports automatiques à préparer'],
  ['liste_a_puces', "Rapport quotidien — travaux terminés, en cours, blocages, priorités du jour\nRapport hebdomadaire — progression, avancement par département, tâches terminées, retards, bugs ouverts, décisions nécessaires, priorités de la semaine suivante\nRapport mensuel — bilan opérationnel, technique, commercial et financier, performance des collaborateurs, KPIs, risques, plan du mois suivant"],

  ['titre_2', '21. Recommandations de pilotage'],
  ['liste_numerotee', "Document maître Trivida — toute l'équipe comprend le produit\nMembres et responsabilités — chacun connaît son rôle\nBase de données des tâches — travail centralisé\nRoadmap — visibilité sur les développements\nGestion des bugs — meilleure qualité\nRéunions et décisions — traçabilité\nKPIs — mesure des résultats\nFinance — contrôle économique\nPartenariats — développement commercial"],
  ['citation', "Ne pas transformer Nova en simple outil de stockage documentaire. En faire le système dans lequel chaque décision devient une action, chaque action possède un responsable et chaque résultat peut être vérifié."],
  ['paragraphe', "Le document maître et le référentiel technique originaux doivent également être conservés dans la section Documentation comme sources de référence."],
];

/* ------------------------------------------------------------------ */
/* Les 15 départements (sous-pages de pilotage)                        */
/* ------------------------------------------------------------------ */
const DEPARTEMENTS = [
  ['01 · Direction générale', '🧭', 'Vision, stratégie, objectifs et décisions finales.', ['Valider la vision et les objectifs 2030', 'Tenir le registre des décisions structurantes', 'Suivre les partenariats stratégiques']],
  ['02 · Product Management', '📦', 'Roadmap, fonctionnalités et spécifications produit.', ['Maintenir la roadmap 2026–2030', 'Rédiger les spécifications des prochaines fonctionnalités', 'Prioriser le backlog avec le fondateur']],
  ['03 · Développement Mobile', '📱', 'Application React Native / Expo, interfaces et expérience.', ['Stabiliser les modules partiels', 'Corriger les dettes techniques', 'Préparer les releases Android']],
  ['04 · Backend & API', '🛠️', 'DRY API, MongoDB, sécurité et synchronisation.', ['Sécuriser les autorisations côté serveur', 'Fiabiliser la synchronisation bidirectionnelle', 'Surveiller les performances de l’API']],
  ['05 · Trivida Intel & IA', '🧠', 'Moteurs financiers déterministes et intelligence artificielle.', ['Tester les moteurs financiers indépendamment', 'Garantir que l’IA n’invente jamais un calcul', 'Étendre les simulateurs de décision']],
  ['06 · Design & UX/UI', '🎨', 'Maquettes, parcours utilisateurs et design system.', ['Uniformiser le design system', 'Compléter les empty states manquants', 'Tester les parcours clés avec des utilisateurs']],
  ['07 · QA & Tests', '🧪', 'Bugs, tests, validation et qualité.', ['Centraliser les bugs par gravité', 'Automatiser les tests critiques', 'Vérifier chaque tâche avant clôture']],
  ['08 · Infrastructure & DevOps', '🚀', 'Déploiements, monitoring, sauvegardes et disponibilité.', ['Surveiller la disponibilité et la latence', 'Vérifier les sauvegardes et la restauration', 'Documenter les procédures de déploiement']],
  ['09 · Marketing & Communication', '📣', 'Campagnes, contenus et réseaux sociaux.', ['Préparer les campagnes d’acquisition', 'Produire les contenus de lancement', 'Mesurer les résultats des campagnes']],
  ['10 · Commercial & Partenariats', '🤝', 'Prospects, banques, Mobile Money et collaborations.', ['Identifier et qualifier les partenaires', 'Suivre les prospects et opportunités', 'Préparer les dossiers de partenariat']],
  ['11 · Finance & Comptabilité', '💰', 'Budgets, charges, revenus et rentabilité.', ['Centraliser les dépenses du projet', 'Suivre MRR, ARR, ARPU et churn', 'Ne jamais inventer un montant']],
  ['12 · Support utilisateurs', '💬', 'Retours, demandes et incidents.', ['Centraliser les retours utilisateurs', 'Prioriser les incidents récurrents', 'Documenter les réponses types']],
  ['13 · Équipe & RH', '👥', 'Membres, responsabilités et disponibilité.', ['Renseigner les profils et responsabilités', 'Éviter les responsabilités non définies', 'Suivre la charge et la disponibilité']],
  ['14 · Réunions & Décisions', '🗒️', 'Comptes rendus, décisions et historique.', ['Tenir les réunions quotidiennes, hebdomadaires et mensuelles', 'Consigner les décisions', 'Créer les tâches issues des réunions']],
  ['15 · Documentation', '📚', 'Documents techniques, procédures et référentiels.', ['Conserver le document maître et le référentiel technique', 'Documenter les procédures internes', 'Maintenir la base de connaissances']],
];

async function creerSiAbsent(Model, filtre, donnees) {
  const existant = await Model.findOne(filtre).select('_id').lean();
  if (existant) return { doc: existant, cree: false };
  const doc = await Model.create({ ...donnees, ...filtre });
  return { doc, cree: true };
}

(async () => {
  await mongoose.connect(config.MONGO_URI);

  const User = getModel('Nova', 'User');
  const Workspace = getModel('Nova', 'Workspace', WorkspacesSchema);
  const Espace = getModel('Nova', 'Espace', EspacesSchema);
  const Page = getModel('Nova', 'Page', PagesSchema);
  const Bloc = getModel('Nova', 'Bloc', BlocsSchema);

  const admin = await User.findOne({ email: EMAIL_ADMIN }).select('_id name email role').lean();
  if (!admin) throw new Error(`Compte admin introuvable pour ${EMAIL_ADMIN}`);

  // 1. Workspace existant de l'admin : on n'en cree JAMAIS un second.
  const workspace = await Workspace.findOne({ createdBy: admin._id }).sort({ createdAt: 1 }).lean();
  if (!workspace) {
    throw new Error("Aucun espace de travail existant pour l'admin. Creation volontairement bloquee pour ne pas dupliquer l'espace par defaut.");
  }

  // 2. Espace d'equipe Trivida (idempotent).
  const { doc: espace, cree: espaceCree } = await creerSiAbsent(
    Espace,
    { nom: NOM_ESPACE, workspaceId: workspace._id, createdBy: admin._id },
    {
      icone: '🚀',
      description: 'Centre de pilotage stratégique et opérationnel de Trivida.',
      visibilite: 'ouvert',
      ordre: 0,
      estPrive: false,
      updatedBy: admin._id,
    }
  );

  // 3. Page maitre (idempotent).
  const { doc: pageMaitre, cree: pageCree } = await creerSiAbsent(
    Page,
    { titre: TITRE_PAGE_MAITRE, espaceId: espace._id },
    {
      icone: '🚀',
      workspaceId: workspace._id,
      section: 'equipe',
      favori: true,
      ordre: 0,
      derniereVisite: new Date(),
      updatedBy: admin._id,
    }
  );

  // 4. Blocs de la page maitre (idempotents par ordre).
  let blocsCrees = 0;
  for (let i = 0; i < BLOCS_MAITRE.length; i += 1) {
    const [type, contenu, emoji] = BLOCS_MAITRE[i];
    const existant = await Bloc.findOne({ pageId: pageMaitre._id, ordre: i }).select('_id').lean();
    if (existant) continue;
    const proprietes = {};
    if (type === 'encadre' && emoji) proprietes.emoji = emoji;
    if (type === 'a_faire') proprietes.coche = false;
    await Bloc.create({
      pageId: pageMaitre._id,
      type,
      contenu,
      proprietes,
      ordre: i,
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    blocsCrees += 1;
  }

  // 5. Sous-pages des 15 departements (idempotentes).
  let pagesCreees = 0;
  let blocsDepartements = 0;
  for (let d = 0; d < DEPARTEMENTS.length; d += 1) {
    const [titre, icone, description, actions] = DEPARTEMENTS[d];
    const { doc: sousPage, cree } = await creerSiAbsent(
      Page,
      { titre, espaceId: espace._id },
      {
        icone,
        workspaceId: workspace._id,
        parentId: pageMaitre._id,
        section: 'equipe',
        ordre: d + 1,
        updatedBy: admin._id,
      }
    );
    if (cree) pagesCreees += 1;

    // Bloc 0 : description
    const b0 = await Bloc.findOne({ pageId: sousPage._id, ordre: 0 }).select('_id').lean();
    if (!b0) {
      await Bloc.create({
        pageId: sousPage._id, type: 'paragraphe', contenu: description, ordre: 0,
        createdBy: admin._id, updatedBy: admin._id,
      });
      blocsDepartements += 1;
    }

    // Bloc 1 : titre actions
    const b1 = await Bloc.findOne({ pageId: sousPage._id, ordre: 1 }).select('_id').lean();
    if (!b1) {
      await Bloc.create({
        pageId: sousPage._id, type: 'titre_3', contenu: 'Priorités et actions', ordre: 1,
        createdBy: admin._id, updatedBy: admin._id,
      });
      blocsDepartements += 1;
    }

    // Blocs suivants : taches
    for (let a = 0; a < actions.length; a += 1) {
      const ordre = a + 2;
      const existe = await Bloc.findOne({ pageId: sousPage._id, ordre }).select('_id').lean();
      if (existe) continue;
      await Bloc.create({
        pageId: sousPage._id, type: 'a_faire', contenu: actions[a], ordre,
        proprietes: { coche: false }, createdBy: admin._id, updatedBy: admin._id,
      });
      blocsDepartements += 1;
    }
  }

  console.log('================ RESULTAT ================');
  console.log('Admin           :', admin.name, `<${admin.email}>`);
  console.log('Workspace       :', workspace.nom, `(${workspace._id})`);
  console.log('Espace Trivida  :', espace.nom, espaceCree ? '(créé)' : '(déjà présent)', `(${espace._id})`);
  console.log('Page maître     :', pageMaitre.titre, pageCree ? '(créée)' : '(déjà présente)', `(${pageMaitre._id})`);
  console.log('Blocs maître    :', blocsCrees, 'créé(s)');
  console.log('Sous-pages      :', pagesCreees, 'créée(s)');
  console.log('Blocs départem. :', blocsDepartements, 'créé(s)');
  console.log('==========================================');

  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERREUR:', e.message);
  process.exit(1);
});

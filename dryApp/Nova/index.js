const getModel = require('../../dry/core/factories/modelFactory');

const WorkspacesSchema = require('./features/workspaces/model/workspaces.schema');
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
const MembresSchema = require('./features/membres/model/membres.schema');
const VersionsSchema = require('./features/versions/model/versions.schema');
const MessagesSchema = require('./features/messages/model/messages.schema');
const { normaliserPermissions } = require('./features/membres/services/invitation.service');

/**
 * Modeles Nova, dans l'ordre d'enregistrement.
 * L'enregistrement de TOUS les modeles au demarrage est une necessite
 * fonctionnelle : Mongoose resout les `ref` de `populate` par le nom du modele
 * compile sur la connexion. Sans cela, un `populate('espaceId')` echouerait si
 * `Espace` n'a jamais ete compile.
 */
const MODELS = [
  ['Workspace', WorkspacesSchema],
  ['Espace', EspacesSchema],
  ['Page', PagesSchema],
  ['Bloc', BlocsSchema],
  ['Base', BasesSchema],
  ['Element', ElementsSchema],
  ['Commentaire', CommentairesSchema],
  ['Modele', ModelesSchema],
  ['Connexion', ConnexionsSchema],
  ['Favori', FavorisSchema],
  ['Notification', NotificationsSchema],
  ['Parametre', ParametresSchema],
  ['Publication', PublicationsSchema],
  ['RequeteIA', IaSchema],
  ['Membre', MembresSchema],
  ['Version', VersionsSchema],
  ['Message', MessagesSchema],
];

/**
 * Bootstrap Nova : compile tous les modeles sur le tenant de l'application.
 *
 * @param {string} appName - nom du tenant (ici 'Nova')
 * @returns {Promise<Object>} map { NomModele: Modele Mongoose }
 */
/**
 * Migration douce : reporte le rôle et les permissions des fiches Membre
 * existantes sur les comptes utilisateur qui n'ont pas encore de permissions
 * NOVA explicites. Évite qu'un invité antérieur conserve les droits complets.
 * Non bloquant : toute erreur est journalisée sans empêcher le démarrage.
 */
async function synchroniserMembresExistants(appName, Membre) {
  try {
    const User = getModel(appName, 'User');
    const membres = await Membre.find({ deletedAt: null })
      .select('email role permissions utilisateurId')
      .lean();

    let synchronises = 0;
    for (const membre of membres) {
      if (!membre?.email) continue;
      const utilisateur = membre.utilisateurId
        ? await User.findById(membre.utilisateurId)
        : await User.findOne({ email: String(membre.email).trim().toLowerCase() });
      if (!utilisateur || utilisateur.role === 'superadmin' || utilisateur.novaPermissions) continue;

      const role = membre.role || 'membre';
      utilisateur.role = role === 'admin' ? 'admin' : 'user';
      utilisateur.novaRole = role;
      utilisateur.novaPermissions = normaliserPermissions(role, membre.permissions);
      await utilisateur.save();
      synchronises += 1;
    }

    if (synchronises > 0) {
      console.log(`   ✅ Permissions NOVA synchronisées pour ${synchronises} compte(s) membre(s)`);
    }
  } catch (e) {
    console.warn(`   ⚠️  Synchronisation des permissions NOVA impossible: ${e.message}`);
  }
}

const bootstrap = async (appName) => {
  const models = {};
  for (const [modelName, schema] of MODELS) {
    models[modelName] = getModel(appName, modelName, schema);
  }
  await synchroniserMembresExistants(appName, models.Membre);
  return models;
};

module.exports = { bootstrap };

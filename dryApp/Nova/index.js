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
 * Bootstrap Nova : compile tous les modèles sur le tenant de l'application.
 * Les droits étant désormais stockés dans les fiches `Membre` (une par
 * workspace), aucune synchronisation vers le compte global n'est effectuée :
 * le rôle DRY reste intact et les anciens champs nova* ne sont pas réécrits.
 *
 * @param {string} appName - nom du tenant (ici 'Nova')
 * @returns {Promise<Object>} map { NomModele: Modele Mongoose }
 */
const bootstrap = async (appName) => {
  const models = {};
  for (const [modelName, schema] of MODELS) {
    models[modelName] = getModel(appName, modelName, schema);
  }
  return models;
};

module.exports = { bootstrap };

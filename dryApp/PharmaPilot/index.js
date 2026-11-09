const getModel = require('../../dry/core/factories/modelFactory');

const OrganizationsSchema = require('./features/organizations/model/organizations.schema');
const PharmaciesSchema = require('./features/pharmacies/model/pharmacies.schema');
const CategoriesSchema = require('./features/categories/model/categories.schema');
const ProductsSchema = require('./features/products/model/products.schema');
const SuppliersSchema = require('./features/suppliers/model/suppliers.schema');
const LotsSchema = require('./features/lots/model/lots.schema');
const ReceiptsSchema = require('./features/receipts/model/receipts.schema');
const StockMovementsSchema = require('./features/movements/model/stockMovements.schema');
const StockBalancesSchema = require('./features/movements/model/stockBalances.schema');
const InventoriesSchema = require('./features/inventories/model/inventories.schema');
const AlertsSchema = require('./features/alerts/model/alerts.schema');
const PharmaPilotUserSchema = require('./features/auth/model/pharmaPilotUser.schema');

/**
 * Modeles PharmaPilot, dans l'ordre d'enregistrement.
 * `User` est enregistre en premier : le plugin DRY en a besoin pour le populate.
 */
const MODELS = [
  ['User', PharmaPilotUserSchema],
  ['Organization', OrganizationsSchema],
  ['Pharmacy', PharmaciesSchema],
  ['Category', CategoriesSchema],
  ['Product', ProductsSchema],
  ['Supplier', SuppliersSchema],
  ['Lot', LotsSchema],
  ['Receipt', ReceiptsSchema],
  ['StockMovement', StockMovementsSchema],
  ['StockBalance', StockBalancesSchema],
  ['Inventory', InventoriesSchema],
  ['Alert', AlertsSchema],
];

/**
 * Bootstrap PharmaPilot.
 *
 * Enregistre TOUS les modeles de l'application avant toute requete. C'est une
 * necessite fonctionnelle, pas une optimisation : Mongoose resout les `ref` de
 * `populate` par le NOM du modele enregistre sur la connexion. Si, par
 * exemple, `Category` n'a jamais ete compile (aucune requete sur /categories),
 * alors un `populate('categoryId')` echoue avec `MissingSchemaError` — ce qui
 * casse l'ouverture d'un inventaire ou la lecture d'un mouvement. Enregistrer
 * l'ensemble des modeles des le demarrage rend au contraire chaque populate
 * fiable, quel que soit l'ordre d'arrivee des requetes.
 *
 * Les modeles sont enregistres sur le tenant de l'application (getModel) : le
 * schema `User` applicatif (roles pharmacie + rattachement multi-pharmacie)
 * reste donc bien celui utilise par `protect` et les routes natives.
 *
 * @param {string} appName - nom du tenant (ici 'PharmaPilot')
 */
const bootstrap = async (appName) => {
  const models = {};
  for (const [modelName, schema] of MODELS) {
    models[modelName] = getModel(appName, modelName, schema);
  }
  return models;
};

module.exports = { bootstrap };

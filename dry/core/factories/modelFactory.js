// Mise à jour chemin dbConnection
const { getTenantDB } = require('../../config/connection/dbConnection');
const dryPlugin = require('../plugins/mongoose.plugin');

// Mise à jour chemin user.schema (modules/user)
const UserSchema = require('../../modules/user/user.schema'); 

/**
 * Récupère ou compile un modèle Mongoose pour un tenant spécifique (application).
 * Applique automatiquement le plugin DRY global.
 * 
 * @param {string} appName - Le nom de l'application (tenant), ex: 'LaStreet'.
 * @param {string} modelName - Le nom du modèle, ex: 'User', 'Product'.
 * @param {import('mongoose').Schema} [schema=null] - Le schéma Mongoose à utiliser si le modèle n'est pas encore compilé.
 *                                                    Requis lors du premier appel pour un modèle donné.
 * @returns {import('mongoose').Model} Le modèle Mongoose compilé et prêt à l'emploi.
 * @throws {Error} Si le schéma est manquant lors de la première compilation.
 */
const getModel = (appName, modelName, schema = null) => {
    const db = getTenantDB(appName);
    
    // [FIX] S'assurer que le modèle 'User' est enregistré car le plugin DRY en a besoin pour le populate
    if (modelName !== 'User' && !db.models.User) {
        getModel(appName, 'User');
    }

    if (db.models[modelName]) {
        return db.models[modelName];
    }

    if (modelName === 'User' && !schema) {
        // [FIX] Cloner le schéma pour éviter la duplication des plugins sur l'instance partagée
        schema = UserSchema.clone();
    } else if (schema) {
        // [FIX] Cloner le schéma pour l'isolation entre tenants
        schema = schema.clone();
    }

    if (!schema) {
        throw new Error(`Schema manquant pour le modèle ${modelName} dans l'app ${appName}`);
    }

    schema.plugin(dryPlugin);

    return db.model(modelName, schema);
};

module.exports = getModel;

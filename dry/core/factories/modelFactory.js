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
        // Ensure UserSchema is a proper Mongoose Schema instance before cloning
        if (typeof UserSchema.clone !== 'function') {
            // If it's not, re-create it from its definition to ensure .clone() is available
            const mongoose = require('mongoose');
            const UserSchemaDefinition = require('../../modules/user/user.schema').obj;
            schema = new mongoose.Schema(UserSchemaDefinition, UserSchema.options);
        } else {
            schema = UserSchema.clone();
        }
    } else if (schema) {
        if (typeof schema.clone === 'function') {
            schema = schema.clone();
        } else if (schema.schema && typeof schema.schema.clone === 'function') {
            // Cas où on a passé un modèle au lieu d'un schéma
            schema = schema.schema.clone();
        } else {
            throw new Error(`Le paramètre schema fourni pour le modèle ${modelName} n'est pas un schéma Mongoose valide (.clone() manquant).`);
        }
    }

    if (!schema) {
        throw new Error(`Schema manquant pour le modèle ${modelName} dans l'app ${appName}`);
    }

    schema.plugin(dryPlugin);

    return db.model(modelName, schema);
};

module.exports = getModel;

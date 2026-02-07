// Mise à jour chemin dbConnection
const { getTenantDB } = require('../../config/connection/dbConnection');
const dryPlugin = require('../plugins/mongoose.plugin');

// Mise à jour chemin user.schema (modules/user)
const UserSchema = require('../../modules/user/user.schema'); 

const getModel = (appName, modelName, schema = null) => {
    const db = getTenantDB(appName);
    
    if (db.models[modelName]) {
        return db.models[modelName];
    }

    if (modelName === 'User' && !schema) {
        schema = UserSchema;
    }

    if (!schema) {
        throw new Error(`Schema manquant pour le modèle ${modelName} dans l'app ${appName}`);
    }

    schema.plugin(dryPlugin);

    return db.model(modelName, schema);
};

module.exports = getModel;

const mongoose = require('mongoose');
const config = require('../../../config/database');

// Cache des connexions pour ne pas les réouvrir à chaque requête
const connections = {};

/**
 * Initialise la connexion globale au Cluster
 */
const connectCluster = async () => {
    try {
        const conn = await mongoose.connect(config.MONGO_URI);
        console.log(`\x1b[32m[CLUSTER] ✅ Connecté au Cluster MongoDB Atlas\x1b[0m`);
        return conn;
    } catch (error) {
        console.error(`\x1b[31m[CLUSTER] ❌ Erreur de connexion : ${error.message}\x1b[0m`);
        process.exit(1);
    }
};

/**
 * Récupère ou crée une connexion spécifique à une Application (Base de données dédiée)
 * ex: getTenantDB('Voyage') -> connectera à la BD 'VoyageDB'
 */
const getTenantDB = (appName) => {
    if (connections[appName]) {
        return connections[appName];
    }

    // On utilise 'useDb' pour basculer sur une autre base sans refaire de connexion TCP
    const dbName = `${appName}DB`; // ex: VoyageDB
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    
    // On stocke la connexion
    connections[appName] = db;
    // Log désactivé pour éviter le doublon avec le bootloader
    // console.log(`[MULTI-TENANT] 🗄️  Base de données active : ${dbName}`);
    
    return db;
};

module.exports = { connectCluster, getTenantDB };

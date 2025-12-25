const mongoose = require('mongoose');

// Cache des connexions pour ne pas les réouvrir à chaque requête
const connections = {};

/**
 * Initialise la connexion globale au Cluster
 */
const connectCluster = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`[CLUSTER] ✅ Connecté à Atlas`);
        return conn;
    } catch (error) {
        console.error(`[CLUSTER] ❌ Erreur : ${error.message}`);
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
    console.log(`[MULTI-TENANT] 🗄️  Base de données active : ${dbName}`);
    
    return db;
};

module.exports = { connectCluster, getTenantDB };
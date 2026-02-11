const mongoose = require('mongoose');
const config = require('../../../config/database');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.MONGO_URI);
        console.log(`[DB] MongoDB Connecté : ${conn.connection.host}`);
    } catch (error) {
        console.error(`[DB] Erreur de connexion : ${error.message}`);
        process.exit(1);
    }
};
module.exports = connectDB;
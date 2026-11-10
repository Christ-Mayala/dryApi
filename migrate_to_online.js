// Migration script: migrate user mayalachristgottlieb@gmail.com to admin in online Nova tenant
// Run: cd D:\Alvine\dryApi && node migrate_to_online.js
// Assurez-vous que .env a: MONGO_URI=mongodb+srv://cerver-gold-dry:CmhhHeUa8DJB8x1n@dryglobal.nygs81u.mongodb.net

require('dotenv').config();
const getModel = require('./dry/core/factories/modelFactory');
const mongoose = require('mongoose');

// URI en ligne depuis .env ou fournie
const ONLINE_URI = process.env.MONGO_URI || 'mongodb+srv://cerver-gold-dry:CmhhHeUa8DJB8x1n@dryglobal.nygs81u.mongodb.net';

// Connect online
mongoose.connect(ONLINE_URI)
  .then(() => {
    console.log('✅ Connecté à la base en ligne');
    return startMigration();
  })
  .catch(err => {
    console.error('❌ Erreur connexion en ligne:', err.message);
    process.exit(1);
  });

async function startMigration() {
  try {
    // Récupérer les modèles pour le tenant Nova (via le modèleFactory qui gère le tenant)
    const User = getModel('Nova', 'User');

    console.log('\\n--- 1. Vérification/utilisateur cible ---');
    const targetEmail = 'mayalachristgottlieb@gmail.com';
    let user = await User.findOne({ email: targetEmail });

    if (!user) {
      console.log(`⚠️ Utilisateur ${targetEmail} introuvable en ligne. Création...`);
      // Essayer de trouver en local d'abord
      const localUri = 'mongodb://127.0.0.1:27017/dryapi';
      const mongooseLocal = require('mongoose');
      await mongooseLocal.connect(localUri);
      
      // On utilise le modèle du tenant local "Nova" ou par défaut
      const { getTenantDB } = require('./dry/config/connection/dbConnection');
      await getTenantDB('Nova'); // Ensure Nova model is registered
      
      // Simple schema-less find pour local
      const localUser = await mongoose.model('User', new mongoose.Schema({}, { strict: false })).findOne({ email: targetEmail });
      
      if (localUser) {
        console.log('📦 Utilisateur trouvé en local, migration vers en ligne...');
        await mongoose.disconnect();
        // Reconnect online and create
        await mongoose.connect(ONLINE_URI);
        user = await User.create({
          email: localUser.email,
          name: localUser.name,
          role: 'admin',  // Le promouvoir admin directement
          novaRole: 'admin',
        });
        console.log('✅ Utilisateur créé/en ligne avec role=admin');
      } else {
        console.log('❌ Utilisateur introuvable en local non plus.');
        console.log('ℹ️ Création manuelle requise : ajoutez mayalachristgottlieb@gmail.com via l\'admin interface ou API');
        process.exit(1);
      }
    } else {
      console.log('✅ Utilisateur trouvé en ligne, promotion en admin...');
      await User.updateOne({ email: targetEmail }, { 
        role: 'admin',
        novaRole: 'admin' 
      });
      console.log('✅ Role promu à admin');
    }

    console.log('\\n--- 2. Vérification finale ---');
    const finalUser = await User.findOne({ email: targetEmail }).select('email name role novaRole');
    console.log('Utilisateur final:', finalUser.email, 'Role:', finalUser.role, 'novaRole:', finalUser.novaRole);
    
    console.log('\\n🎉 Migration terminée avec succès !');
    console.log('   - Utilisateur', targetEmail, 'est admin sur le tenant Nova');
    mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Erreur lors de la migration:', err);
    mongoose.disconnect();
    process.exit(1);
  }
}
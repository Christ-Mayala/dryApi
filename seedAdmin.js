require('dotenv').config();

const { connectCluster } = require('./dry/config/connection/dbConnection');
const getModel = require('./dry/core/modelFactory');

async function seedAdmin() {
  try {
    if (!process.env.APP_NAME) {
      throw new Error('APP_NAME manquant dans le .env');
    }

    const appName = process.env.APP_NAME;
    await connectCluster();

    // Modèle User multi-tenant (schema User géré automatiquement par modelFactory)
    const User = getModel(appName, 'User');

    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@admin.com';
    const adminName = process.env.SEED_ADMIN_NAME || 'Spirit Emeraude';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@2026';

    const existing = await User.findOne({ email: adminEmail }).lean();
    if (existing) {
      console.log(`❎ Admin déjà présent pour ${appName} avec l'email ${adminEmail}`);
      process.exit(0);
    }

    const admin = new User({
      name: adminName,
      email: adminEmail,
      password: adminPassword, // sera hashé par le pre('save') du schema
      role: 'admin',
      status: 'active',
    });

    await admin.save();

    console.log('✅ Admin créé avec succès:');
    console.log(`   App       : ${appName}`);
    console.log(`   Email     : ${adminEmail}`);
    console.log(`   Mot de passe (clair) : ${adminPassword}`);
    console.log('   Pense à changer le mot de passe en production.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors du seed admin:', err.message);
    process.exit(1);
  }
}

seedAdmin();

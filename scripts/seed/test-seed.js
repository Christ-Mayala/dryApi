#!/usr/bin/env node

/**
 * Test du seed SCIM avec MongoDB en mémoire
 * Exécute : node scripts/seed/test-seed.js
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const log = (msg) => console.log(`[test-seed] ${msg}`);
const ok = (msg) => console.log(`\x1b[32m  ✓ ${msg}\x1b[0m`);
const fail = (msg) => console.log(`\x1b[31m  ✗ ${msg}\x1b[0m`);

const run = async () => {
  // ── 1. Démarrer MongoDB en mémoire ──
  log('Démarrage de MongoDB en mémoire...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  log(`URI : ${uri}`);

  // Configurer MONGO_URI pour le framework DRY
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_seed_jwt_secret_key_32chars';
  process.env.SESSION_SECRET = 'test_seed_session_secret_key_32chars';
  process.env.REDIS_ENABLED = 'false';
  process.env.LOG_REQUESTS = 'false';
  process.env.EMAIL_PROVIDER = 'mock';

  // ── 2. Connexion ──
  log('Connexion à MongoDB...');
  await mongoose.connect(uri);
  log('Connecté !');

  // ── 3. Charger les schémas manuellement pour le tenant test ──
  const { getTenantDB } = require('../../dry/config/connection/dbConnection');
  const getModel = require('../../dry/core/factories/modelFactory');

  const appName = 'SCIM';
  const db = getTenantDB(appName);

  // Pré-enregistrer les schémas pour éviter les erreurs du plugin DRY
  const UserSchema = require('../../dry/modules/user/user.schema');
  const PropertySchema = require('../../dryApp/SCIM/features/property/model/property.schema');
  const ReservationSchema = require('../../dryApp/SCIM/features/reservation/model/reservation.schema');
  const MessageSchema = require('../../dryApp/SCIM/features/message/model/message.schema');
  const SystemSettingsSchema = require('../../dryApp/SCIM/features/admin/model/systemSettings.schema');

  // ── 4. Exécuter le seed ──
  log('\nExécution du seed SCIM...');
  const seedFn = require('../../dryApp/SCIM/seed');
  const logSeed = async () => {}; // Logger silencieux pour le test
  const result = await seedFn({ appName, getModel, logSeed });
  log(`Seed terminé — ${result.count} documents insérés\n`);

  // ── 5. Vérifier les documents ──
  log('═══════════════════════════════════════════════════');
  log('  VÉRIFICATION DES DONNÉES');
  log('═══════════════════════════════════════════════════');

  let errors = 0;

  // Utilisateurs
  const User = getModel(appName, 'User');
  const users = await User.find({});
  if (users.length === 5) {
    ok(`Utilisateurs : ${users.length}/5`);
    const admin = users.find(u => u.role === 'admin');
    if (admin) ok(`  Admin trouvé : ${admin.name} (${admin.email})`);
    else { fail('Admin non trouvé'); errors++; }
    const clientCount = users.filter(u => u.role === 'user').length;
    if (clientCount === 4) ok(`  Clients/Propriétaires : ${clientCount}`);
    else { fail(`Clients attendus: 4, trouvés: ${clientCount}`); errors++; }
  } else { fail(`Utilisateurs : ${users.length}/5`); errors++; }

  // Biens
  const PropertySchema2 = require('../../dryApp/SCIM/features/property/model/property.schema');
  const Property = getModel(appName, 'Property', PropertySchema2);
  const properties = await Property.find({});
  if (properties.length === 100) {
    ok(`Biens : ${properties.length}/100`);
    const cats = {};
    properties.forEach(p => { cats[p.categorie] = (cats[p.categorie] || 0) + 1; });
    for (const [cat, count] of Object.entries(cats)) {
      ok(`  ${cat} : ${count}`);
    }
    // Vérifier images
    const withImages = properties.filter(p => p.images && p.images.length > 0);
    ok(`  Avec images : ${withImages.length}/100`);
    // Vérifier favoris
    const withFavs = properties.filter(p => p.favoris && p.favoris.length > 0);
    ok(`  Avec favoris : ${withFavs.length}`);
  } else { fail(`Biens : ${properties.length}/100`); errors++; }

  // Réservations
  const Reservation = getModel(appName, 'Reservation', ReservationSchema);
  const reservations = await Reservation.find({});
  if (reservations.length === 8) {
    ok(`Réservations : ${reservations.length}/8`);
    const statuses = {};
    reservations.forEach(r => { statuses[r.status] = (statuses[r.status] || 0) + 1; });
    for (const [status, count] of Object.entries(statuses)) {
      ok(`  ${status} : ${count}`);
    }
    const withRefs = reservations.filter(r => r.reference);
    ok(`  Avec référence : ${withRefs.length}/8`);
    const withHistory = reservations.filter(r => r.statusHistory && r.statusHistory.length > 0);
    ok(`  Avec statusHistory : ${withHistory.length}/8`);
  } else { fail(`Réservations : ${reservations.length}/8`); errors++; }

  // Messages
  const Message = getModel(appName, 'Message', MessageSchema);
  const messages = await Message.find({});
  if (messages.length === 17) {
    ok(`Messages : ${messages.length}/17`);
    const withSujet = messages.filter(m => m.sujet);
    ok(`  Avec sujet : ${withSujet.length}/17`);
    const convos = messages.filter(m => m.contenu && m.contenu.length > 50);
    ok(`  Messages longs (>50 car.) : ${convos.length}`);
  } else { fail(`Messages : ${messages.length}/17`); errors++; }

  // Favoris
  const favsCount = properties.reduce((sum, p) => sum + (p.favoris ? p.favoris.length : 0), 0);
  if (favsCount === 5) {
    ok(`Favoris : ${favsCount}/5`);
  } else { fail(`Favoris : ${favsCount}/5`); errors++; }

  // Settings
  const SystemSettings = getModel(appName, 'SystemSettings', SystemSettingsSchema);
  const settings = await SystemSettings.find({});
  if (settings.length === 6) {
    ok(`Settings : ${settings.length}/6`);
    const currency = settings.find(s => s.key === 'currency');
    if (currency && currency.value === 'XAF') ok('  Devise XAF OK');
    else { fail('Devise XAF non trouvée'); errors++; }
  } else { fail(`Settings : ${settings.length}/6`); errors++; }

  // ── 6. Résumé ──
  log('\n═══════════════════════════════════════════════════');
  if (errors === 0) {
    console.log('\x1b[32m');
    log('🎉 TOUS LES TESTS DE SEED ONT RÉUSSI !');
    console.log('\x1b[0m');
  } else {
    console.log(`\x1b[31m`);
    log(`❌ ${errors} erreur(s) détectée(s)`);
    console.log('\x1b[0m');
  }
  log('═══════════════════════════════════════════════════\n');

  // ── 7. Nettoyage ──
  await mongoose.disconnect();
  await mongod.stop();
  log('MongoDB en mémoire arrêté.');

  process.exit(errors > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('\x1b[31m[ERREUR FATALE]\x1b[0m', err);
  process.exit(1);
});

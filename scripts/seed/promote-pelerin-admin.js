#!/usr/bin/env node

/**
 * Promeut un utilisateur Pelerin existant au role 'admin', par email.
 * Additif et cible uniquement : ne touche qu'un seul document (le seul champ
 * `role`), jamais de deleteMany/insertMany, jamais d'autre tenant que Pelerin.
 * Sert a amorcer le tout premier admin (aucune UI ne peut le faire tant que
 * personne n'a le role admin).
 *
 * Usage : node scripts/seed/promote-pelerin-admin.js quelqu'un@exemple.com
 */

require('dotenv').config();

require('dns').setServers(['1.1.1.1', '8.8.8.8']);

const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const log = (msg) => console.log(`[promote-pelerin-admin] ${msg}`);

const run = async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    log('Usage : node scripts/seed/promote-pelerin-admin.js email@exemple.com');
    process.exit(1);
  }

  await connectCluster();
  getTenantDB('Pelerin');
  log('PelerinDB connectee.');

  const User = getModel('Pelerin', 'User');
  const user = await User.findOne({ email });

  if (!user) {
    log(`Aucun utilisateur Pelerin avec l'email "${email}". Il doit d'abord creer un compte via l'app.`);
    process.exit(1);
  }

  if (user.role === 'admin') {
    log(`"${email}" est deja admin. Rien a faire.`);
    process.exit(0);
  }

  user.role = 'admin';
  await user.save();
  log(`"${email}" est maintenant admin.`);
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    log(`Erreur: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });

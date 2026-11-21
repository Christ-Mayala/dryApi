/**
 * Migration 004 — chiffrement au repos des secrets de connexions NOVA.
 *
 * Les nouvelles écritures passent déjà par les hooks du schéma
 * (`connexions.schema.js`). Cette migration ne concerne que les configurations
 * historiques stockées en clair. Elle est NON DESTRUCTIVE : seules les valeurs
 * sensibles sont remplacées par leur version chiffrée AES-256-GCM ; les autres
 * champs restent intacts. Aucune donnée n'est supprimée.
 *
 * PRÉREQUIS : `NOVA_CONNECTION_ENCRYPTION_KEY` (base64, 32 octets) doit être
 * définie. Sans clé, la migration échoue explicitement (fail-closed).
 *
 * NON EXÉCUTÉE AUTOMATIQUEMENT sur une base réelle sans autorisation :
 *   $env:NOVA_MIGRATION_DRY_RUN='1'; npm run migrate:up   # simulation
 *   npm run migrate:up                                   # après validation
 */

'use strict';

const { chiffrerConfig, dechiffrerConfig } = require('../dryApp/Nova/services/crypto.service');

const NOMS_BASES = ['NovaDB'];
const COLLECTION = 'connexions';

function basesCandidates(client) {
  return new Set([client.db().databaseName, ...NOMS_BASES]);
}

async function migrer(db, simulation, sens) {
  const collection = db.collection(COLLECTION);
  const curseur = collection.find({ config: { $exists: true, $ne: null } });
  let examinees = 0;
  let modifiees = 0;

  while (await curseur.hasNext()) {
    const doc = await curseur.next();
    examinees += 1;
    const avant = JSON.stringify(doc.config || {});
    const configMigree =
      sens === 'chiffrer' ? chiffrerConfig(doc.config) : dechiffrerConfig(doc.config);
    const apres = JSON.stringify(configMigree || {});
    if (avant === apres) continue;
    modifiees += 1;
    if (!simulation) {
      await collection.updateOne({ _id: doc._id }, { $set: { config: configMigree } });
    }
  }

  console.log(
    `[Migration 004] ${simulation ? 'Simulation' : 'Traitement'} ${db.databaseName} : ` +
      `${examinees} connexion(s) examinée(s), ${modifiees} à ${sens === 'chiffrer' ? 'chiffrer' : 'déchiffrer'}.`
  );
  return modifiees;
}

const up = async (client) => {
  const simulation = process.env.NOVA_MIGRATION_DRY_RUN === '1';
  let total = 0;
  for (const nom of basesCandidates(client)) {
    total += await migrer(client.db(nom), simulation, 'chiffrer');
  }
  console.log(`[Migration 004] Total : ${total} configuration(s) concernée(s)`);
};

const down = async (client) => {
  const simulation = process.env.NOVA_MIGRATION_DRY_RUN === '1';
  let total = 0;
  for (const nom of basesCandidates(client)) {
    total += await migrer(client.db(nom), simulation, 'dechiffrer');
  }
  console.log(`[Migration 004] Retour arrière : ${total} configuration(s) concernée(s)`);
};

module.exports = { up, down };

/**
 * Migration 006 — retrait de l'index e-mail global sur NOVA `membres`.
 *
 * Le modèle workspace-scoped autorise un même compte à appartenir à plusieurs
 * espaces de travail. Un ancien index unique `email_1` (une seule fiche par
 * adresse, tous workspaces confondus) empêche la création de la deuxième
 * appartenance : le `afterCreate` de `/workspaces` échoue en E11000, le
 * workspace est créé sans propriétaire et devient invisible dans la liste.
 *
 * Cette migration est NON DESTRUCTIVE (aucun document modifié) et idempotente :
 *   1. supprime uniquement l'index `email_1` obsolète ;
 *   2. (re)crée les index composites attendus par le runtime.
 *
 * NON EXÉCUTÉE AUTOMATIQUEMENT — autorisation explicite requise :
 *   $env:NOVA_MIGRATION_DRY_RUN='1'; npm run migrate:up   # simulation
 *   npm run migrate:up                                   # après validation
 */

'use strict';

const NOMS_BASES = ['NovaDB'];

function basesCandidates(client) {
  return new Set([client.db().databaseName, ...NOMS_BASES]);
}

async function migrer(db, simulation) {
  // `listIndexes` renvoie NamespaceNotFound sur une base sans collection
  // `membres` (par exemple la base DRY `dryapi`). Ces bases sont ignorées :
  // seul le périmètre NOVA doit être traité.
  const collections = await db.listCollections({ name: 'membres' }).toArray();
  if (!collections.length) {
    console.log(`[Migration 006] ${db.databaseName} : collection membres absente, ignorée.`);
    return 0;
  }
  const Membres = db.collection('membres');
  const indexes = await Membres.indexes();
  const indexGlobal = indexes.find(
    (index) =>
      index.name === 'email_1' && Object.keys(index.key || {}).length === 1 && index.key.email === 1
  );

  if (indexGlobal && !simulation) {
    await Membres.dropIndex('email_1');
  }

  if (!simulation) {
    await Membres.createIndex({ workspaceId: 1, email: 1 }, { unique: true });
    await Membres.createIndex({ workspaceId: 1, utilisateurId: 1 });
    await Membres.createIndex({ workspaceId: 1, role: 1 });
  }

  console.log(
    `[Migration 006] ${simulation ? 'Simulation' : 'Traitement'} ${db.databaseName} : ` +
      `${indexGlobal ? 'index email_1 supprimé' : 'index email_1 déjà absent'}. ` +
      `Aucun document modifié.`
  );
  return indexGlobal ? 1 : 0;
}

const up = async (client) => {
  const simulation = process.env.NOVA_MIGRATION_DRY_RUN === '1';
  let total = 0;
  for (const nom of basesCandidates(client)) {
    total += await migrer(client.db(nom), simulation);
  }
  console.log(`[Migration 006] Total : ${total} index(e) obsolète(s) concerné(s)`);
};

const down = async () => {
  console.log(
    '[Migration 006] Aucun rollback automatique : l’index unique global `email_1` ' +
      'ne doit pas être restauré (il empêche les appartenances multiples).'
  );
};

module.exports = { up, down };

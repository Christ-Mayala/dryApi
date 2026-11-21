/**
 * Migration 005 — appartenances NOVA par espace de travail.
 *
 * Le nouveau modèle stocke les droits dans `members` (une fiche par workspace
 * et par compte). Cette migration est NON DESTRUCTIVE et idempotente :
 *   1. crée la fiche « propriétaire » manquante pour chaque workspace dont le
 *      `createdBy` existe encore ;
 *   2. conforme les appartenances héritées : les anciens rôles globaux sont
 *      traduits en rôle local dans le workspace que le compte a créé ;
 *   3. renseigne `pages.workspaceId` à partir de l'espace d'équipe (ou du
 *      workspace créé par l'auteur) ;
 *   4. retire `espaceId` des pages privées (invariant « privé = aucun espace ») ;
 *   5. crée les index uniques composites sur `members`.
 *
 * Les anciens champs `novaRole`/`novaPermissions`/`novaEspaceIds` des comptes
 * ne sont PAS supprimés : ils restent disponibles pour un rollback manuel et
 * sont ignorés par le runtime.
 *
 * NON EXÉCUTÉE AUTOMATIQUEMENT — autorisation explicite requise :
 *   $env:NOVA_MIGRATION_DRY_RUN='1'; npm run migrate:up   # simulation
 *   npm run migrate:up                                   # après validation
 */

'use strict';

const NOMS_BASES = ['NovaDB'];

const DROITS_PROPRIETAIRE = {
  lecture: true,
  edition: true,
  commentaire: true,
  partage: true,
  admin: true,
};
const DROITS_INVITE = {
  lecture: true,
  edition: false,
  commentaire: false,
  partage: false,
  admin: false,
};

function basesCandidates(client) {
  return new Set([client.db().databaseName, ...NOMS_BASES]);
}

const asId = (valeur) => {
  if (!valeur) return null;
  if (typeof valeur === 'object') return valeur._id || null;
  return valeur;
};

function rolesHistoriques(config) {
  const role = String(config?.novaRole || '').toLowerCase();
  if (['proprietaire', 'admin', 'membre', 'invite'].includes(role)) return role;
  const permissions = config?.novaPermissions || {};
  if (permissions.admin) return 'admin';
  if (permissions.edition) return 'membre';
  return 'invite';
}

async function migrer(db, simulation) {
  const Workspaces = db.collection('workspaces');
  const Membres = db.collection('membres');
  const Users = db.collection('users');
  const Espaces = db.collection('espaces');
  const Pages = db.collection('pages');

  const comptes = new Map();
  for await (const utilisateur of Users.find({})) {
    comptes.set(String(utilisateur._id), utilisateur);
  }

  let proprietairesCrees = 0;
  let appartenancesMigrees = 0;

  // 1 & 2 — une fiche propriétaire par workspace, puis traduction des rôles
  // historiques du compte dans LE workspace qu'il a créé.
  for await (const workspace of Workspaces.find({ deletedAt: null })) {
    const createurId = asId(workspace.createdBy);
    if (!createurId) continue;
    const createur = comptes.get(String(createurId));
    if (!createur) continue;

    const existant = await Membres.findOne({
      workspaceId: workspace._id,
      utilisateurId: createur._id,
    });
    const email = String(createur.email || '')
      .trim()
      .toLowerCase();
    if (!email) continue;

    if (!existant) {
      const role = rolesHistoriques(createur);
      const document = {
        workspaceId: workspace._id,
        email,
        nom: createur.nom || createur.name,
        role,
        permissions: role === 'invite' ? DROITS_INVITE : DROITS_PROPRIETAIRE,
        utilisateurId: createur._id,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
        deletedAt: null,
      };
      if (!simulation) await Membres.insertOne(document);
      proprietairesCrees += 1;
    } else if (existant.role !== 'proprietaire' && !simulation) {
      // Le créateur du workspace en reste le propriétaire : on ne rétrograde
      // jamais un compte qui possède déjà son propre espace.
      await Membres.updateOne(
        { _id: existant._id },
        { $set: { role: 'proprietaire', permissions: DROITS_PROPRIETAIRE } }
      );
      appartenancesMigrees += 1;
    }
  }

  // 3 & 4 — cohérence des pages : workspace dérivé de l'espace ou de l'auteur,
  // et aucun espace pour le contenu privé.
  const espaces = new Map();
  for await (const espace of Espaces.find({})) {
    espaces.set(String(espace._id), asId(espace.workspaceId));
  }
  const workspaceParCreateur = new Map();
  for await (const workspace of Workspaces.find({ deletedAt: null })) {
    const createurId = asId(workspace.createdBy);
    if (createurId && !workspaceParCreateur.has(String(createurId))) {
      workspaceParCreateur.set(String(createurId), workspace._id);
    }
  }

  let pagesWorkspace = 0;
  let pagesPrivees = 0;
  for await (const page of Pages.find({})) {
    const set = {};
    const workspaceId =
      asId(page.workspaceId) ||
      espaces.get(String(asId(page.espaceId))) ||
      workspaceParCreateur.get(String(asId(page.createdBy)));
    if (!page.workspaceId && workspaceId) {
      set.workspaceId = workspaceId;
      pagesWorkspace += 1;
    }
    if (page.section === 'prive' && page.espaceId) {
      set.espaceId = null;
      pagesPrivees += 1;
    }
    if (Object.keys(set).length && !simulation) {
      await Pages.updateOne({ _id: page._id }, { $set: set });
    }
  }

  if (!simulation) {
    await Membres.createIndex({ workspaceId: 1, email: 1 }, { unique: true });
    await Membres.createIndex({ workspaceId: 1, utilisateurId: 1 });
    await Membres.createIndex({ workspaceId: 1, role: 1 });
  }

  console.log(
    `[Migration 005] ${simulation ? 'Simulation' : 'Traitement'} ${db.databaseName} : ` +
      `${proprietairesCrees} propriétaire(s) créé(s), ${appartenancesMigrees} appartenance(s) conforme(s), ` +
      `${pagesWorkspace} page(s) rattachée(s) à un workspace, ${pagesPrivees} page(s) privée(s) désaffiliée(s).`
  );
  return proprietairesCrees + appartenancesMigrees + pagesWorkspace + pagesPrivees;
}

const up = async (client) => {
  const simulation = process.env.NOVA_MIGRATION_DRY_RUN === '1';
  let total = 0;
  for (const nom of basesCandidates(client)) {
    total += await migrer(client.db(nom), simulation);
  }
  console.log(`[Migration 005] Total : ${total} document(s) concerné(s)`);
};

const down = async () => {
  console.log(
    '[Migration 005] Aucun rollback automatique : les appartenances créées doivent être ' +
      'supprimées manuellement après vérification (elles ne modifient aucun compte global).'
  );
};

module.exports = { up, down };

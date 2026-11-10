#!/usr/bin/env node

/**
 * Migration locale → en ligne : espace d'équipe Trivida + modèles,
 * rattaché à un espace de travail (Workspace) et à un propriétaire.
 *
 * Copie, depuis la base locale du tenant Nova (`NovaDB`), tout le contenu de
 * l'espace d'équipe « Trivida » vers la base en ligne (MongoDB Atlas), puis le
 * **ré-attribue** :
 *
 *   - `espaces`   : l'espace « Trivida »
 *   - `pages`     : la page maître et toutes ses sous-pages
 *   - `blocs`     : le contenu de ces pages
 *   - `bases`     : les bases de données rattachées à l'espace
 *   - `elements`  : les lignes de ces bases
 *   - `modeles`   : la bibliothèque de modèles (lecture : globale, non ré-attribuée)
 *
 * Ré-attribution appliquée à tous les documents transférés :
 *   - `workspaceId` → l'espace de travail cible (uniquement sur les collections
 *     qui portent ce champ : `Espace` et `Page`) ;
 *   - `espaceId`    → l'espace d'équipe Trivida en ligne ;
 *   - `createdBy` / `updatedBy` → le propriétaire cible.
 *
 * Le script est **additif et idempotent** : il n'efface aucun contenu et
 * s'appuie sur un `replaceOne` par `_id`. Les identifiants et les relations
 * entre documents (espaceId, pageId, baseId, parentId) sont préservés, si bien
 * qu'il peut être relancé sans risque. Seuls les doublons d'espace Trivida
 * vides (aucune page rattachée) sont supprimés.
 *
 * Usage :
 *   node scripts/migrations/transferer-trivida-en-ligne.js --dry-run
 *   node scripts/migrations/transferer-trivida-en-ligne.js
 *   node scripts/migrations/transferer-trivida-en-ligne.js --espace "Trivida" \
 *     --workspace-cible 6af2f938337fc5df44f30c18 --proprietaire 6af2f930337fc5df44f30bcf
 *
 * Variables d'environnement (facultatives) : MONGO_URI (locale),
 * ONLINE_MONGO_URI (en ligne), NOVA_DB_NAME (nom de la base, « NovaDB »).
 */

require('dotenv').config();
const mongoose = require('mongoose');

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

const parametres = process.argv.slice(2);

const drapeau = (nom) => parametres.includes(`--${nom}`);

const option = (nom, defaut) => {
  const index = parametres.indexOf(`--${nom}`);
  if (index === -1) return defaut;
  const valeur = parametres[index + 1];
  return valeur && !valeur.startsWith('--') ? valeur : defaut;
};

const URI_LOCALE = option('local-uri', process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
const URI_EN_LIGNE = option(
  'online-uri',
  process.env.ONLINE_MONGO_URI ||
    'mongodb+srv://cerver-gold-dry:CmhhHeUa8DJB8x1n@dryglobal.nygs81u.mongodb.net/',
);
const BASE_LOCALE = option('local-db', process.env.NOVA_DB_NAME || 'NovaDB');
const BASE_EN_LIGNE = option('online-db', process.env.NOVA_DB_NAME || 'NovaDB');
const NOM_ESPACE = option('espace', 'Trivida');

// Rattachement demandé : l'espace d'équipe Trivida est placé dans cet espace de
// travail et appartient à cet utilisateur.
const WORKSPACE_CIBLE = option('workspace-cible', '6af2f938337fc5df44f30c18');
const PROPRIETAIRE = option('proprietaire', '6af2f930337fc5df44f30bcf');

const SIMULATION = drapeau('dry-run');

const log = (message) => console.log(`[trivida→en-ligne] ${message}`);

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const versObjectId = (valeur) => new mongoose.Types.ObjectId(String(valeur));

const masquer = (uri) => String(uri).replace(/\/\/[^@/]*@/, '//***@');

/** Échappe les caractères spéciaux d'une expression régulière. */
const echapperRegex = (valeur) => String(valeur).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Résout le nom réel d'une collection : les modèles Mongoose sont pluralisés
 * par défaut (« Espace » → « espaces »), mais on vérifie d'abord la présence
 * effective pour ne pas dépendre de cette convention.
 */
async function resoudreCollection(db, nomAttendu) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const exacte = collections.find((c) => c.name === nomAttendu);
  if (exacte) return exacte.name;
  const insensible = collections.find((c) => c.name.toLowerCase() === nomAttendu.toLowerCase());
  return insensible ? insensible.name : nomAttendu;
}

/* ------------------------------------------------------------------ */
/* Lecture du contenu local                                            */
/* ------------------------------------------------------------------ */

async function collecterContenu(db) {
  const noms = {
    espaces: await resoudreCollection(db, 'espaces'),
    pages: await resoudreCollection(db, 'pages'),
    blocs: await resoudreCollection(db, 'blocs'),
    bases: await resoudreCollection(db, 'bases'),
    elements: await resoudreCollection(db, 'elements'),
    modeles: await resoudreCollection(db, 'modeles'),
  };

  const espaces = await db
    .collection(noms.espaces)
    .find({ nom: new RegExp(`^${echapperRegex(NOM_ESPACE)}$`, 'i') })
    .toArray();

  if (espaces.length === 0) {
    throw new Error(
      `Aucun espace nommé « ${NOM_ESPACE} » dans la base locale « ${BASE_LOCALE} ». ` +
        'Vérifiez la base locale (--local-db) ou le nom de l’espace (--espace).',
    );
  }

  const espaceIds = espaces.map((e) => e._id);

  const pages = await db.collection(noms.pages).find({ espaceId: { $in: espaceIds } }).toArray();
  const pageIds = pages.map((p) => p._id);

  const blocs = pageIds.length
    ? await db.collection(noms.blocs).find({ pageId: { $in: pageIds } }).toArray()
    : [];

  const bases = await db
    .collection(noms.bases)
    .find({ $or: [{ espaceId: { $in: espaceIds } }, { pageId: { $in: pageIds } }] })
    .toArray();
  const baseIds = bases.map((b) => b._id);

  const elements = baseIds.length
    ? await db.collection(noms.elements).find({ baseId: { $in: baseIds } }).toArray()
    : [];

  // Les modèles forment une bibliothèque globale : on la copie intégralement.
  const modeles = await db.collection(noms.modeles).find({}).toArray();

  return { noms, espaces, pages, blocs, bases, elements, modeles };
}

/* ------------------------------------------------------------------ */
/* Ré-attribution                                                      */
/* ------------------------------------------------------------------ */

/**
 * Applique le rattachement demandé à un document : espace de travail,
 * espace d'équipe et propriétaire. Seuls les champs réellement présents dans
 * la collection sont réécrits, pour ne pas créer de champs parasites.
 */
function rattacher(document, { espaceId, workspaceId, proprietaire, avecWorkspace, avecEspace }) {
  const copie = { ...document, createdBy: proprietaire, updatedBy: proprietaire };
  if (avecEspace) copie.espaceId = espaceId;
  if (avecWorkspace) copie.workspaceId = workspaceId;
  return copie;
}

/* ------------------------------------------------------------------ */
/* Écriture en ligne                                                   */
/* ------------------------------------------------------------------ */

/**
 * Copie des documents en préservant `_id` et `createdAt`.
 * Renvoie le nombre de créations et de documents déjà présents.
 */
async function copierCollection(db, nomCollection, documents) {
  if (!documents.length) return { crees: 0, dejaPresents: 0 };

  const operations = documents.map((document) => ({
    replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true },
  }));

  const resultat = await db.collection(nomCollection).bulkWrite(operations, { ordered: false });
  return {
    crees: resultat.upsertedCount || 0,
    // `matchedCount` = documents déjà présents en ligne : mesure utile pour
    // vérifier qu'un second passage ne crée aucun doublon.
    dejaPresents: resultat.matchedCount || 0,
  };
}

/* ------------------------------------------------------------------ */
/* Programme principal                                                 */
/* ------------------------------------------------------------------ */

async function principal() {
  const workspaceId = versObjectId(WORKSPACE_CIBLE);
  const proprietaire = versObjectId(PROPRIETAIRE);

  log(`Source      : ${BASE_LOCALE} · ${masquer(URI_LOCALE)}`);
  log(`Destination : ${BASE_EN_LIGNE} · ${masquer(URI_EN_LIGNE)}`);
  log(`Rattachement : espace « ${NOM_ESPACE} » → workspace ${WORKSPACE_CIBLE}, propriétaire ${PROPRIETAIRE}`);
  if (SIMULATION) log('Mode simulation (--dry-run) : aucune écriture en ligne.');

  /* --- 1. Lecture du contenu local --------------------------------- */

  const connexionLocale = await mongoose
    .createConnection(URI_LOCALE, { dbName: BASE_LOCALE, serverSelectionTimeoutMS: 15000 })
    .asPromise();

  let contenu;
  try {
    contenu = await collecterContenu(connexionLocale.db);
  } finally {
    await connexionLocale.close();
  }

  log('');
  log('Contenu local de l’espace :');
  log(`  pages    : ${contenu.pages.length}`);
  log(`  blocs    : ${contenu.blocs.length}`);
  log(`  bases    : ${contenu.bases.length}`);
  log(`  éléments : ${contenu.elements.length}`);
  log(`  modèles  : ${contenu.modeles.length}`);

  /* --- 2. Connexion en ligne et vérifications ---------------------- */

  const connexionEnLigne = await mongoose
    .createConnection(URI_EN_LIGNE, { dbName: BASE_EN_LIGNE, serverSelectionTimeoutMS: 20000 })
    .asPromise();
  const db = connexionEnLigne.db;

  try {
    const noms = {
      espaces: await resoudreCollection(db, contenu.noms.espaces),
      pages: await resoudreCollection(db, contenu.noms.pages),
      blocs: await resoudreCollection(db, contenu.noms.blocs),
      bases: await resoudreCollection(db, contenu.noms.bases),
      elements: await resoudreCollection(db, contenu.noms.elements),
      modeles: await resoudreCollection(db, contenu.noms.modeles),
      users: await resoudreCollection(db, 'users'),
      workspaces: await resoudreCollection(db, 'workspaces'),
    };

    const utilisateur = await db.collection(noms.users).findOne({ _id: proprietaire });
    if (!utilisateur) {
      throw new Error(`Propriétaire introuvable en ligne : aucun utilisateur « ${PROPRIETAIRE} ».`);
    }
    const espaceDeTravail = await db.collection(noms.workspaces).findOne({ _id: workspaceId });
    if (!espaceDeTravail) {
      throw new Error(`Espace de travail introuvable en ligne : « ${WORKSPACE_CIBLE} ».`);
    }

    log('');
    log(`Propriétaire : ${utilisateur.name || utilisateur.nom} <${utilisateur.email}>`);
    log(`Workspace    : ${espaceDeTravail.nom} (${espaceDeTravail.slug})`);

    /* --- 3. Espace d'équipe de destination ------------------------- */

    const espacesEnLigne = await db
      .collection(noms.espaces)
      .find({ nom: new RegExp(`^${echapperRegex(NOM_ESPACE)}$`, 'i') })
      .toArray();

    // Priorité : l'espace déjà présent dans le workspace cible, de préférence
    // celui que référencent les pages locales (mêmes `_id` après migration).
    const idsLocaux = contenu.espaces.map((e) => String(e._id));
    const dejaRattache = espacesEnLigne.filter(
      (e) => e.workspaceId && String(e.workspaceId) === WORKSPACE_CIBLE,
    );
    const destination =
      dejaRattache.find((e) => idsLocaux.includes(String(e._id))) ||
      dejaRattache[0] ||
      espacesEnLigne.find((e) => idsLocaux.includes(String(e._id))) ||
      null;

    const espaceId = destination
      ? destination._id
      : contenu.espaces[0]._id; /* sera créé sous cet identifiant */

    log('');
    log(
      destination
        ? `Espace « ${NOM_ESPACE} » existant réutilisé : ${espaceId}`
        : `Espace « ${NOM_ESPACE} » à créer en ligne : ${espaceId}`,
    );

    // Doublons : espaces du même nom hors workspace cible et sans aucune page.
    const doublons = [];
    for (const espace of espacesEnLigne) {
      if (String(espace._id) === String(espaceId)) continue;
      const pagesRattachees = await db
        .collection(noms.pages)
        .countDocuments({ espaceId: espace._id }, { limit: 1 });
      if (pagesRattachees === 0) doublons.push(espace);
      else log(`  (conservé : « ${espace.nom} » ${espace._id} contient des pages)`);
    }

    /* --- 4. Documents ré-attribués --------------------------------- */

    const espaceSource = contenu.espaces[0];
    const espaceCible = {
      ...espaceSource,
      _id: espaceId,
      nom: NOM_ESPACE,
      label: NOM_ESPACE,
      workspaceId,
      createdBy: proprietaire,
      updatedBy: proprietaire,
    };

    const optionsRattachement = { espaceId, workspaceId, proprietaire };
    const documentPages = contenu.pages.map((p) =>
      rattacher(p, { ...optionsRattachement, avecWorkspace: true, avecEspace: true }),
    );
    const documentBases = contenu.bases.map((b) =>
      rattacher(b, { ...optionsRattachement, avecEspace: true }),
    );
    const documentBlocs = contenu.blocs.map((b) => rattacher(b, { ...optionsRattachement }));
    const documentElements = contenu.elements.map((e) => rattacher(e, { ...optionsRattachement }));
    // Les modèles restent la bibliothèque partagée : seul un éventuel
    // rattachement à l'ancien espace est corrigé, l'auteur n'est pas modifié.
    const documentModeles = contenu.modeles.map((m) =>
      idsLocaux.includes(String(m.espaceId)) ? { ...m, espaceId } : m,
    );

    /* --- 5. Écriture ----------------------------------------------- */

    if (SIMULATION) {
      log('');
      log('Simulation — écritures prévues :');
      log(`  espaces  : 1 (${NOM_ESPACE}, workspace ${WORKSPACE_CIBLE})`);
      log(`  pages    : ${documentPages.length} (espaceId + workspaceId + propriétaire)`);
      log(`  blocs    : ${documentBlocs.length} (propriétaire)`);
      log(`  bases    : ${documentBases.length} (espaceId + propriétaire)`);
      log(`  elements : ${documentElements.length} (propriétaire)`);
      log(`  modeles  : ${documentModeles.length} (rattachement corrigé si nécessaire)`);
      log(
        `  doublons : ${doublons.length} espace(s) vide(s) à supprimer` +
          (doublons.length ? ` → ${doublons.map((d) => d._id).join(', ')}` : ''),
      );
      log('');
      log('Simulation terminée : rien n’a été écrit.');
      return;
    }

    log('');
    const etapes = [
      ['espaces', [espaceCible]],
      ['pages', documentPages],
      ['blocs', documentBlocs],
      ['bases', documentBases],
      ['elements', documentElements],
      ['modeles', documentModeles],
    ];

    for (const [nomLogique, documents] of etapes) {
      const { crees, dejaPresents } = await copierCollection(db, noms[nomLogique], documents);
      log(`  ${nomLogique.padEnd(9)} → ${crees} créé(s), ${dejaPresents} déjà présent(s)`);
    }

    /* --- 6. Nettoyage des doublons vides --------------------------- */

    for (const doublon of doublons) {
      const pagesRattachees = await db
        .collection(noms.pages)
        .countDocuments({ espaceId: doublon._id }, { limit: 1 });
      if (pagesRattachees > 0) {
        log(`  doublon conservé (pages rattachées entre-temps) : ${doublon._id}`);
        continue;
      }
      await db.collection(noms.espaces).deleteOne({ _id: doublon._id });
      log(`  doublon supprimé : « ${doublon.nom} » ${doublon._id}`);
    }

    const total = await db.collection(noms.pages).countDocuments({ espaceId });
    log('');
    log(`Migration terminée. ${total} page(s) rattachée(s) à l’espace ${espaceId}.`);
    log(`Propriétaire : ${utilisateur.name || utilisateur.nom} <${utilisateur.email}>.`);
  } finally {
    await connexionEnLigne.close();
  }
}

principal()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(`[trivida→en-ligne] erreur → ${erreur.message}`);
    process.exit(1);
  });

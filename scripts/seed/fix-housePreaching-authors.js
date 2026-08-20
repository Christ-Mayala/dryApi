#!/usr/bin/env node

/**
 * Correctif one-off — attribution auteur/chaîne + catégorisation des
 * prédications de la maison déjà importées.
 *
 * Contexte : le seed initial des sources (seed-housePreaching-sources.js) a
 * créé les deux chaînes avec le MÊME prêcheur ("Pasteur Yves Castanou"), ce
 * qui mélangeait ICCTV (Yves) et ICCTV Congo (Yvan). Depuis, le sync
 * ré-applique la source à chaque import, mais les documents déjà en base
 * gardaient l'ancienne valeur.
 *
 * Ce script :
 *   1. Corrige le prêcheur des sources (ICCTV → Yves, ICCTV Congo → Yvan).
 *   2. Backfille TOUTES les prédications existantes : preacher, category,
 *      sourceId, sourceName, channelHandle depuis leur source (ou le handle
 *      si source absente).
 *
 * Additif uniquement : ne supprime rien, ne fait que des updates ciblés.
 *
 * Usage : node scripts/seed/fix-housePreaching-authors.js
 */

require('dotenv').config();
require('dns').setServers(['1.1.1.1', '8.8.8.8']);

const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const HousePreachingSourceSchema = require('../../dryApp/Pelerin/features/housePreaching/model/housePreachingSource.schema');
const HousePreachingSchema = require('../../dryApp/Pelerin/features/housePreaching/model/housePreaching.schema');
const { categorizePreaching } = require('../../dryApp/Pelerin/services/housePreachingCategorization.service');

const PREACHER_BY_HANDLE = [
  { handle: '@icctvcongo', preacher: 'Pasteur Yvan Castanou' },
  { handle: '@icctv', preacher: 'Pasteur Yves Castanou' },
];

function resolvePreacher(source) {
  // Pour les chaînes connues (Yves/Yvan Castanou), le handle prime sur
  // source.preacher — corrige les sources seedees avec le mauvais prêcheur.
  const handle = (source.channelHandle || '').toLowerCase();
  const match = PREACHER_BY_HANDLE.find((p) => handle.startsWith(p.handle));
  if (match) return match.preacher;
  if (source.preacher && String(source.preacher).trim()) return String(source.preacher).trim();
  return 'Pasteur Yves Castanou';
}

function resolveCategory(source, title) {
  // Categorie explicite de la source (≠ defaut 'predication') prime ; sinon
  // deduction automatique depuis le titre.
  if (source.category && String(source.category).trim() !== 'predication') {
    return String(source.category).trim();
  }
  return categorizePreaching(title);
}

const run = async () => {
  await connectCluster();
  const db = getTenantDB('Pelerin');
  console.log('[fix] PelerinDB connectée.');

  const Source = getModel('Pelerin', 'HousePreachingSource', HousePreachingSourceSchema);
  const Preaching = getModel('Pelerin', 'HousePreaching', HousePreachingSchema);

  // 1. Corriger les sources
  const sources = await Source.find({ platform: 'youtube' }).lean();
  let sourceUpdated = 0;
  for (const s of sources) {
    const preacher = resolvePreacher(s);
    if (s.preacher !== preacher) {
      await Source.findByIdAndUpdate(s._id, { preacher });
      console.log(`[fix] Source "${s.name}" (${s.channelHandle}) : preacher "${s.preacher || '(vide)'}" -> "${preacher}"`);
      sourceUpdated++;
    }
  }
  console.log(`[fix] ${sourceUpdated} source(s) corrigée(s).`);

  // 2. Backfill des prédications existantes
  const preachings = await Preaching.find({}).lean();
  let updated = 0;
  let skipped = 0;
  for (const p of preachings) {
    const source = sources.find((s) => String(s._id) === String(p.sourceId))
      || (p.channelHandle ? sources.find((s) => s.channelHandle === p.channelHandle) : null);

    if (!source) {
      skipped++;
      continue;
    }

    const preacher = resolvePreacher(source);
    const category = resolveCategory(source, p.title || '');

    const updates = {
      preacher,
      category,
      sourceId: source._id,
      sourceName: source.name,
      channelHandle: source.channelHandle,
    };

    const needsUpdate =
      p.preacher !== preacher ||
      p.category !== category ||
      String(p.sourceId || '') !== String(source._id) ||
      p.sourceName !== source.name ||
      p.channelHandle !== source.channelHandle;

    if (needsUpdate) {
      await Preaching.findByIdAndUpdate(p._id, updates);
      console.log(`[fix] ${p.title.slice(0, 50)}... -> ${preacher} | ${category} | ${source.channelHandle}`);
      updated++;
    }
  }
  console.log(`[fix] ${updated} prédication(s) mises à jour, ${skipped} sans source.`);

  process.exit(0);
};

run().catch((err) => {
  console.error('[fix] Erreur:', err.message);
  console.error(err.stack);
  process.exit(1);
});

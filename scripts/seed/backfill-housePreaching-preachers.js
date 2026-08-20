#!/usr/bin/env node

/**
 * Correctif one-off — dédoublonnage Yves/Yvan des prédications de la maison.
 *
 * Contexte : la chaîne ICCTV (@ICCTV) publie aussi des sermons d'Yvan
 * Castanou (camps, conférences, jeûnes…). L'attribution par canal attribuait
 * donc ces vidéos à « Pasteur Yves Castanou » — mélange réel en base
 * (~1000 vidéos). La même logique par titre a depuis été intégrée au sync
 * (housePreachingSync.service.js) ; ce script applique le correctif aux
 * documents DÉJÀ importés, sans attendre la prochaine passe.
 *
 * Règle : si le TITRE nomme explicitement Yvan (ou Yves), le prêcheur suit le
 * titre ; sinon on retombe sur le canal de la source (comportement historique).
 *
 * Additif uniquement : ne supprime rien, ne fait que des updates ciblés.
 *
 * Usage : node scripts/seed/backfill-housePreaching-preachers.js
 */

require('dotenv').config();
require('dns').setServers(['1.1.1.1', '8.8.8.8']);

const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const HousePreachingSourceSchema = require('../../dryApp/Pelerin/features/housePreaching/model/housePreachingSource.schema');
const HousePreachingSchema = require('../../dryApp/Pelerin/features/housePreaching/model/housePreaching.schema');

const PREACHER_BY_HANDLE = [
  { handle: '@icctvcongo', preacher: 'Pasteur Yvan Castanou' },
  { handle: '@icctv', preacher: 'Pasteur Yves Castanou' },
];

const PREACHER_BY_TITLE = [
  { names: ['yvan', 'ivan castanou'], preacher: 'Pasteur Yvan Castanou' },
  { names: ['yves'], preacher: 'Pasteur Yves Castanou' },
];

function resolvePreacherFromTitle(title = '') {
  const t = String(title).toLowerCase();
  const match = PREACHER_BY_TITLE.find((p) => p.names.some((n) => t.includes(n)));
  return match ? match.preacher : null;
}

function resolvePreacher(source, title = '') {
  const fromTitle = resolvePreacherFromTitle(title);
  if (fromTitle) return fromTitle;
  const handle = (source.channelHandle || '').toLowerCase();
  const match = PREACHER_BY_HANDLE.find((p) => handle.startsWith(p.handle));
  if (match) return match.preacher;
  if (source.preacher && String(source.preacher).trim()) return String(source.preacher).trim();
  return 'Pasteur Yves Castanou';
}

const run = async () => {
  await connectCluster();
  const db = getTenantDB('Pelerin');
  console.log('[backfill] PelerinDB connectée.');

  const Source = getModel('Pelerin', 'HousePreachingSource', HousePreachingSourceSchema);
  const Preaching = getModel('Pelerin', 'HousePreaching', HousePreachingSchema);

  const sources = await Source.find({ platform: 'youtube' }).lean();
  const preachings = await Preaching.find({}).lean();

  let updated = 0;
  let byTitle = 0;
  let unchanged = 0;

  for (const p of preachings) {
    const source = sources.find((s) => String(s._id) === String(p.sourceId))
      || (p.channelHandle ? sources.find((s) => s.channelHandle === p.channelHandle) : null);

    if (!source) continue;

    const fromTitle = resolvePreacherFromTitle(p.title || '');
    const preacher = resolvePreacher(source, p.title || '');

    if (p.preacher !== preacher) {
      await Preaching.findByIdAndUpdate(p._id, { preacher });
      console.log(`[backfill] ${String(p.title).slice(0, 55)}...`);
      console.log(`           "${p.preacher}" -> "${preacher}"${fromTitle ? ' (par titre)' : ' (par canal)'}`);
      updated++;
      if (fromTitle) byTitle++;
    } else {
      unchanged++;
    }
  }

  console.log(`[backfill] ${updated} prédication(s) corrigée(s) (dont ${byTitle} par titre), ${unchanged} inchangée(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error('[backfill] Erreur:', err.message);
  console.error(err.stack);
  process.exit(1);
});

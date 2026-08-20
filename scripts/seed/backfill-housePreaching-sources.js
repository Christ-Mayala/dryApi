#!/usr/bin/env node

/**
 * Backfill one-off — attribution de la chaîne source aux prédications
 * importées AVANT l'ajout des champs sourceId/sourceName/channelHandle
 * (~5687 documents sans chaîne, invisibles dans les onglets Yves/Yvan).
 *
 * Pour chaque prédication sans channelHandle :
 *   1. Interroge l'API YouTube (videos?part=snippet&id=...) en batch de 50.
 *   2. Retrouve la Source_YouTube dont le nom correspond au channelTitle
 *      (insensible à la casse) — ex. channelTitle "ICCTV Congo" → source ICCTV Congo.
 *   3. Applique sourceId/sourceName/channelHandle + prêcheur déduit + catégorie.
 *
 * Si aucune source ne correspond au channelTitle, la prédication est laissée
 * telle quelle (elle restera visible dans l'onglet "Tous" uniquement).
 *
 * Requiert : YOUTUBE_API_KEY dans .env.
 * Usage : node scripts/seed/backfill-housePreaching-sources.js
 */

require('dotenv').config();
require('dns').setServers(['1.1.1.1', '8.8.8.8']);
const axios = require('axios');

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
  const handle = (source.channelHandle || '').toLowerCase();
  const match = PREACHER_BY_HANDLE.find((p) => handle.startsWith(p.handle));
  if (match) return match.preacher;
  if (source.preacher && String(source.preacher).trim()) return String(source.preacher).trim();
  return 'Pasteur Yves Castanou';
}

function resolveCategory(source, title) {
  if (source.category && String(source.category).trim() !== 'predication') {
    return String(source.category).trim();
  }
  return categorizePreaching(title);
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const run = async () => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[backfill] YOUTUBE_API_KEY manquant dans .env — abort.');
    process.exit(1);
  }

  await connectCluster();
  const db = getTenantDB('Pelerin');

  const Source = getModel('Pelerin', 'HousePreachingSource', HousePreachingSourceSchema);
  const Preaching = getModel('Pelerin', 'HousePreaching', HousePreachingSchema);

  const sources = await Source.find({ platform: 'youtube' }).lean();
  if (sources.length === 0) {
    console.error('[backfill] Aucune source YouTube en base — abort.');
    process.exit(1);
  }

  const pending = await Preaching.find({ channelHandle: null }).lean();
  console.log(`[backfill] ${pending.length} prédication(s) sans chaîne à traiter.`);

  let updated = 0;
  let unmatched = 0;
  let errors = 0;

  // Batch par 50 (limite API)
  for (let i = 0; i < pending.length; i += 50) {
    const chunk = pending.slice(i, i + 50);
    const ids = chunk.map((p) => p.youtubeVideoId).filter(Boolean);
    if (ids.length === 0) continue;

    let items = [];
    try {
      const { data } = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: { part: 'snippet', id: ids.join(','), key: apiKey },
        timeout: 20000,
      });
      items = data.items || [];
    } catch (err) {
      errors += chunk.length;
      console.error(`[backfill] Erreur API pour batch ${i / 50 + 1}: ${err.message}`);
      continue;
    }

    const titleByVideo = {};
    for (const v of items) {
      titleByVideo[v.id] = v.snippet?.channelTitle || '';
    }

    for (const p of chunk) {
      const channelTitle = titleByVideo[p.youtubeVideoId];
      if (!channelTitle) {
        unmatched++;
        continue;
      }

      // Match source par nom normalisé (minuscules, sans espaces ni ponctuation) :
      // channelTitle "ICC TV" → source "ICCTV", "ICC TV Congo" → "ICCTV Congo".
      const normalizeName = (str) =>
        String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const normTitle = normalizeName(channelTitle);
      const source = sources.find((s) => {
        const normName = normalizeName(s.name);
        return normName && (normTitle.includes(normName) || normName.includes(normTitle));
      });

      if (!source) {
        unmatched++;
        continue;
      }

      const preacher = resolvePreacher(source);
      const category = resolveCategory(source, p.title || '');

      await Preaching.findByIdAndUpdate(p._id, {
        sourceId: source._id,
        sourceName: source.name,
        channelHandle: source.channelHandle,
        preacher,
        category,
      });
      updated++;
    }
  }

  console.log(`[backfill] Terminé : ${updated} attribuée(s), ${unmatched} sans correspondance, ${errors} en erreur.`);
  process.exit(0);
};

run().catch((err) => {
  console.error('[backfill] Erreur:', err.message);
  process.exit(1);
});

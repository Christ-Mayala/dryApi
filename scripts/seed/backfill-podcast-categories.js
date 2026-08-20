#!/usr/bin/env node

/**
 * Backfill one-off — reclasser les podcasts déjà importés dans leur vraie
 * catégorie produit (dev-personnel, famille, jeunesse, leadership…) au lieu
 * de 'foi-spiritualite' / 'enseignement' / 'autre' en dur.
 *
 * Utilise le MÊME service que l'import RSS (podcastCategorization.service.js)
 * : titre + description → catégorie. Additif uniquement : ne supprime rien.
 *
 * Usage : node scripts/seed/backfill-podcast-categories.js
 */

require('dotenv').config();
require('dns').setServers(['1.1.1.1', '8.8.8.8']);

const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const PodcastShowSchema = require('../../dryApp/Pelerin/features/podcastShow/model/podcastShow.schema');
const { categorizePodcast, PRODUCT_CATEGORIES } = require('../../dryApp/Pelerin/services/podcastCategorization.service');

const run = async () => {
  await connectCluster();
  const db = getTenantDB('Pelerin');
  console.log('[backfill] PelerinDB connectée.');

  const Show = getModel('Pelerin', 'PodcastShow', PodcastShowSchema);

  const shows = await Show.find({}).lean();
  console.log(`[backfill] ${shows.length} podcast(s) en base.`);

  let updated = 0;
  const byCategory = {};
  for (const s of shows) {
    const oldCategory = s.category || '(aucune)';
    // Recalcule TOUJOURS : la catégorie est déduite du titre + description,
    // donc une catégorie 'valide' mais mal attribuée (ex. un flux
    // « Évangile du jour » en dev-personnel) est elle aussi corrigée.
    const category = categorizePodcast(s.title || '', s.description || '');
    if (category !== oldCategory) {
      await Show.findByIdAndUpdate(s._id, { category });
      updated++;
      byCategory[category] = (byCategory[category] || 0) + 1;
    }
  }

  console.log(`[backfill] ${updated} podcast(s) reclassé(s) :`);
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => console.log(`  ${cat} → +${count}`));

  process.exit(0);
};

run().catch((err) => {
  console.error('[backfill] Erreur:', err.message);
  console.error(err.stack);
  process.exit(1);
});

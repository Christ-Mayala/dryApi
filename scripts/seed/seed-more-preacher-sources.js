/**
 * Seed des sources YouTube supplémentaires pour les Prédications de la Maison.
 *
 * Ajoute les chaînes officielles demandées :
 *   - COMPASSION TV (Pasteur Marcello Tunasi)
 *   - Athom's et Nadège (Pasteur Athoms Mbuma)
 *   - RMC IMPACTV (Pasteur Mamadou Karambiri)
 *   - KANGUKA FRANÇAIS (Chris Ndikumana — correspondance probable de « Kangouaka »)
 *
 * Usage :
 *   node scripts/seed/seed-more-preacher-sources.js
 *
 * Variables d'environnement :
 *   - YOUTUBE_API_KEY : requise pour résoudre les chaînes et synchroniser
 */

require('dotenv').config();
const mongoose = require('mongoose');

const HousePreachingSourceSchema = require('../../dryApp/Pelerin/features/housePreaching/model/housePreachingSource.schema');
const HousePreachingSchema = require('../../dryApp/Pelerin/features/housePreaching/model/housePreaching.schema');
const { syncFromYouTube } = require('../../dryApp/Pelerin/services/housePreachingSync.service');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dryapi';
// Les apps dryApi vivent dans des bases tenantes « <App>DB » (multi-tenant
// useDb). Le Pèlerin = PelerinDB — pas la base par défaut !
const TENANT_DB = process.env.TENANT_DB || 'PelerinDB';

const SOURCES = [
  {
    name: 'Compassion TV',
    channelId: 'UCb49E5hbSfUr5gC1G0Xp8MA',
    channelHandle: '@EGLISELACOMPASSION',
    channelUrl: 'https://www.youtube.com/@EGLISELACOMPASSION',
    preacher: 'Pasteur Marcello Tunasi',
  },
  {
    name: "Athom's et Nadège",
    channelId: 'UCPktGhhIpMbOqj9eKvH0Rtw',
    channelUrl: 'https://www.youtube.com/channel/UCPktGhhIpMbOqj9eKvH0Rtw',
    preacher: 'Pasteur Athoms Mbuma',
  },
  {
    name: 'RMC Impact TV',
    channelId: 'UCZmGvIj9wy01flFwDOxeqpQ',
    channelHandle: '@rmcimpactv',
    channelUrl: 'https://www.youtube.com/@rmcimpactv',
    preacher: 'Pasteur Mamadou Karambiri',
  },
  {
    name: 'KANGUKA FRANÇAIS',
    channelId: 'UCcqvose5xkxXAy-FHgxJlfA',
    channelHandle: '@KANGUKAFRANÇAIS',
    channelUrl: 'https://www.youtube.com/@KANGUKAFRAN%C3%87AIS',
    preacher: 'Pasteur Chris Ndikumana',
  },
];

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.useDb(TENANT_DB, { useCache: true });
  console.log(`✅ Connecté à MongoDB → base tenant ${TENANT_DB}`);

  const Source = db.model('HousePreachingSource', HousePreachingSourceSchema);
  const Preaching = db.model('HousePreaching', HousePreachingSchema);

  for (const src of SOURCES) {
    const existing = await Source.findOne({
      $or: [{ channelId: src.channelId }, { channelHandle: src.channelHandle }],
    });
    if (existing) {
      console.log(`ℹ️  Source existante : ${existing.name} (${existing.channelHandle || existing.channelId})`);
      continue;
    }
    const created = await Source.create({
      ...src,
      platform: 'youtube',
      category: 'predication',
      autoPublish: true,
      isActive: true,
    });
    console.log(`✅ Source créée : ${created.name} → ${created.preacher}`);
  }

  console.log('\n🚀 Synchronisation YouTube (toutes les sources actives)…');
  const result = await syncFromYouTube(Preaching, Source);
  console.log('📊 Résultat:', result);

  await mongoose.disconnect();
  console.log('\n✅ Terminé');
}

main().catch((err) => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});

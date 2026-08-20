/**
 * Seed des sources YouTube pour les Prédications de la Maison.
 *
 * Ajoute les deux chaînes demandées :
 *   - https://www.youtube.com/@ICCTV
 *   - https://www.youtube.com/@icctvcongo
 *
 * Usage :
 *   node scripts/seed/seed-housePreaching-sources.js
 *
 * Variables d'environnement :
 *   - MONGO_URI : connexion MongoDB
 *   - YOUTUBE_API_KEY : (optionnel) pour vérifier les chaînes immédiatement
 */

require('dotenv').config();
const mongoose = require('mongoose');

const HousePreachingSourceSchema = require('../../dryApp/Pelerin/features/housePreaching/model/housePreachingSource.schema');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dryapi_dev';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connecté à MongoDB');

  const Model = mongoose.model('HousePreachingSource', HousePreachingSourceSchema);

  const sources = [
    {
      name: 'ICCTV',
      platform: 'youtube',
      channelHandle: '@ICCTV',
      channelUrl: 'https://www.youtube.com/@ICCTV',
      preacher: 'Pasteur Yves Castanou',
      category: 'predication',
      autoPublish: true,
      isActive: true,
    },
    {
      name: 'ICCTV Congo',
      platform: 'youtube',
      channelHandle: '@icctvcongo',
      channelUrl: 'https://www.youtube.com/@icctvcongo',
      // ⚠️ Prêcheur distinct de la chaîne ICCTV — ne pas remettre Yves ici,
      // c'est la source du mélange entre les deux chaînes.
      preacher: 'Pasteur Yvan Castanou',
      category: 'predication',
      autoPublish: true,
      isActive: true,
    },
  ];

  for (const src of sources) {
    const existing = await Model.findOne({ channelHandle: src.channelHandle });
    if (existing) {
      console.log(`ℹ️  Source existante : ${src.name} (${src.channelHandle})`);
      continue;
    }
    const created = await Model.create(src);
    console.log(`✅ Source créée : ${created.name} (${created.channelHandle})`);
  }

  const all = await Model.find({}).lean();
  console.log(`\n📊 Sources en base : ${all.length}`);
  for (const s of all) {
    console.log(`   - ${s.name} | ${s.channelHandle} | active=${s.isActive} | sync=${s.syncStatus}`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Déconnecté de MongoDB');
}

main().catch((err) => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});

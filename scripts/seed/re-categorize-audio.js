/**
 * Re-catégorisation RÉELLE de la bibliothèque Audio.
 *
 * Les pistes importées l'étaient avec la catégorie de la REQUÊTE de recherche
 * (ex. tout « Dena Mwana » → gospel). Ce script recalcule la catégorie de
 * chaque piste depuis son CONTENU (titre + artiste) via `categorizeTrack`
 * et met à jour celles qui changent.
 *
 * Usage :
 *   node scripts/seed/re-categorize-audio.js
 *
 * Variables d'environnement :
 *   - MONGO_URI  (défaut: mongodb://127.0.0.1:27017/dryapi)
 *   - TENANT_DB  (défaut: PelerinDB — base tenant du Pèlerin)
 */

require('dotenv').config();
const mongoose = require('mongoose');

const AudioTrackSchema = require('../../dryApp/Pelerin/features/audioTrack/model/audioTrack.schema');
const { categorizeTrack } = require('../../dryApp/Pelerin/services/youtubeAudio.service');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dryapi';
const TENANT_DB = process.env.TENANT_DB || 'PelerinDB';

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.useDb(TENANT_DB, { useCache: true });
  const Track = db.model('AudioTrack', AudioTrackSchema);

  const total = await Track.countDocuments({});
  console.log(`✅ Connecté à MongoDB → base tenant ${TENANT_DB} (${total} pistes)`);

  const cursor = Track.find({}).select('_id title artist category').lean().cursor();
  const counts = { gospel: 0, louange: 0, enseignement: 0, podcast: 0, autre: 0 };
  const changes = { 'gospel→louange': 0, 'gospel→enseignement': 0, 'louange→gospel': 0, 'louange→enseignement': 0, 'enseignement→gospel': 0, 'enseignement→louange': 0, 'podcast→autre': 0, autre: 0 };
  let processed = 0;
  let updated = 0;
  let batch = [];

  for await (const t of cursor) {
    processed += 1;
    const from = t.category || '';
    const to = categorizeTrack({ title: t.title, channelTitle: t.artist, description: '' }, from || 'louange');
    counts[to] = (counts[to] || 0) + 1;
    if (to !== from) {
      updated += 1;
      const key = `${from}→${to}`;
      changes[key] = (changes[key] || 0) + 1;
      batch.push({ updateOne: { filter: { _id: t._id }, update: { $set: { category: to } } } });
      if (batch.length >= 200) {
        await Track.bulkWrite(batch);
        batch = [];
        process.stdout.write(`\r⏳ ${processed}/${total} pistes traitées…`);
      }
    }
  }
  if (batch.length > 0) await Track.bulkWrite(batch);

  console.log(`\n\n📊 Répartition finale (${processed} pistes) :`);
  for (const [k, v] of Object.entries(counts)) console.log(`  • ${k.padEnd(12)} ${v}`);
  console.log(`\n🔄 ${updated} piste(s) re-catégorisée(s) :`);
  for (const [k, v] of Object.entries(changes)) {
    if (v > 0) console.log(`  • ${k.padEnd(24)} ${v}`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Terminé');
}

main().catch((err) => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Migration: Augmenter les quotas RPM/TPM des modèles FreeLLM
 * ============================================================
 *
 * Ce script met à jour les limites dans la collection Models
 * pour réduire les erreurs 429 (rate limit) des providers upstream.
 *
 * Usage:
 *   MONGO_URI=mongodb://... node scripts/increaseQuotas.js
 *
 * Options:
 *   --dry-run   Affiche les changements sans écrire en base
 *   --verbose   Affiche chaque document modifié
 */

const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// ── Nouveaux quotas par provider ──
// Clé: "platform:modelId" → Valeurs: { rpmLimit, rpdLimit, tpmLimit, tpdLimit }
const QUOTA_UPDATES = {
  // ── Mistral : ancien RPM=2 → nouveau RPM=30 ──
  'mistral:mistral-large-latest':           { rpmLimit: 30, rpdLimit: 1000, tpmLimit: 500000, tpdLimit: 10000000 },
  'mistral:magistral-medium-latest':        { rpmLimit: 30, rpdLimit: 1000, tpmLimit: 500000, tpdLimit: 10000000 },
  'mistral:codestral-latest':               { rpmLimit: 30, rpdLimit: 1000, tpmLimit: 500000, tpdLimit: 10000000 },
  'mistral:devstral-latest':                { rpmLimit: 30, rpdLimit: 1000, tpmLimit: 500000, tpdLimit: 10000000 },
  'mistral:mistral-medium-latest':          { rpmLimit: 30, rpdLimit: 1000, tpmLimit: 500000, tpdLimit: 10000000 },

  // ── Google : RPM 5-15 → 15, ajout RPD/TPD ──
  'google:gemini-2.5-pro':                  { rpmLimit: 15, rpdLimit: 1500, tpmLimit: 400000, tpdLimit: 20000000 },
  'google:gemini-2.5-flash':                { rpmLimit: 15, rpdLimit: 1500, tpmLimit: 250000, tpdLimit: 20000000 },
  'google:gemini-2.5-flash-lite':           { rpmLimit: 15, rpdLimit: 1500, tpmLimit: 250000, tpdLimit: 20000000 },
  'google:gemini-3.1-flash-lite-preview':   { rpmLimit: 15, rpdLimit: 1500, tpmLimit: 250000, tpdLimit: 20000000 },
  'google:gemini-3-flash-preview':          { rpmLimit: 15, rpdLimit: 1500, tpmLimit: 250000, tpdLimit: 20000000 },
  'google:gemini-3.1-pro-preview':          { rpmLimit: 15, rpdLimit: 1500, tpmLimit: 250000, tpdLimit: 20000000 },

  // ── Groq : TPM 6K-12K → 30K, RPD/TPD augmentés ──
  'groq:llama-3.3-70b-versatile':           { rpmLimit: 30, rpdLimit: 1440, tpmLimit: 30000, tpdLimit: 2000000 },
  'groq:meta-llama/llama-4-scout-17b-16e-instruct': { rpmLimit: 30, rpdLimit: 1440, tpmLimit: 30000, tpdLimit: 2000000 },
  'groq:openai/gpt-oss-120b':              { rpmLimit: 30, rpdLimit: 1440, tpmLimit: 30000, tpdLimit: 2000000 },
  'groq:openai/gpt-oss-20b':               { rpmLimit: 30, rpdLimit: 1440, tpmLimit: 30000, tpdLimit: 2000000 },
  'groq:qwen/qwen3-32b':                   { rpmLimit: 60, rpdLimit: 1440, tpmLimit: 30000, tpdLimit: 2000000 },
  'groq:llama-3.1-8b-instant':             { rpmLimit: 30, rpdLimit: 1440, tpmLimit: 30000, tpdLimit: 2000000 },
  'groq:groq/compound':                    { rpmLimit: 30, rpdLimit: 1440, tpmLimit: 30000, tpdLimit: 2000000 },
  'groq:groq/compound-mini':               { rpmLimit: 30, rpdLimit: 1440, tpmLimit: 30000, tpdLimit: 2000000 },

  // ── GitHub : RPM 10 → 15, ajout TPM/TPD ──
  'github:openai/gpt-4.1':                 { rpmLimit: 15, rpdLimit: 200, tpmLimit: 150000, tpdLimit: 3000000 },
  'github:gpt-4o':                         { rpmLimit: 15, rpdLimit: 200, tpmLimit: 150000, tpdLimit: 3000000 },

  // ── Cerebras : TPM 60K → 120K, RPD augmenté ──
  'cerebras:qwen-3-235b-a22b-instruct-2507': { rpmLimit: 30, rpdLimit: 14400, tpmLimit: 120000, tpdLimit: 5000000 },
  'cerebras:gpt-oss-120b':                 { rpmLimit: 30, rpdLimit: 14400, tpmLimit: 120000, tpdLimit: 5000000 },
  'cerebras:llama3.1-8b':                  { rpmLimit: 30, rpdLimit: 14400, tpmLimit: 120000, tpdLimit: 5000000 },

  // ── SambaNova : RPD 20 → 1000, TPD augmenté ──
  'sambanova:DeepSeek-V3.2':               { rpmLimit: 20, rpdLimit: 1000, tpmLimit: null, tpdLimit: 2000000 },
  'sambanova:DeepSeek-V3.1':               { rpmLimit: 20, rpdLimit: 1000, tpmLimit: null, tpdLimit: 2000000 },
  'sambanova:Llama-4-Maverick-17B-128E-Instruct': { rpmLimit: 20, rpdLimit: 1000, tpmLimit: null, tpdLimit: 2000000 },
  'sambanova:gpt-oss-120b':                { rpmLimit: 20, rpdLimit: 1000, tpmLimit: null, tpdLimit: 2000000 },
  'sambanova:DeepSeek-V3.1-cb':            { rpmLimit: 20, rpdLimit: 1000, tpmLimit: null, tpdLimit: 2000000 },
  'sambanova:gemma-3-12b-it':              { rpmLimit: 20, rpdLimit: 1000, tpmLimit: null, tpdLimit: 2000000 },
};

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI est requis. Usage: MONGO_URI=mongodb://... node scripts/increaseQuotas.js');
    process.exit(1);
  }

  console.log(`🔗 Connexion à MongoDB...${DRY_RUN ? ' (DRY RUN)' : ''}`);
  await mongoose.connect(uri);
  console.log('✅ Connecté.\n');

  const db = mongoose.connection.db;
  const collection = db.collection('models');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [key, quotas] of Object.entries(QUOTA_UPDATES)) {
    const [platform, ...modelIdParts] = key.split(':');
    const modelId = modelIdParts.join(':');

    // Trouver le document existant
    const doc = await collection.findOne({ platform, modelId, deletedAt: null });
    if (!doc) {
      console.log(`⚠️  Non trouvé: ${key}`);
      notFound++;
      continue;
    }

    // Construire la mise à jour (seulement les champs qui changent)
    const updateFields = {};
    const changes = [];

    for (const [field, newValue] of Object.entries(quotas)) {
      const oldValue = doc[field];
      if (oldValue !== newValue) {
        updateFields[field] = newValue;
        changes.push(`${field}: ${oldValue ?? 'null'} → ${newValue ?? 'null'}`);
      }
    }

    if (changes.length === 0) {
      skipped++;
      continue;
    }

    if (VERBOSE || DRY_RUN) {
      console.log(`📝 ${key}:`);
      changes.forEach(c => console.log(`   ${c}`));
    }

    if (!DRY_RUN) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: updateFields }
      );
    }

    updated++;
  }

  console.log(`\n📊 Résumé:`);
  console.log(`   ✅ Mis à jour: ${updated}`);
  console.log(`   ⏭️  Inchangés: ${skipped}`);
  console.log(`   ⚠️  Non trouvés: ${notFound}`);

  if (DRY_RUN) {
    console.log('\n🔒 DRY RUN — Aucune modification écrite.');
  } else {
    console.log('\n✅ Migration terminée avec succès.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});

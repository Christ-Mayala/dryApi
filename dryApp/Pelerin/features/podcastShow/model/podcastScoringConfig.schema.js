const mongoose = require('mongoose');

/**
 * Surcharges persistées du scoring des podcasts (dryApp/Pelerin) — document
 * singleton.
 *
 * Permet à l'admin de modifier les seuils et poids du scoring depuis
 * l'application, SANS éditer le .env. Priorité de résolution :
 *   1. surcharges persistées ici (par variable PODCAST_SCORE_*) ;
 *   2. variables d'environnement (PODCAST_SCORE_*) ;
 *   3. valeurs par défaut de la spec produit (podcastScoring.service.js).
 *
 * Un objet vide `{}` pour weights/thresholds = aucun écart par rapport à
 * l'environnement (état « par défaut »).
 */
const PodcastScoringConfigSchema = new mongoose.Schema(
  {
    // Clés : noms exacts des variables PODCAST_SCORE_* (voir WEIGHT_KEYS /
    // THRESHOLD_KEYS dans podcastScoring.service.js).
    weights: { type: Object, default: {} },
    thresholds: { type: Object, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = PodcastScoringConfigSchema;

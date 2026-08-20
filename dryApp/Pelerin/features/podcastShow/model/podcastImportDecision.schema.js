const mongoose = require('mongoose');

/**
 * Historique des décisions du pipeline d'import automatique des podcasts
 * (dryApp/Pelerin).
 *
 * Une entrée est créée à chaque passage du pipeline :
 *   - import automatique (source 'auto'/'discover') — la décision (auto /
 *     pending / rejected) est prise par le score, dont le détail par critère
 *     (scoreBreakdown) est conservé pour la transparence admin ;
 *   - action de modération admin (source 'moderation') — approbation, rejet ou
 *     réactivation d'un podcast auto-publié / rejeté / désactivé, avec motif
 *     optionnel.
 *
 * Lecture : écran admin « Pipeline » (GET /podcastShow/admin/pipeline).
 */
const PodcastImportDecisionSchema = new mongoose.Schema(
  {
    showId: { type: mongoose.Schema.Types.ObjectId, ref: 'PodcastShow', default: null },
    showTitle: { type: String, trim: true, default: null },
    rssUrl: { type: String, trim: true, default: null },

    // Origine de la décision.
    //   auto       = auto-découverte planifiée (scheduler) ;
    //   discover   = import manuel via le pipeline de score (source='discover') ;
    //   manual     = import admin explicite (aucune décision de score) ;
    //   moderation = action de modération admin (approve / reject / reactivate).
    source: { type: String, enum: ['auto', 'discover', 'manual', 'moderation'], default: 'auto' },

    // Type d'événement.
    action: { type: String, enum: ['import', 'approve', 'reject', 'reactivate'], default: 'import' },

    // Décision du pipeline appliquée au podcast à cet instant.
    decision: { type: String, enum: ['auto', 'pending', 'rejected', 'manual'], default: 'manual' },

    // Score de pertinence 0–100 + détail par critère (transparence admin).
    score: { type: Number, default: null },
    scoreBreakdown: { type: Array, default: [] },

    // Modération : motif optionnel + admin à l'origine de l'action.
    reason: { type: String, trim: true, default: null },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true },
);

PodcastImportDecisionSchema.index({ createdAt: -1 });
PodcastImportDecisionSchema.index({ decision: 1, createdAt: -1 });
PodcastImportDecisionSchema.index({ source: 1, createdAt: -1 });
PodcastImportDecisionSchema.index({ showId: 1, createdAt: -1 });

module.exports = PodcastImportDecisionSchema;

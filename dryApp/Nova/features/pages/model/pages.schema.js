const mongoose = require('mongoose');

/**
 * Page = document editeur de blocs (coeur de Nova). Une page appartient a un
 * espace et peut avoir une page parente (hierarchie / sous-pages).
 *
 * Le plugin DRY derive `label` depuis `titre` et ajoute slug/status/deletedAt/
 * createdBy/updatedBy.
 */
const PagesSchema = new mongoose.Schema(
  {
    titre: { type: String, required: true, trim: true },
    icone: { type: String, default: '📄' },
    couverture: { type: String },
    espaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Espace' },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
    ordre: { type: Number, default: 0 },
    favori: { type: Boolean, default: false },
    pleineLargeur: { type: Boolean, default: false },
    publie: { type: Boolean, default: false },
    section: { type: String, enum: ['equipe', 'prive', 'partage'], default: 'equipe' },
    derniereVisite: { type: Date },
  },
  { timestamps: true }
);

PagesSchema.index({ espaceId: 1, parentId: 1 });
PagesSchema.index({ favori: 1 });

module.exports = PagesSchema;

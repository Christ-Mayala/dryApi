const mongoose = require('mongoose');

/**
 * Element = une "ligne" d'une base (l'equivalent d'une entree Nova).
 * `valeurs` est une map libre : nom de propriete -> valeur.
 *
 * Le plugin DRY derive `label` depuis `titre` et ajoute slug/status/deletedAt/
 * createdBy/updatedBy.
 */
const ElementsSchema = new mongoose.Schema(
  {
    baseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Base', index: true },
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
    titre: { type: String, required: true },
    valeurs: { type: mongoose.Schema.Types.Mixed, default: {} },
    assigne: { type: String },
    priorite: { type: String, enum: ['basse', 'moyenne', 'haute', 'urgente'], default: 'moyenne' },
    etiquette: { type: String },
    dateDebut: { type: Date },
    dateFin: { type: Date },
    sousElements: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

ElementsSchema.index({ baseId: 1, titre: 1 });

module.exports = ElementsSchema;

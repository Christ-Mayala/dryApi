const mongoose = require('mongoose');

/**
 * Base = base de donnees Nova : collection d'elements structures par des
 * proprietes (colonnes) et affichee via differentes vues (tableau, kanban...).
 *
 * Le plugin DRY derive `label` depuis `titre` et ajoute slug/status/deletedAt/
 * createdBy/updatedBy.
 */
const BasesSchema = new mongoose.Schema(
  {
    titre: { type: String, required: true, trim: true },
    icone: { type: String, default: '📊' },
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
    espaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Espace' },
    enLigne: { type: Boolean, default: true },
    proprietes: [
      {
        nom: { type: String },
        type: {
          type: String,
          enum: [
            'titre',
            'texte',
            'nombre',
            'selection',
            'selection_multiple',
            'statut',
            'case',
            'date',
            'personne',
            'fichier',
            'url',
            'email',
            'telephone',
            'formule',
            'relation',
            'rollup',
            'id_unique',
            'cree_le',
            'modifie_le',
            'cree_par',
            'modifie_par',
          ],
        },
        options: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    vues: [
      {
        nom: { type: String },
        type: {
          type: String,
          enum: ['tableau', 'kanban', 'galerie', 'liste', 'calendrier', 'chronologie'],
        },
        filtres: { type: [mongoose.Schema.Types.Mixed], default: [] },
        tris: { type: [mongoose.Schema.Types.Mixed], default: [] },
        groupes: { type: [mongoose.Schema.Types.Mixed], default: [] },
        proprietesVisibles: { type: [String], default: [] },
      },
    ],
    modeles: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

BasesSchema.index({ espaceId: 1 });
BasesSchema.index({ pageId: 1 });

module.exports = BasesSchema;

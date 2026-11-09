const mongoose = require('mongoose');

/**
 * Version = instantane (snapshot) du contenu d'une page a un instant donne.
 * Permet de consulter et de restaurer un etat anterieur de la page.
 */
const VersionsSchema = new mongoose.Schema(
  {
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', required: true, index: true },
    titre: { type: String, default: '' },
    icone: { type: String, default: null },
    couverture: { type: String, default: null },
    publie: { type: Boolean, default: false },
    blocs: { type: mongoose.Schema.Types.Mixed, default: [] },
    auteurNom: { type: String, default: null },
  },
  { timestamps: true }
);

VersionsSchema.index({ pageId: 1, createdAt: -1 });

module.exports = VersionsSchema;

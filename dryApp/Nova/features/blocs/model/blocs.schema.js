const mongoose = require('mongoose');

/**
 * Bloc = unite de contenu de l'editeur (paragraphe, titre, liste, base, ...).
 * Un bloc appartient a une page et peut etre imbrique (parentId) ou porter des
 * enfants (colonne, bascule, ...).
 *
 * Le plugin DRY ajoute slug/label/status/deletedAt/createdBy/updatedBy.
 */
const BlocsSchema = new mongoose.Schema(
  {
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', index: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bloc' },
    type: {
      type: String,
      required: true,
      enum: [
        'paragraphe',
        'titre_1',
        'titre_2',
        'titre_3',
        'titre_4',
        'titre_5',
        'titre_6',
        'liste_a_puces',
        'liste_numerotee',
        'a_faire',
        'bascule',
        'image',
        'video',
        'audio',
        'fichier',
        'signet',
        'embed',
        'tableau',
        'base_en_ligne',
        'colonne',
        'separateur',
        'sommaire',
        'fil_ariane',
        'encadre',
        'citation',
        'code',
        'math',
        'bouton_modele',
        'bloc_synchro',
        'lien_page',
        'ia_resume',
        'ia_actions',
        'note',
        'onglets',
        'galerie',
        'galerie_medias',
        'graphique',
        'raccourci',
        'ia_page',
      ],
    },
    contenu: { type: String, default: '' },
    proprietes: { type: mongoose.Schema.Types.Mixed, default: {} },
    enfants: { type: [mongoose.Schema.Types.Mixed], default: [] },
    ordre: { type: Number, default: 0 },
  },
  { timestamps: true }
);

BlocsSchema.index({ pageId: 1, ordre: 1 });
BlocsSchema.index({ parentId: 1 });

module.exports = BlocsSchema;

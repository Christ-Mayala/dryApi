const mongoose = require('mongoose');

/**
 * Membre = personne invitée à collaborer dans l'espace de travail NOVA.
 * Le document est créé par un administrateur (invitation par e-mail) ; le
 * statut affiché est déduit de l'existence d'un compte utilisateur pour cet
 * e-mail (invité tant que le compte n'existe pas).
 *
 * Le plugin global DRY ajoute slug, label (dérivé de `nom`/`email`), status,
 * deletedAt, createdBy et updatedBy.
 */
const PermissionsSchema = new mongoose.Schema(
  {
    lecture: { type: Boolean, default: true },
    edition: { type: Boolean, default: true },
    commentaire: { type: Boolean, default: true },
    partage: { type: Boolean, default: false },
    admin: { type: Boolean, default: false },
  },
  { _id: false }
);

const MembresSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    nom: { type: String, trim: true },
    role: { type: String, enum: ['admin', 'membre', 'invite'], default: 'membre' },
    // Accès fins accordés au membre. Déduits du rôle par défaut, mais
    // personnalisables par un administrateur lors de l'invitation/modification.
    permissions: { type: PermissionsSchema, default: undefined },
    // Espaces d'equipe (teamspaces) auxquels le membre a acces. Un tableau vide
    // restreint le membre a ses propres pages ; absent = aucun filtrage
    // (compatibilite avec les membres crees avant cette fonctionnalite).
    espaceIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Espace' }], default: undefined },
    utilisateurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dateInvitation: { type: Date, default: Date.now },
    derniereConnexion: { type: Date },
  },
  { timestamps: true }
);

MembresSchema.index({ email: 1 }, { unique: true });
MembresSchema.index({ role: 1 });

module.exports = MembresSchema;

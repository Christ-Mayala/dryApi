const mongoose = require('mongoose');

/**
 * Membre = appartenance d'un compte à UN espace de travail NOVA.
 * C'est la seule source de vérité des droits : un même utilisateur peut être
 * propriétaire d'un workspace, membre d'un autre et invité d'un troisième.
 * La fiche est créée par le propriétaire/admin du workspace (invitation par
 * e-mail) ou automatiquement pour le créateur du workspace.
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
    // Espace de travail auquel cette appartenance donne accès. Obligatoire :
    // une fiche sans workspace ne peut accorder aucun droit (fail-closed).
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    nom: { type: String, trim: true },
    role: {
      type: String,
      enum: ['proprietaire', 'admin', 'membre', 'invite'],
      default: 'membre',
    },
    // Accès fins accordés au membre. Déduits du rôle par défaut, mais
    // personnalisables par un administrateur lors de l'invitation/modification.
    permissions: { type: PermissionsSchema, default: undefined },
    // Espaces d'equipe (teamspaces) auxquels le membre a acces. Un tableau vide
    // ou absent ne donne aucun acces (fail-closed) : la fiche n'est visible que
    // des administrateurs NOVA jusqu'à ce qu'un espace soit explicitement attribué.
    espaceIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Espace' }], default: undefined },
    utilisateurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dateInvitation: { type: Date, default: Date.now },
    derniereConnexion: { type: Date },
  },
  { timestamps: true }
);

// La même adresse e-mail peut collaborer dans plusieurs espaces de travail :
// l'unicité est donc locale au workspace, jamais globale.
MembresSchema.index({ workspaceId: 1, email: 1 }, { unique: true });
MembresSchema.index({ workspaceId: 1, utilisateurId: 1 });
MembresSchema.index({ workspaceId: 1, role: 1 });

module.exports = MembresSchema;

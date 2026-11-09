const mongoose = require('mongoose');
const BaseUserSchema = require('../../../../../dry/modules/user/user.schema');
const { ALL_ROLES } = require('../../../lib/roles');

/**
 * Schema User specifique PharmaPilot.
 *
 * On etend le schema User du kernel (methodes matchPassword, incLoginAttempts,
 * hashage bcrypt, soft-delete, verrouillage anti brute-force) afin de :
 *  - restreindre l'enum `role` aux roles pharmacie (+ roles DRY techniques) ;
 *  - rattacher l'utilisateur a une ou plusieurs pharmacies (multi-pharmacie).
 *
 * Le kernel n'est jamais modifie : le modele est enregistre pour le tenant
 * PharmaPilot via `getModel(appName, 'User', PharmaPilotUserSchema)`.
 */
const PharmaPilotUserSchema = BaseUserSchema.clone();

PharmaPilotUserSchema.add({
  role: { type: String, enum: ALL_ROLES, default: 'preparer', index: true },
  // Organisation (tenant) proprietaire : l'entite cliente qui paie l'abonnement.
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  // Etablissements (pharmacies) auxquels l'utilisateur a acces.
  pharmacyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true }],
  activePharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', default: null },
  // Autorisations explicites venant s'ajouter aux permissions du role
  // (ex. « consulter l'audit : selon autorisation »). Le controle reste
  // effectue cote backend par `requirePermission`.
  permissions: [{ type: String, trim: true }],
  matricule: { type: String, trim: true },
  poste: { type: String, trim: true },
});

module.exports = PharmaPilotUserSchema;

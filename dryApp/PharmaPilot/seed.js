const path = require('path');
const OrganizationsSchema = require('./features/organizations/model/organizations.schema');
const PharmaciesSchema = require('./features/pharmacies/model/pharmacies.schema');
const PharmaPilotUserSchema = require('./features/auth/model/pharmaPilotUser.schema');

/**
 * Seed PharmaPilot — idempotent et additif.
 *
 * Objectif : rendre la plateforme immediatement testable sans jamais creer de
 * donnees "comme si elles etaient reelles". Tout contenu de demonstration est
 * nomme explicitement (`... (donnees de test)`) et marque `isDemo: true`.
 *
 * Structure creee (multi-pharmacies) :
 *  - une Organization (tenant = entite cliente qui paie l'abonnement) ;
 *  - une Pharmacie de demonstration rattachee a cette organisation ;
 *  - un compte saas_admin (acces plateforme : creation des pharmacies) ;
 *  - un compte owner (gestion de la pharmacie de demonstration).
 *
 * Le seed ne s'execute que si les comptes n'existent pas deja : relancer le
 * script ne duplique rien.
 *
 * @param {{ appName: string, getModel: Function, logSeed: Function }} ctx
 * @returns {Promise<{ count: number }>}
 */
module.exports = async ({ appName, getModel, logSeed }) => {
  const Organization = getModel(appName, 'Organization', OrganizationsSchema);
  const Pharmacy = getModel(appName, 'Pharmacy', PharmaciesSchema);
  const User = getModel(appName, 'User', PharmaPilotUserSchema);

  let count = 0;
  const createdIds = [];

  // ---------------------------------------------------------------
  // 1. Administrateur SaaS (acces plateforme, rattache a une organisation)
  // ---------------------------------------------------------------
  const adminEmail = process.env.PHARMAPILOT_ADMIN_EMAIL || 'mayalachristgottlieb@gmail.com';
  let admin = await User.findOne({ email: adminEmail, includeDeleted: true });
  if (!admin) {
    admin = await User.create({
      name: 'Administrateur PharmaPilot (test)',
      email: adminEmail,
      password: process.env.PHARMAPILOT_ADMIN_PASSWORD || 'Admin@PharmaPilot2026',
      role: 'saas_admin',
      status: 'active',
    });
    count += 1;
    createdIds.push(admin._id);
  }

  // ---------------------------------------------------------------
  // 2. Organisation de demonstration (tenant)
  // ---------------------------------------------------------------
  const orgName = 'Organisation Demo (donnees de test)';
  let organization = await Organization.findOne({ name: orgName });
  if (!organization) {
    organization = await Organization.create({
      name: orgName,
      legalName: 'Organisation Demo SARL (donnees de test)',
      email: 'demo@pharmapilot.test',
      phone: '+237000000000',
      address: 'Adresse fictive — demonstration PharmaPilot',
      plan: 'standard',
      isDemo: true,
      settings: { currency: 'XAF' },
    });
    count += 1;
    createdIds.push(organization._id);
  }

  // ---------------------------------------------------------------
  // 3. Pharmacie de demonstration (etablissement, isDemo = true)
  // ---------------------------------------------------------------
  const demoName = 'Pharmacie Demo (donnees de test)';
  let pharmacy = await Pharmacy.findOne({ name: demoName });
  if (!pharmacy) {
    pharmacy = await Pharmacy.create({
      organizationId: organization._id,
      name: demoName,
      address: 'Adresse fictive — demonstration PharmaPilot',
      phone: '+237000000000',
      email: 'demo@pharmapilot.test',
      licenseNumber: 'DEMO-0001',
      isDemo: true,
      settings: {
        currency: 'XAF',
        lowStockThreshold: 10,
        expiryAlertDays: 90,
        allowNegativeStock: false,
      },
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    count += 1;
    createdIds.push(pharmacy._id);
  } else if (!pharmacy.organizationId) {
    // Reparation : une pharmacie creee par l'ancien modele (pharmacie = son
    // propre tenant) n'a pas d'`organizationId`. Sans ce rattachement,
    // `resolveTenant` ne pourrait pas deriver le `tenantId` des documents.
    pharmacy.organizationId = organization._id;
    await pharmacy.save();
    count += 1;
  }

  // ---------------------------------------------------------------
  // 4. Proprietaire de la pharmacie de demonstration
  // ---------------------------------------------------------------
  const ownerEmail = process.env.PHARMAPILOT_OWNER_EMAIL || 'proprietaire.demo@pharmapilot.test';
  let owner = await User.findOne({ email: ownerEmail, includeDeleted: true });
  if (!owner) {
    owner = await User.create({
      name: 'Proprietaire Demo (test)',
      email: ownerEmail,
      password: process.env.PHARMAPILOT_OWNER_PASSWORD || 'Demo@PharmaPilot2026',
      role: 'owner',
      organizationId: organization._id,
      pharmacyIds: [pharmacy._id],
      activePharmacyId: pharmacy._id,
      status: 'active',
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    count += 1;
    createdIds.push(owner._id);
  } else {
    // Reparation : garantir le rattachement a la pharmacie et a l'organisation
    // (comptes crees par l'ancien modele mono-pharmacie).
    let changed = false;
    if (!(owner.pharmacyIds || []).some((id) => String(id) === String(pharmacy._id))) {
      owner.pharmacyIds = [...(owner.pharmacyIds || []), pharmacy._id];
      changed = true;
    }
    if (!owner.activePharmacyId) {
      owner.activePharmacyId = pharmacy._id;
      changed = true;
    }
    if (!owner.organizationId) {
      owner.organizationId = organization._id;
      changed = true;
    }
    if (changed) {
      await owner.save();
      count += 1;
    }
  }

  if (logSeed && createdIds.length) {
    await logSeed({
      appName,
      feature: 'pharmapilot',
      modelName: 'Seed',
      schemaPath: path.join(__dirname, 'seed.js'),
      ids: createdIds,
    });
  }

  return { count };
};

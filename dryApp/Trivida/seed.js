/**
 * Seed Trivida — Crée les administrateurs
 *
 * Utilise les variables d'environnement :
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 *
 * Ajoute un superadmin par défaut :
 *   SEED_SUPERADMIN_EMAIL, SEED_SUPERADMIN_PASSWORD, SEED_SUPERADMIN_NAME
 *
 * Convention : additif uniquement, ne supprime rien.
 */

module.exports = async ({ appName, getModel, logSeed }) => {
    const User = getModel(appName, 'User');

    // ─── SUPERADMIN ────────────────────────────────────────────────────────
    const superadminEmail = process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@trivida.app';
    const superadminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'Trivida@2026';
    const superadminName = process.env.SEED_SUPERADMIN_NAME || 'Super Admin Trivida';

    const existingSuperadmin = await User.findOne({ email: superadminEmail }).select('+password');
    if (!existingSuperadmin) {
        const sa = await User.create({
            name: superadminName,
            email: superadminEmail,
            password: superadminPassword,
            telephone: '+242060000000',
            role: 'superadmin',
            status: 'active',
        });
        logSeed({ appName, feature: 'admin', modelName: 'User', schemaPath: 'auth/model/trividaUser.schema.js', ids: [sa._id] });
        console.log(`  ✅ Superadmin créé : ${superadminEmail} / ${superadminPassword}`);
    } else {
        // Mettre à jour le role si nécessaire
        if (existingSuperadmin.role !== 'superadmin') {
            existingSuperadmin.role = 'superadmin';
            await existingSuperadmin.save();
            console.log(`  ✅ Superadmin mis à jour : ${superadminEmail} → role: superadmin`);
        } else {
            console.log(`  ⏭️  Superadmin déjà présent : ${superadminEmail}`);
        }
    }

    // ─── ADMIN ─────────────────────────────────────────────────────────────
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@trivida.app';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Trivida@2026';
    const adminName = process.env.SEED_ADMIN_NAME || 'Admin Trivida';

    const existingAdmin = await User.findOne({ email: adminEmail }).select('+password');
    if (!existingAdmin) {
        const adm = await User.create({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            telephone: '+242060000001',
            role: 'admin',
            status: 'active',
        });
        logSeed({ appName, feature: 'admin', modelName: 'User', schemaPath: 'auth/model/trividaUser.schema.js', ids: [adm._id] });
        console.log(`  ✅ Admin créé : ${adminEmail} / ${adminPassword}`);
    } else {
        console.log(`  ⏭️  Admin déjà présent : ${adminEmail}`);
    }
};

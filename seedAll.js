require('dotenv').config();

const path = require('path');
const fs = require('fs');

const { connectCluster } = require('./dry/config/connection/dbConnection');
const getModel = require('./dry/core/modelFactory');
const { getAppNames } = require('./dry/core/appScanner');

const seedAdminForApp = async (appName) => {
    const User = getModel(appName, 'User');

    const baseEmail = process.env.SEED_ADMIN_EMAIL || 'admin@admin.com';
    const baseName = process.env.SEED_ADMIN_NAME || 'Admin';
    const basePassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@2026';

    const adminEmail = process.env[`SEED_${appName.toUpperCase()}_ADMIN_EMAIL`] || baseEmail;
    const adminName = process.env[`SEED_${appName.toUpperCase()}_ADMIN_NAME`] || `${baseName} ${appName}`;
    const adminPassword = process.env[`SEED_${appName.toUpperCase()}_ADMIN_PASSWORD`] || basePassword;

    const existing = await User.findOne({ email: adminEmail }).lean();
    if (existing) return existing;

    const admin = new User({
        name: adminName,
        nom: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        status: 'active',
    });

    await admin.save();
    return admin;
};

(async () => {
    await connectCluster();

    const apps = getAppNames();
    for (const appName of apps) {
        await seedAdminForApp(appName);

        const seedPath = path.join(__dirname, 'dryApp', appName, 'seed.js');
        if (fs.existsSync(seedPath)) {
            const seedFn = require(seedPath);
            if (typeof seedFn === 'function') {
                await seedFn({ appName, getModel });
            }
        }
    }

    console.log(`✅ Seed terminé pour: ${apps.join(', ')}`);
    process.exit(0);
})().catch((err) => {
    console.error('❌ SeedAll error:', err?.message || err);
    process.exit(1);
});

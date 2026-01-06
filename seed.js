require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { connectCluster } = require('./dry/config/connection/dbConnection');
const getModel = require('./dry/core/modelFactory');
const { getAppNames } = require('./dry/core/appScanner');

const normalizeAppName = (name) => String(name || '').trim();

const seedAdminForApp = async (appName) => {
  const User = getModel(appName, 'User');

  const baseEmail = process.env.SEED_ADMIN_EMAIL || 'admin@admin.com';
  const baseName = process.env.SEED_ADMIN_NAME || 'Admin';
  const basePassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@2026';

  const upper = appName.toUpperCase();

  const adminEmail = process.env[`SEED_${upper}_ADMIN_EMAIL`] || baseEmail;
  const adminName = process.env[`SEED_${upper}_ADMIN_NAME`] || `${baseName} ${appName}`;
  const adminPassword = process.env[`SEED_${upper}_ADMIN_PASSWORD`] || basePassword;

  const existing = await User.findOne({ email: adminEmail }).select('+deleted +status').lean();

  if (existing) {
    if (existing.status === 'deleted' || existing.deleted === true) {
      await User.updateOne(
        { _id: existing._id },
        {
          $set: {
            status: 'active',
            deleted: false,
            deletedAt: null,
            role: 'admin',
            name: adminName,
            nom: adminName,
          },
        },
      );
    }

    return { created: false, email: adminEmail };
  }

  const admin = await User.create({
    name: adminName,
    nom: adminName,
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
    status: 'active',
  });

  return { created: true, email: admin.email };
};

const runAppSeedFile = async (appName) => {
  const seedPath = path.join(__dirname, 'dryApp', appName, 'seed.js');
  if (!fs.existsSync(seedPath)) return;

  const seedFn = require(seedPath);
  if (typeof seedFn !== 'function') return;

  await seedFn({ appName, getModel });
};

(async () => {
  await connectCluster();

  const onlyApp = normalizeAppName(process.env.APP_NAME);
  const apps = onlyApp ? [onlyApp] : getAppNames();

  for (const appName of apps) {
    await seedAdminForApp(appName);
    await runAppSeedFile(appName);
  }

  console.log(`✅ Seed terminé pour: ${apps.join(', ')}`);
  process.exit(0);
})().catch((err) => {
  console.error('❌ Seed error:', err?.message || err);
  process.exit(1);
});

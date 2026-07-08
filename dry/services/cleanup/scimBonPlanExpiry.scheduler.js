const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const config = require('../../../config/database');
const getModel = require('../../core/factories/modelFactory');
const logger = require('../../utils/logging/logger');

const PropertySchema = require('../../../dryApp/SCIM/features/property/model/property.schema');

const APP_NAME = 'SCIM';

const parseBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const getScimAppExists = () => {
    const scimPath = path.join(process.cwd(), 'dryApp', APP_NAME);
    return fs.existsSync(scimPath);
};

let started = false;
let running = false;

// Repasse isBonPlan à false pour les biens dont la date d'expiration est dépassée,
// afin que le badge/prix barré ne reste pas affiché indéfiniment après expiration.
const runScimBonPlanExpiryNow = async () => {
    if (running) return;
    running = true;

    try {
        const Property = getModel(APP_NAME, 'Property', PropertySchema);
        const now = new Date();

        const result = await Property.updateMany(
            { isBonPlan: true, bonPlanExpiresAt: { $ne: null, $lt: now } },
            { $set: { isBonPlan: false } },
        );

        if (result?.modifiedCount) {
            logger(`SCIM bon plan expiry: ${result.modifiedCount} annonce(s) desactivee(s)`, 'info');
        }
    } catch (error) {
        logger(`SCIM bon plan expiry scheduler failure: ${error?.message || String(error)}`, 'error');
    } finally {
        running = false;
    }
};

const startScimBonPlanExpiryScheduler = () => {
    if (started) return;
    started = true;

    if (!getScimAppExists()) return;

    const enabled = parseBool(config.SCIM_BONPLAN_EXPIRY_ENABLED, true);
    if (!enabled) {
        logger('SCIM bon plan expiry scheduler disabled by config', 'info');
        return;
    }

    const expression = String(config.SCIM_BONPLAN_EXPIRY_CRON || '*/5 * * * *').trim();
    cron.schedule(expression, () => {
        runScimBonPlanExpiryNow().catch(() => {});
    });

    setTimeout(() => {
        runScimBonPlanExpiryNow().catch(() => {});
    }, 15000).unref();

    logger(`SCIM bon plan expiry scheduler started (${expression})`, 'info');
};

module.exports = {
    startScimBonPlanExpiryScheduler,
    runScimBonPlanExpiryNow,
};

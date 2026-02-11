const cron = require('node-cron');
const { purgeDeletedAcrossApps } = require('./purgeDeleted.service');
const config = require('../../../config/database');

const startPurgeScheduler = () => {
    const enabled = String(config.PURGE_ENABLED || 'true').toLowerCase();
    if (enabled === 'false' || enabled === '0') return null;

    const days = parseInt(config.PURGE_AFTER_DAYS || '14', 10);
    const schedule = config.PURGE_CRON || '0 3 * * *';

    const task = cron.schedule(
        schedule,
        async () => {
            try {
                await purgeDeletedAcrossApps({ days });
            } catch (_) {}
        },
        { scheduled: true },
    );

    return task;
};

module.exports = { startPurgeScheduler };

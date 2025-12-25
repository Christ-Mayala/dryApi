const cron = require('node-cron');
const { purgeDeletedAcrossApps } = require('./purgeDeleted.service');

const startPurgeScheduler = () => {
    const enabled = String(process.env.PURGE_ENABLED || 'true').toLowerCase();
    if (enabled === 'false' || enabled === '0') return null;

    const days = parseInt(process.env.PURGE_AFTER_DAYS || '14', 10);
    const schedule = process.env.PURGE_CRON || '0 3 * * *';

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

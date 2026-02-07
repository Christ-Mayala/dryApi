const { getTenantDB } = require('../../config/connection/dbConnection');
const { getAppNames } = require('../../core/application/appScanner');

const purgeTenant = async ({ appName, cutoffDate }) => {
    const dbConn = getTenantDB(appName);
    if (!dbConn?.db) return { appName, collections: 0, deleted: 0 };

    const collections = await dbConn.db.listCollections().toArray();

    let deleted = 0;

    for (const c of collections) {
        if (!c?.name) continue;
        try {
            const result = await dbConn.db.collection(c.name).deleteMany({
                deletedAt: { $lte: cutoffDate },
                $or: [{ status: 'deleted' }, { deleted: true }, { isDeleted: true }],
            });
            deleted += result?.deletedCount || 0;
        } catch (_) {}
    }

    return { appName, collections: collections.length, deleted };
};

const purgeDeletedAcrossApps = async ({ days = 14 } = {}) => {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const apps = getAppNames();

    const results = [];
    for (const appName of apps) {
        results.push(await purgeTenant({ appName, cutoffDate }));
    }

    return { cutoffDate, results };
};

module.exports = { purgeDeletedAcrossApps };

require('dotenv').config();

const { connectCluster } = require('../config/connection/dbConnection');
const { purgeDeletedAcrossApps } = require('../services/cleanup/purgeDeleted.service');

(async () => {
    await connectCluster();

    const days = parseInt(process.env.PURGE_AFTER_DAYS || '14', 10);
    const report = await purgeDeletedAcrossApps({ days });

    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});

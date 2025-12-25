const fs = require('fs');
const path = require('path');

const getAppNames = () => {
    const dryAppPath = path.join(__dirname, '../../dryApp');
    if (!fs.existsSync(dryAppPath)) return [];

    return fs
        .readdirSync(dryAppPath)
        .filter((name) => name && !name.startsWith('.') && fs.statSync(path.join(dryAppPath, name)).isDirectory());
};

module.exports = { getAppNames };

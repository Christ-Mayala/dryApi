const fs = require('fs');
const path = require('path');

// Logger fichier simple en plus de la console
const logToFile = (message, type = 'info') => {
    const logDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    
    const logFile = path.join(logDir, `${type}.log`);
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    
    fs.appendFile(logFile, entry, (err) => {
        if (err) console.error('Erreur écriture log fichier');
    });
};

const logger = (message, type = 'info') => {
    const prefix = `[${type.toUpperCase()}]`;
    console.log(`${prefix} ${message}`);
    logToFile(message, type);
};

module.exports = logger;
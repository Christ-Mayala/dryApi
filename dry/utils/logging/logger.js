const fs = require('fs');
const path = require('path');

// Formatage date lisible
const formatHumanDate = (date = new Date()) => {
    const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return date.toLocaleString('fr-FR', options);
};

const getLabel = (type) => {
    const labels = {
        info: 'INFO',
        error: 'ERROR',
        warning: 'WARN',
        success: 'OK',
        debug: 'DEBUG'
    };
    return labels[type] || 'LOG';
};

// Logger fichier simple en plus de la console
const logToFile = (message, type = 'info') => {
    const logDir = path.join(__dirname, '../../../logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

    const logFile = path.join(logDir, `${type}.log`);
    const humanDate = formatHumanDate();
    const label = getLabel(type);
    const entry = `[${humanDate}] [${label}] ${message}\n`;

    fs.appendFile(logFile, entry, (err) => {
        if (err) console.error('Erreur ecriture log fichier');
    });
};

const logger = (message, type = 'info') => {
    const humanDate = formatHumanDate();
    const label = getLabel(type);

    const colors = {
        info: '\x1b[46m\x1b[30m',
        error: '\x1b[41m\x1b[37m',
        warning: '\x1b[43m\x1b[30m',
        success: '\x1b[42m\x1b[30m',
        debug: '\x1b[47m\x1b[30m',
        reset: '\x1b[0m'
    };

    const badge = `${colors[type] || colors.info} ${label} ${colors.reset}`;
    const line = `${badge} [${humanDate}] ${message}`;
    console.log(line);
    logToFile(message, type);
};

module.exports = logger;

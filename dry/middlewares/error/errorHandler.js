const sendResponse = require('../../utils/response');
const logger = require('../../utils/logger');
const AuditLog = require('../../models/AuditLog.model');

const errorHandler = async (err, req, res, next) => {
    const route = `${req.method} ${req.originalUrl}`;
    const stack = err?.stack || err?.message || String(err);
    logger(`${route}\n${stack}`, 'error');

    // Mise à jour de l'audit log si l'utilisateur était connecté (Optionnel)
    if(req.user) {
        // Logique complexe pour retrouver le dernier audit log et le passer en failed...
        // Simplification ici : on log juste l'erreur
    }

    let message = err.message || 'Erreur Serveur';

    // Erreurs Multer (upload)
    if (err.code === 'LIMIT_FILE_SIZE') message = 'Fichier trop volumineux (max 10MB).';

    // Erreurs Mongoose courantes
    if (err.code === 11000) message = 'Valeur dupliquée détectée (Doublon)';
    if (err.name === 'ValidationError') message = Object.values(err.errors).map(val => val.message).join(', ');
    if (err.name === 'CastError') message = 'Ressource introuvable (ID invalide)';

    // TOUJOURS renvoyer 200 avec success: false
    return sendResponse(res, null, message, false);
};

module.exports = errorHandler;
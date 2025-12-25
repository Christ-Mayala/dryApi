/**
 * Envoi standardisé. TOUJOURS 200 OK.
 * Le frontend doit vérifier `success: true` ou `false`.
 */
const sendResponse = (res, data = null, message = 'Opération réussie', success = true) => {
    return res.status(200).json({
        success,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};
module.exports = sendResponse;
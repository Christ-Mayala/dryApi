/**
 * Envoi standardise. Par défaut 200 OK.
 * Le frontend doit verifier `success: true` ou `false`.
 */
const sendResponse = (res, data = null, message = 'Operation reussie', success = true, pagination = undefined, status = 200) => {
    const payload = {
        success,
        message,
        data,
        timestamp: new Date().toISOString(),
    };

    if (pagination) payload.pagination = pagination;

    if (res?.locals?.requestId) {
        payload.requestId = res.locals.requestId;
    }

    // Si success=false et qu'on n'a pas précisé de status d'erreur, on garde 200 (compatibilité)
    // Mais on encourage maintenant à passer un status explicite (ex: 401, 403, 404)
    return res.status(status).json(payload);
};
module.exports = sendResponse;

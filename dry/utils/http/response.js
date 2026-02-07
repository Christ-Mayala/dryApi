/**
 * Envoi standardise. TOUJOURS 200 OK.
 * Le frontend doit verifier `success: true` ou `false`.
 */
const sendResponse = (res, data = null, message = 'Operation reussie', success = true, pagination = undefined) => {
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

    return res.status(200).json(payload);
};
module.exports = sendResponse;

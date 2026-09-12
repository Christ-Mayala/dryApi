/**
 * Crée une Error porteuse d'un statusCode HTTP explicite.
 * Permet à dry/middlewares/error/errorHandler.js de renvoyer le bon code
 * HTTP et de ne PAS alerter (email/Slack/Discord) sur des erreurs métier
 * attendues (mauvais mot de passe, email déjà utilisé, etc.) — seules les
 * erreurs sans statusCode (bugs réels, 5xx) déclenchent une alerte par défaut.
 *
 * Optionnel : `apiCode` expose un code métier stable au client (ex: REFERRAL_*)
 * pour distinguer programmatiquement les cas d'erreur sans parser le message.
 * @module dry/utils/http/httpError
 */
const httpError = (message, statusCode = 400, apiCode = undefined) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (apiCode) err.apiCode = apiCode;
  return err;
};

module.exports = { httpError };
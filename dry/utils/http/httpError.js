/**
 * Crée une Error porteuse d'un statusCode HTTP explicite.
 * Permet à dry/middlewares/error/errorHandler.js de renvoyer le bon code
 * HTTP et de ne PAS alerter (email/Slack/Discord) sur des erreurs métier
 * attendues (mauvais mot de passe, email déjà utilisé, etc.) — seules les
 * erreurs sans statusCode (bugs réels, 5xx) déclenchent une alerte par défaut.
 * @module dry/utils/http/httpError
 */
const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

module.exports = { httpError };

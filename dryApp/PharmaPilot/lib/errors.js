/**
 * Erreur HTTP applicative PharmaPilot.
 * Le handler global (dry/) lit `statusCode` pour produire la reponse standard.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (details) this.details = details;
  }
}

const badRequest = (message, details) => new AppError(message, 400, details);
const unauthorized = (message = 'Non autorise') => new AppError(message, 401);
const forbidden = (message = 'Acces refuse') => new AppError(message, 403);
const notFound = (message = 'Ressource introuvable') => new AppError(message, 404);
const conflict = (message, details) => new AppError(message, 409, details);
const unprocessable = (message, details) => new AppError(message, 422, details);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, unprocessable };

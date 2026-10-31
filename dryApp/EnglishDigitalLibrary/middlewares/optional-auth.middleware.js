const asyncHandler = require('express-async-handler');
const { verifyToken } = require('../../../dry/utils/auth/jwt.util');

/** Résout un utilisateur connecté sans rendre les routes publiques obligatoirement privées. */
module.exports = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    try {
      const decoded = verifyToken(authorization.slice(7));
      req.user = await req.getModel('User').findById(decoded.id).select('-password');
    } catch (_) {
      // Un jeton invalide ne donne jamais accès aux documents réservés.
    }
  }
  next();
});

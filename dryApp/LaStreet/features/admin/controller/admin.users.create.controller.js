const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');

  const { name, email, password, role, telephone } = req.body || {};

  // 🔥 VALIDATIONS RENFORCÉES
  if (!name || String(name).trim().length < 2) {
    throw new Error('Le nom doit contenir au moins 2 caractères');
  }

  if (!email || !String(email).includes('@')) {
    throw new Error('Email invalide');
  }

  // Validation email plus stricte
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email).toLowerCase())) {
    throw new Error('Format email invalide');
  }

  if (!password || String(password).length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères');
  }

  // 🔥 Validation de force du mot de passe (optionnel mais recommandé)
  if (String(password).length < 8) {
    throw new Error('Pour votre sécurité, utilisez un mot de passe d\'au moins 8 caractères');
  }

  // 🔥 Nettoyage et normalisation
  const cleanEmail = String(email).toLowerCase().trim();
  const cleanName = String(name).trim();
  const cleanTelephone = telephone ? String(telephone).trim().replace(/\s+/g, '') : null;

  // Validation téléphone si fourni
  if (cleanTelephone && !/^[0-9+\-\s]{8,20}$/.test(cleanTelephone)) {
    throw new Error('Numéro de téléphone invalide');
  }

  // 🔥 Vérifier si l'email existe (y compris les comptes supprimés)
  // On désactive temporairement le middleware pour vérifier même les deleted
  const exists = await User.findOne({
    email: cleanEmail
  }).select('+deleted +status'); // Forcer l'inclusion des champs cachés

  if (exists) {
    // Vérifier si le compte est supprimé
    if (exists.status === 'deleted' || exists.deleted === true) {
      throw new Error('Cet email était associé à un compte supprimé. Contactez l\'administrateur pour le restaurer.');
    }
    throw new Error('Cet email est déjà utilisé');
  }

  // 🔥 Rôle par défaut sécurisé
  const allowedRoles = ['user', 'admin', 'moderator']; // À adapter
  const userRole = role && allowedRoles.includes(role) ? role : 'user';

  // 🔥 Création avec valeurs nettoyées
  const created = await User.create({
    name: cleanName,
    nom: cleanName, // Tu gardes les deux champs pour compatibilité
    email: cleanEmail,
    password: String(password),
    role: userRole,
    telephone: cleanTelephone,
    // 🔥 Status explicite
    status: 'active', // ou 'pending' si tu as une validation par email
  });

  // 🔥 Exclure le mot de passe de la réponse
  const userResponse = created.toObject();
  delete userResponse.password;
  delete userResponse.refreshTokens;
  delete userResponse.resetCode;

  return sendResponse(res, userResponse, 'Utilisateur créé avec succès');
});
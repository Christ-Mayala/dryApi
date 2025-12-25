const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');

  const { name, email, password, role, telephone } = req.body || {};

  if (!name || String(name).trim().length < 2) throw new Error('Nom requis');
  if (!email || !String(email).includes('@')) throw new Error('Email requis');
  if (!password || String(password).length < 6) throw new Error('Mot de passe requis (6+)');

  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) throw new Error('Cet email est déjà utilisé');

  const created = await User.create({
    name: String(name).trim(),
    nom: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password: String(password),
    role: role || 'user',
    telephone: telephone ? String(telephone).trim() : undefined,
  });

  return sendResponse(res, created, 'Utilisateur créé');
});

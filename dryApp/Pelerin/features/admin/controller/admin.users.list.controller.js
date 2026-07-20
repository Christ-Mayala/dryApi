const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

// Echappe les caracteres speciaux regex avant de construire un $regex a partir
// d'une entree utilisateur libre — sans ca, un pattern a backtracking
// catastrophique (ex: "(a+)+$") peut bloquer le thread Mongo en evaluation
// (ReDoS). La recherche reste "contient, insensible a la casse" pour
// l'utilisateur, juste sans interpretation des metacaracteres regex.
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /admin/users?search=&page=&limit= — reserve aux admins Pelerin.
// Recherche simple sur name/email, pagination manuelle (pas de contenu volumineux
// attendu pour ce tenant, pas besoin du middleware advancedResults generique).
module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const search = (req.query.search || '').trim();

  const filter = search
    ? {
        $or: [
          { name: { $regex: escapeRegex(search), $options: 'i' } },
          { email: { $regex: escapeRegex(search), $options: 'i' } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name email role status createdAt lastLogin')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return sendResponse(res, users, 'Utilisateurs recuperes', true, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

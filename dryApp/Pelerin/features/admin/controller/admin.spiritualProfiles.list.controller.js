const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const SpiritualProfileSchema = require('../../spiritual-profile/model/spiritualProfile.schema');

// Echappe les caracteres speciaux regex avant de construire un $regex a partir
// d'une entree utilisateur libre — meme protection ReDoS que
// admin.users.list.controller.js (voir la note la-bas).
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /admin/spiritual-profiles?search=&page=&limit= — reserve aux admins.
// Liste tous les profils spirituels (identite spirituelle statique de chaque
// utilisateur) avec les infos du compte associe (name/email), pour la
// moderation : reperer un contenu inapproprie, le supprimer, etc.
module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');
  const Model = req.getModel('SpiritualProfile', SpiritualProfileSchema);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const search = (req.query.search || '').trim();

  let filter = {};
  if (search) {
    // La recherche porte sur le compte (name/email), pas sur le contenu du
    // profil : on trouve d'abord les utilisateurs correspondants, puis on
    // filtre les profils sur leurs createdBy.
    const users = await User.find({
      $or: [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { email: { $regex: escapeRegex(search), $options: 'i' } },
      ],
    }).select('_id');
    filter = { createdBy: { $in: users.map((u) => String(u._id)) } };
  }

  // skipAutoPopulate : le plugin DRY auto-popule createdBy/updatedBy (qui
  // deviennent des objets User) — on veut ici l'id brut pour faire notre propre
  // jointure manuelle avec User (et pouvoir masquer certains champs).
  const [profiles, total] = await Promise.all([
    Model.find(filter)
      .setOptions({ skipAutoPopulate: true })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Model.countDocuments(filter),
  ]);

  // Jointure manuelle avec User : createdBy est un String (pas un ObjectId
  // reference), donc pas de populate mongoose possible.
  const userIds = [...new Set(profiles.map((p) => String(p.createdBy)))];
  const users = await User.find({ _id: { $in: userIds } }).select('name email status role');
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const items = profiles.map((p) => {
    const doc = p.toObject();
    const user = userById.get(String(p.createdBy));
    return {
      ...doc,
      user: user
        ? { _id: String(user._id), name: user.name, email: user.email, status: user.status, role: user.role }
        : null,
    };
  });

  return sendResponse(res, items, 'Profils spirituels recuperes', true, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

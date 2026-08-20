const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const SpiritualProfileSchema = require('../../spiritual-profile/model/spiritualProfile.schema');

// DELETE /admin/spiritual-profiles/:id — moderation : supprime le profil
// spirituel d'un utilisateur (contenu inapproprie, doublon, compte supprime...).
// Ne supprime pas le compte utilisateur, juste son profil.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('SpiritualProfile', SpiritualProfileSchema);

  const profile = await Model.findById(req.params.id);
  if (!profile) throw httpError('Profil spirituel introuvable', 404);

  await Model.deleteOne({ _id: profile._id });

  return sendResponse(res, null, 'Profil spirituel supprime');
});

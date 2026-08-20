const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ParcoursProgressSchema = require('../model/parcoursProgress.schema');
const ParcoursSchema = require('../../parcours/model/parcours.schema');

module.exports = asyncHandler(async (req, res) => {
  // Enregistre les deux modèles sur la connexion tenant avant le populate :
  // Mongoose exige que le modèle référencé soit connu de la même connexion.
  req.getModel('Parcours', ParcoursSchema);
  const Model = req.getModel('ParcoursProgress', ParcoursProgressSchema);
  const items = await Model.find({ createdBy: req.user.id })
    .populate('parcoursId')
    .sort({ updatedAt: -1 });
  return sendResponse(res, items, 'Progressions recuperees');
});

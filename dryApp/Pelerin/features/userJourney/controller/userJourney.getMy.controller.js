const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const UserJourneySchema = require('../model/userJourney.schema');

module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('UserJourney', UserJourneySchema);
  const journey = await Model.findOne({ createdBy: req.user.id });

  // Pas encore de progression = etat NORMAL pour un utilisateur nouveau ou
  // inactif, pas une erreur : on renvoie 200 avec data:null (sinon axios jette
  // une exception cote client et le log serveur se remplit d'ERROR 404 a
  // chaque ouverture de l'ecran profil + retries react-query).
  return sendResponse(res, journey ?? null, journey ? 'Progression recuperee' : 'Aucune progression pour le moment');
});

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PropertySchema = require('../model/property.schema');

module.exports = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const Property = req.getModel('Property', PropertySchema);

    const property = await Property.findById(id).select('isDeleted evaluations');
    if (!property || property.isDeleted) {
      return sendResponse(res, null, 'Propriete non trouvee', false, 404);
    }

    const userRating = (property.evaluations || []).find(
      (entry) => entry.utilisateur && entry.utilisateur.toString() === userId.toString(),
    );

    if (userRating) {
      return sendResponse(
        res,
        {
          note: Number(userRating.note) || 0,
          ratedAt: userRating.creeLe || null,
        },
        'Note utilisateur recuperee avec succes',
      );
    }

    return sendResponse(
      res,
      {
        note: 0,
        ratedAt: null,
      },
      'Aucune note trouvee pour cette propriete',
    );
  } catch (error) {
    console.error('Erreur lors de la recuperation de la note utilisateur:', error);
    return sendResponse(res, null, 'Erreur serveur lors de la recuperation de la note', false, 500);
  }
});

/**
 * @swagger
 * /api/v1/scim/property/{id}/user-note:
 *   get:
 *     summary: Récupérer la note de l'utilisateur pour une propriété
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Note de l'utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Aucune note trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PropertySchema = require('../model/property.schema');

module.exports = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Vérifier si la propriété existe
    const property = await PropertySchema.findById(id);
    if (!property) {
      return sendResponse(res, null, 'Propriété non trouvée', false, 404);
    }

    // Chercher si l'utilisateur a déjà noté cette propriété
    const userRating = property.ratings?.find(rating => 
      rating.userId && rating.userId.toString() === userId.toString()
    );

    if (userRating) {
      return sendResponse(res, { 
        note: userRating.rating,
        ratedAt: userRating.createdAt || userRating.ratedAt
      }, 'Note utilisateur récupérée avec succès');
    } else {
      return sendResponse(res, { 
        note: 0,
        ratedAt: null
      }, 'Aucune note trouvée pour cette propriété');
    }

  } catch (error) {
    console.error('Erreur lors de la récupération de la note utilisateur:', error);
    return sendResponse(res, null, 'Erreur serveur lors de la récupération de la note', false, 500);
  }
});

/**
 * @swagger
 * /api/v1/scim/reservation/{id}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'une réservation
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: status
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *               enum: [en_attente, confirmee, annulee, terminee]
 *     responses:
 *       200:
 *         description: Statut mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

const ReservationSchema = require('../model/reservation.schema');
const protect = require('../../../../../dry/middlewares/protection/auth.middleware');

const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validation du statut
    const statusValides = ['en_attente', 'confirmee', 'annulee', 'terminee'];
    if (!statusValides.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide. Statuts valides: en_attente, confirmee, annulee, terminee',
        data: null
      });
    }

    // Vérifier si la réservation existe
    const reservation = await ReservationSchema.findById(id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée',
        data: null
      });
    }

    // Mettre à jour le statut
    const updatedReservation = await ReservationSchema.findByIdAndUpdate(
      id,
      { 
        status,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Statut de la réservation mis à jour avec succès',
      data: updatedReservation
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut de la réservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour du statut',
      data: null
    });
  }
};

module.exports = updateReservationStatus;

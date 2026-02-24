const express = require('express');
/**
 * @swagger
 * /api/v1/scim/reservation:
 *   get:
 *     summary: Lister Reservation
 *     tags: [SCIM]
 *     responses:
 *       200:
 *         description: Liste Reservation
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
 *   post:
 *     summary: Creer Reservation
 *     tags: [SCIM]
 *     responses:
 *       200:
 *         description: Reservation cree
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
 *
 * /api/v1/scim/reservation/{id}:
 *   get:
 *     summary: Recuperer Reservation par ID
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reservation recupere
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
 *   put:
 *     summary: Mettre a jour Reservation
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reservation mis a jour
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
 *   delete:
 *     summary: Supprimer Reservation
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reservation supprime
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



const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');

const createReservation = require('../controller/reservation.create.controller');
const getMyReservations = require('../controller/reservation.my.controller');
const getOwnerReservations = require('../controller/reservation.owner.controller');
const cancelReservation = require('../controller/reservation.cancel.controller');
const confirmReservation = require('../controller/reservation.confirm.controller');
const acknowledgeReservation = require('../controller/reservation.ack.controller');
const getReservationById = require('../controller/reservation.get.controller');






router.post('/', protect, createReservation);







router.get('/my', protect, getMyReservations);







router.get('/owner', protect, getOwnerReservations);







router.patch('/:id/cancel', protect, cancelReservation);







router.patch('/:id/confirm', protect, confirmReservation);







router.patch('/:id/ack', protect, acknowledgeReservation);







router.get('/:id', protect, getReservationById);



module.exports = router;

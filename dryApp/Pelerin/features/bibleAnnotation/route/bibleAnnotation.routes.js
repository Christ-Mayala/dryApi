const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const upsert = require('../controller/bibleAnnotation.upsert.controller');
const getAll = require('../controller/bibleAnnotation.getAll.controller');
const getByVerse = require('../controller/bibleAnnotation.getByVerse.controller');
const remove = require('../controller/bibleAnnotation.delete.controller');

// Toutes les routes sont privees : une annotation n'a de sens que pour son auteur.
router.use(protect);

/**
 * @swagger
 * /api/v1/pelerin/bibleannotation/verse:
 *   get:
 *     summary: Recuperer mon annotation pour un verset precis
 *     tags: [Pelerin - Bible]
 *     parameters:
 *       - in: query
 *         name: version
 *         required: true
 *         schema: { type: string, enum: [LSG1910, DARBY, KJV] }
 *       - in: query
 *         name: bookCode
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: chapter
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: verse
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Annotation (ou null)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.get('/verse', getByVerse);

/**
 * @swagger
 * /api/v1/pelerin/bibleannotation:
 *   get:
 *     summary: Lister mes annotations (favoris, surlignages, notes)
 *     tags: [Pelerin - Bible]
 *     responses:
 *       200:
 *         description: Liste de mes annotations
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *   post:
 *     summary: Creer ou mettre a jour mon annotation pour un verset (upsert)
 *     tags: [Pelerin - Bible]
 *     responses:
 *       200:
 *         description: Annotation enregistree
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.get('/', getAll);
router.post('/', withAudit('BIBLEANNOTATION_UPSERT'), upsert);

router.delete('/:id', validateId, withAudit('BIBLEANNOTATION_DELETE'), remove);

module.exports = router;

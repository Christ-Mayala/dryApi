const express = require('express');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const ProductSchema = require('../model/product.schema');
const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');
const { validateSpiritEmeraude } = require('../../../validation/middleware');

/**
 * @swagger
 * /api/v1/spiritemeraude/product:
 *   get:
 *     summary: Lister Product
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Liste Product
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
 *     summary: Creer Product
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Product cree
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
 * /api/v1/spiritemeraude/product/{id}:
 *   get:
 *     summary: Recuperer Product par ID
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product recupere
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
 *     summary: Mettre a jour Product
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product mis a jour
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
 *     summary: Supprimer Product
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product supprime
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

// Utilisation du Router Factory "DRY" pour générer toutes les routes CRUD
// Cela remplace les 5 fichiers de contrôleurs et l'assemblage manuel
const router = buildCrudRouter('Product', ProductSchema, {
  auth: {
    create: 'admin',
    update: 'admin',
    delete: 'admin'
  },
  caching: {
    list: 300,
    get: 600
  },
  upload: upload.array('images', 5),
  validation: {
    create: validateSpiritEmeraude.product.create,
    update: validateSpiritEmeraude.product.update
  },
  crudOptions: {
    // On transforme l'input pour inclure les images Cloudinary (DRY)
    transformInput: async ({ req, payload }) => {
      if (req.files && req.files.length > 0) {
        payload.images = req.files.map(file => file.path);
      }
      return payload;
    }
  }
});

module.exports = router;

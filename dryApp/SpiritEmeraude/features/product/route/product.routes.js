const express = require('express');
const router = express.Router();
const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const queryBuilder = require('../../../../../dry/middlewares/queryBuilder');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const ProductSchema = require('../model/product.schema');

// Contrôleurs spécifiques produit
const create = require('../controller/product.create.controller');
const list = require('../controller/product.list.controller');
const get = require('../controller/product.get.controller');
const update = require('../controller/product.update.controller');
const remove = require('../controller/product.delete.controller');

// Injection du modèle dynamique pour ce tenant
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Product', ProductSchema);
  next();
};

// Query builder générique réutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// Routes publiques (lecture seule)
router.get('/', setupModel, dynamicQB, list);
router.get('/:id', get);

// Routes admin sécurisées (écriture avec audit et rôle admin)
router.post(
  '/',
  protect,
  authorize('admin'),
  upload.array('images', 5),
  withAudit('PRODUCT_CREATE'),
  create,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  upload.array('images', 5),
  withAudit('PRODUCT_UPDATE'),
  update,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  withAudit('PRODUCT_DELETE'),
  remove,
);

module.exports = router;

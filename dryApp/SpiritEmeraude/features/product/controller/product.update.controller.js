const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ProductSchema = require('../model/product.schema');

// Contrôleur de mise à jour produit compatible avec les uploads Cloudinary.
// - Si des fichiers sont fournis, on remplace entièrement la liste images.
// - Sinon, on conserve les images existantes.
const updateProduct = asyncHandler(async (req, res) => {
  const Product = req.getModel('Product', ProductSchema);

  let update = { ...req.body };

  if (req.files && req.files.length > 0) {
    update.images = req.files.map((file) => file.path);
  }

  const product = await Product.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    throw new Error('Produit introuvable');
  }

  sendResponse(res, product, 'Produit mis à jour');
});

module.exports = updateProduct;

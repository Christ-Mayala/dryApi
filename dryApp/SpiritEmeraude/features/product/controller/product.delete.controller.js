const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ProductSchema = require('../model/product.schema');

const deleteProduct = asyncHandler(async (req, res) => {
    const Product = req.getModel('Product', ProductSchema);
    const product = await Product.findById(req.params.id);

    if (!product) throw new Error('Produit introuvable');

    // Soft Delete (Status -> deleted)
    product.status = 'deleted';
    product.deletedAt = new Date();
    await product.save();

    sendResponse(res, null, 'Produit retiré de la boutique');
});
module.exports = deleteProduct;
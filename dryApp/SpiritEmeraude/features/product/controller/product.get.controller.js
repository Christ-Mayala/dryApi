const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ProductSchema = require('../model/product.schema');

const getProduct = asyncHandler(async (req, res) => {
    const Product = req.getModel('Product', ProductSchema);
    // Recherche par ID ou par Slug
    const isId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isId ? { _id: req.params.id } : { slug: req.params.id };

    const product = await Product.findOne(query);
    if (!product) throw new Error('Produit introuvable');

    sendResponse(res, product, 'Détails du produit');
});
module.exports = getProduct;
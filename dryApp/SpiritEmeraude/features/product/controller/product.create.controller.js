const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const ProductSchema = require('../model/product.schema');

const createProduct = asyncHandler(async (req, res) => {
    const Product = req.getModel('Product', ProductSchema);
    
    // Gestion Upload Multiple
    let imagePaths = [];
    if (req.files && req.files.length > 0) {
        imagePaths = req.files.map(file => file.path);
    }

    const product = await Product.create({
        ...req.body,
        images: imagePaths
    });

    sendResponse(res, product, 'Produit ajouté à la boutique');
});
module.exports = createProduct;
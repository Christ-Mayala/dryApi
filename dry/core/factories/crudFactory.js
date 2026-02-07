const asyncHandler = require('express-async-handler');
const sendResponse = require('../../utils/http/response');

// Fabrique de contrôleurs CRUD génériques pour un modèle Mongoose dynamique.
// Utilisation typique dans une feature :
//   const ProductSchema = require('../model/product.schema');
//   const { createOne, updateOne, deleteOne } = buildCrudHandlers('Product', ProductSchema);
//   router.post('/', protect, authorize('admin'), upload.array('images', 5), createOne);
//
// Chaque handler s'appuie sur req.getModel(appName, name) fourni par le bootloader DRY.

function buildCrudHandlers(modelName, schema, options = {}) {
  const {
    // transformInput permet d'adapter la payload (ex: ajout des URLs Cloudinary)
    transformInput,
  } = options;

  const createOne = asyncHandler(async (req, res) => {
    const Model = req.getModel(modelName, schema);

    let payload = { ...req.body };
    if (transformInput) {
      payload = await transformInput({ req, mode: 'create', payload });
    }

    const doc = await Model.create(payload);
    sendResponse(res, doc, `${modelName} créé`, true);
  });

  const updateOne = asyncHandler(async (req, res) => {
    const Model = req.getModel(modelName, schema);

    let payload = { ...req.body };
    if (transformInput) {
      payload = await transformInput({ req, mode: 'update', payload });
    }

    const doc = await Model.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      throw new Error(`${modelName} introuvable`);
    }

    sendResponse(res, doc, `${modelName} mis à jour`, true);
  });

  const deleteOne = asyncHandler(async (req, res) => {
    const Model = req.getModel(modelName, schema);
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      throw new Error(`${modelName} introuvable`);
    }

    sendResponse(res, null, `${modelName} supprimé`, true);
  });

  return { createOne, updateOne, deleteOne };
}

module.exports = { buildCrudHandlers };

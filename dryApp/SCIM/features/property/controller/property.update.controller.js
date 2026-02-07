const asyncHandler = require('express-async-handler');
const cloudinary = require('cloudinary').v2;
const sendResponse = require('../../../../../dry/utils/http/response');
const { pickDefined } = require('../../../../../dry/utils/data/pick');

const PropertySchema = require('../model/property.schema');

const toImages = (files = []) => {
    return files
        .filter((f) => f && (f.path || f.filename))
        .map((f) => ({ url: f.path, public_id: f.filename }));
};

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    const property = await Property.findById(req.params.id);
    if (!property || property.isDeleted) return sendResponse(res, null, 'Bien introuvable.', false);

    const isAdmin = req.user.role === 'admin';
    if (!isAdmin) {
        return sendResponse(res, null, 'Non autorisé.', false);
    }

    if (req.files && req.files.length > 0) {
        for (const img of property.images || []) {
            if (img.public_id) {
                try {
                    await cloudinary.uploader.destroy(img.public_id);
                } catch (_) {}
            }
        }
        property.images = toImages(req.files);
    }

    const updates = pickDefined(req.body, [
        'titre',
        'description',
        'prix',
        'prixOriginal',
        'devise',
        'ville',
        'adresse',
        'transactionType',
        'categorie',
        'isBonPlan',
        'bonPlanLabel',
        'bonPlanExpiresAt',
        'nombre_chambres',
        'nombre_salles_bain',
        'nombre_salons',
        'superficie',
        'garage',
        'gardien',
        'balcon',
        'piscine',
        'jardin',
    ]);

    Object.assign(property, updates);

    if (req.body?.status) {
        property.status = req.body.status;
    }

    await property.save();

    return sendResponse(res, property, 'Bien mis à jour avec succès.');
});

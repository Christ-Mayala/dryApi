const asyncHandler = require('express-async-handler');
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

    if (!req.files || !req.files.images || req.files.images.length === 0) {
        return sendResponse(res, null, 'Au moins une image est requise pour une propriété.', 400);
    }


    const payload = {
        ...pickDefined(req.body, [
            'titre',
            'description',
            'prix',
            'prixOriginal',
            'devise',
            'ville',
            'adresse',
            'transactionType',
            'categorie',
            'status',
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
        ]),
        images: toImages(req.files.images),
        utilisateur: req.user.id,
    };

    const property = await Property.create(payload);
    return sendResponse(res, property, 'Annonce créée avec succès.');
});

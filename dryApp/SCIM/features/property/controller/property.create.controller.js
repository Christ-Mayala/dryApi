const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const { pickDefined } = require('../../../../../dry/utils/pick');

const PropertySchema = require('../model/property.schema');

const toImages = (files = []) => {
    return files
        .filter((f) => f && (f.path || f.filename))
        .map((f) => ({ url: f.path, public_id: f.filename }));
};

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    if (!req.files || req.files.length === 0) {
        return sendResponse(res, null, 'Aucune image téléchargée.', false);
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
        images: toImages(req.files),
        utilisateur: req.user.id,
    };

    const property = await Property.create(payload);
    return sendResponse(res, property, 'Annonce créée avec succès.');
});

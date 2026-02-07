const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const AtelierSchema = require('../model/atelier.schema');

const getAtelier = asyncHandler(async (req, res) => {
    const Atelier = req.getModel('Atelier', AtelierSchema);
    const atelier = await Atelier.findById(req.params.id);
    if (!atelier) throw new Error('Atelier introuvable');
    sendResponse(res, atelier, 'Détails atelier');
});
module.exports = getAtelier;

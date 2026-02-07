const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const AtelierSchema = require('../model/atelier.schema');

const deleteAtelier = asyncHandler(async (req, res) => {
    const Atelier = req.getModel('Atelier', AtelierSchema);
    const atelier = await Atelier.findById(req.params.id);
    if (!atelier) throw new Error('Introuvable');
    
    await Atelier.findByIdAndDelete(req.params.id);
    sendResponse(res, null, 'Atelier supprimé');
});
module.exports = deleteAtelier;

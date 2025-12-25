const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const PropertySchema = require('../model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    const property = await Property.findById(req.params.id);
    if (!property || property.isDeleted) return sendResponse(res, null, 'Bien introuvable.', false);

    const note = Number(req.body.rating);
    if (!note || note < 1 || note > 5) return sendResponse(res, null, 'Note invalide (1-5).', false);

    const existing = (property.evaluations || []).find((e) => e.utilisateur?.toString() === req.user.id);
    if (existing) {
        existing.note = note;
    } else {
        property.evaluations = property.evaluations || [];
        property.evaluations.push({ utilisateur: req.user.id, note });
    }

    const total = property.evaluations.reduce((acc, cur) => acc + cur.note, 0);
    property.noteMoyenne = property.evaluations.length ? total / property.evaluations.length : 0;

    await property.save();
    return sendResponse(res, { noteMoyenne: property.noteMoyenne }, 'Note mise à jour.');
});

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const PropertySchema = require('../model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);

    const property = await Property.findById(req.params.id);
    if (!property || property.isDeleted) return sendResponse(res, null, 'Bien introuvable.', false);

    const note = Number(req.body.rating);
    if (!note || note < 1 || note > 5) return sendResponse(res, null, 'Note invalide (1-5).', false);

    // Vérifier si l'utilisateur a déjà noté cette propriété
    const existing = (property.evaluations || []).find((e) => e.utilisateur?.toString() === req.user.id);
    if (existing) {
        return sendResponse(res, null, 'Vous avez déjà noté cette propriété.', false);
    }

    // Ajouter la nouvelle évaluation
    property.evaluations = property.evaluations || [];
    property.evaluations.push({ 
        utilisateur: req.user.id, 
        note,
        creeLe: new Date()
    });

    // Mettre à jour la moyenne et le nombre d'avis
    const total = property.evaluations.reduce((acc, cur) => acc + cur.note, 0);
    property.noteMoyenne = property.evaluations.length ? total / property.evaluations.length : 0;
    property.nombreAvis = property.evaluations.length;

    await property.save();
    return sendResponse(res, { 
        noteMoyenne: property.noteMoyenne, 
        nombreAvis: property.nombreAvis,
        userNote: note 
    }, 'Note enregistrée avec succès.');
});

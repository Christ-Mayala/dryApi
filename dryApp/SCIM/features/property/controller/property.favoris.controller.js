const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const PropertySchema = require('../model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);
    const User = req.getModel('User');

    const userId = req.user.id;
    const propertyId = req.params.id;

    const [user, property] = await Promise.all([
        User.findById(userId).select('favoris'),
        Property.findById(propertyId).select('favoris isDeleted'),
    ]);

    if (!user || !property || property.isDeleted) return sendResponse(res, null, 'Utilisateur ou bien introuvable.', false);

    const already = (user.favoris || []).some((f) => f.toString() === propertyId);

    if (already) {
        user.favoris = (user.favoris || []).filter((f) => f.toString() !== propertyId);
        property.favoris = (property.favoris || []).filter((u) => u.toString() !== userId);
    } else {
        user.favoris = user.favoris || [];
        property.favoris = property.favoris || [];
        user.favoris.push(propertyId);
        property.favoris.push(userId);
    }

    await Promise.all([user.save(), property.save()]);

    return sendResponse(res, { isFavorite: !already, favoris: user.favoris }, 'Favoris mis à jour.');
});

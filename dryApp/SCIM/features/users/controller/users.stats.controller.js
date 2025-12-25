const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    const Property = req.getModel('Property', PropertySchema);

    const userId = req.user.id;
    const user = await User.findById(userId).select('favoris visited');
    if (!user) return sendResponse(res, null, 'Utilisateur non trouvé.', false);

    const favoritesCount = Array.isArray(user.favoris) ? user.favoris.length : 0;
    const visitedCount = Array.isArray(user.visited) ? user.visited.length : 0;

    const properties = await Property.find({ 'evaluations.utilisateur': userId, isDeleted: false }).select('evaluations');
    let ratingsCount = 0;
    let sum = 0;

    properties.forEach((p) => {
        const evalUser = (p.evaluations || []).find((e) => e.utilisateur.toString() === userId);
        if (evalUser) {
            ratingsCount += 1;
            sum += evalUser.note;
        }
    });

    const avgGiven = ratingsCount > 0 ? sum / ratingsCount : 0;

    return sendResponse(res, { favoritesCount, visitedCount, ratingsCount, avgGiven }, 'Statistiques utilisateur');
});

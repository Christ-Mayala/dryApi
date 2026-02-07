const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    req.getModel('Property', PropertySchema);

    const user = await User.findById(req.user.id).populate('favoris');
    if (!user) return sendResponse(res, null, 'Utilisateur introuvable.', false);

    return sendResponse(res, user.favoris || [], 'Liste des favoris');
});

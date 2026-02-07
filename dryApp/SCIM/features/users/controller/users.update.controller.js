const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const { id } = req.params;
    if (req.user.id !== id && req.user.role !== 'admin') {
        return sendResponse(res, null, 'Accès interdit.', false);
    }

    const user = await User.findById(id);
    if (!user) return sendResponse(res, null, 'Utilisateur non trouvé.', false);

    const { nom, name, email, telephone } = req.body;
    if (nom) user.nom = nom;
    if (name) user.name = name;
    if (email) user.email = email;
    if (telephone) user.telephone = telephone;

    await user.save();

    return sendResponse(
        res,
        {
            _id: user._id,
            name: user.name,
            nom: user.nom,
            email: user.email,
            telephone: user.telephone,
            avatarUrl: user.avatarUrl,
            role: user.role,
            createdAt: user.createdAt,
        },
        'Profil mis à jour',
    );
});

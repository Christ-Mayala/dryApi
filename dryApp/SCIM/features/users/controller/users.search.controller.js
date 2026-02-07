const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');

    const { nom, name, email } = req.query;
    const query = [];
    if (nom) query.push({ nom: { $regex: nom, $options: 'i' } });
    if (name) query.push({ name: { $regex: name, $options: 'i' } });
    if (email) query.push({ email: { $regex: email, $options: 'i' } });

    const users = await User.find(query.length ? { $or: query } : {}).select('_id name nom email');
    return sendResponse(res, users, 'Recherche utilisateurs');
});

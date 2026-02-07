const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const ContactSchema = require('../model/contact.schema');

const listMessages = asyncHandler(async (req, res) => {
    const Contact = req.getModel('Contact', ContactSchema);
    const messages = await Contact.find().sort('-createdAt');
    sendResponse(res, messages, 'Messagerie');
});
module.exports = listMessages;
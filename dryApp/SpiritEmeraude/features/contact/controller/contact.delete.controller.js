const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const ContactSchema = require('../model/contact.schema');

const deleteMessage = asyncHandler(async (req, res) => {
  const Contact = req.getModel('Contact', ContactSchema);

  const doc = await Contact.findByIdAndUpdate(
    req.params.id,
    { status: 'deleted', deletedAt: new Date() },
    { new: true, runValidators: true },
  );

  if (!doc) {
    return sendResponse(res, null, 'Message introuvable', false);
  }

  return sendResponse(res, null, 'Message supprimé');
});

module.exports = deleteMessage;

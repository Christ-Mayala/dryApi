const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PropertySubmissionSchema = require('../../property/model/propertySubmission.schema');

module.exports = asyncHandler(async (req, res) => {
    const PropertySubmission = req.getModel('PropertySubmission', PropertySubmissionSchema);
    
    const submission = await PropertySubmission.findById(req.params.id);
    if (!submission) {
        return sendResponse(res, null, 'Soumission introuvable.', false);
    }
    
    await submission.deleteOne();
    
    return sendResponse(res, null, 'Soumission definitivement supprimee.');
});

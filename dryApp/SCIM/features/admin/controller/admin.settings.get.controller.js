const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

module.exports = asyncHandler(async (req, res) => {
    return sendResponse(
        res,
        {
            siteName: 'SCIM Immobilier',
            siteDescription: 'Plateforme immobilière',
            maintenanceMode: false,
            allowRegistration: true,
            emailNotifications: true,
            maxFileSize: 10,
            supportedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
            currency: 'EUR',
            language: 'fr',
        },
        'Paramètres système',
    );
});

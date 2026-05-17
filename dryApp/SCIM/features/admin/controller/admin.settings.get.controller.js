const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const getModel = require('../../../../../dry/core/factories/modelFactory');

module.exports = asyncHandler(async (req, res) => {
    const appName = 'SCIM';
    const settingsSchema = require('../model/systemSettings.schema.js');
    const SystemSettings = getModel(appName, 'SystemSettings', settingsSchema);

    const settings = await SystemSettings.find({});
    const settingsObj = {};
    settings.forEach((s) => {
        settingsObj[s.key] = s.value;
    });

    // Default values if not found
    const defaultSettings = {
        siteName: 'SCIM Immobilier',
        siteDescription: 'Plateforme immobiliere',
        maintenanceMode: false,
        allowRegistration: true,
        emailNotifications: true,
        maxFileSize: 10,
        supportedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
        currency: 'XAF',
        language: 'fr',
    };

    return sendResponse(
        res,
        { ...defaultSettings, ...settingsObj },
        'Parametres systeme',
    );
});

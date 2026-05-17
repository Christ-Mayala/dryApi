const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const getModel = require('../../../../../dry/core/factories/modelFactory');

module.exports = asyncHandler(async (req, res) => {
    const appName = 'SCIM';
    const settingsSchema = require('../model/systemSettings.schema.js');
    const SystemSettings = getModel(appName, 'SystemSettings', settingsSchema);

    const updates = req.body;
    const results = [];

    for (const [key, value] of Object.entries(updates)) {
        const updated = await SystemSettings.findOneAndUpdate(
            { key },
            { key, value },
            { upsert: true, new: true },
        );
        results.push(updated);
    }

    const settingsObj = {};
    results.forEach((s) => {
        settingsObj[s.key] = s.value;
    });

    return sendResponse(res, settingsObj, 'Parametres mis a jour avec succes');
});

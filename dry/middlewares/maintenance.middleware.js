const asyncHandler = require('express-async-handler');

const maintenanceMiddleware = asyncHandler(async (req, res, next) => {
    // Skip maintenance check for admin routes
    if (req.path.includes('/admin') || req.path.includes('/auth') || req.path.includes('/user/login')) {
        return next();
    }

    if (!req.getModel) {
        return next();
    }

    const SystemSettings = req.getModel('SystemSettings', require('../../dryApp/SCIM/features/admin/model/systemSettings.schema.js'));
    const maintenanceMode = await SystemSettings.findOne({ key: 'maintenanceMode' });

    if (maintenanceMode && maintenanceMode.value === true) {
        // If we have a user and they are admin, allow access
        // Note: req.user might not be populated yet if this runs before protect
        if (req.user && req.user.role === 'admin') {
            return next();
        }

        return res.status(503).json({
            success: false,
            message: 'La plateforme est actuellement en maintenance. Veuillez reessayer plus tard.',
            maintenance: true
        });
    }

    next();
});

module.exports = maintenanceMiddleware;

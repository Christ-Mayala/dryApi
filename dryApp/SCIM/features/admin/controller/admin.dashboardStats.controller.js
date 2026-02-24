const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const PropertySchema = require('../../property/model/property.schema');
const MessageSchema = require('../../message/model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);
    const User = req.getModel('User');
    const Message = req.getModel('Message', MessageSchema);

    const [
        totalProperties,
        activeProperties,
        totalUsers,
        totalMessages,
        unreadMessages,
        newUsersThisMonth,
        topProperties,
        propertyTypes,
    ] = await Promise.all([
        Property.countDocuments({ isDeleted: false }),
        Property.countDocuments({ isDeleted: false, $or: [{ status: 'active' }, { status: { $exists: false } }] }),
        User.countDocuments({ status: { $ne: 'deleted' } }),
        Message.countDocuments({}),
        Message.countDocuments({ lu: false }),
        User.countDocuments({ createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }),
        Property.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(5).select('titre ville prix categorie status transactionType isBonPlan'),
        Property.aggregate([
            { $match: { isDeleted: false } },
            { $group: { _id: '$categorie', count: { $sum: 1 } } },
            { $project: { name: '$_id', value: '$count', _id: 0 } },
        ]),
    ]);

    const recentActivities = [
        { type: 'property', title: 'Nouvelle propriete ajoutee', description: 'SCIM', time: new Date(Date.now() - 2 * 60 * 60 * 1000), status: 'success' },
        { type: 'user', title: 'Nouvel utilisateur inscrit', description: 'SCIM', time: new Date(Date.now() - 4 * 60 * 60 * 1000), status: 'info' },
        { type: 'message', title: 'Nouveau message', description: 'SCIM', time: new Date(Date.now() - 6 * 60 * 60 * 1000), status: 'warning' },
    ];

    const salesData = [
        { name: 'Jan', ventes: 0, locations: 0 },
        { name: 'Fev', ventes: 0, locations: 0 },
        { name: 'Mar', ventes: 0, locations: 0 },
        { name: 'Avr', ventes: 0, locations: 0 },
        { name: 'Mai', ventes: 0, locations: 0 },
        { name: 'Jun', ventes: 0, locations: 0 },
    ];

    return sendResponse(
        res,
        {
            stats: {
                totalProperties,
                activeProperties,
                pendingProperties: 0,
                totalUsers,
                activeUsers: totalUsers,
                newUsersThisMonth,
                totalMessages,
                unreadMessages,
            },
            topProperties,
            recentActivities,
            salesData,
            propertyTypes,
        },
        'Dashboard stats',
    );
});

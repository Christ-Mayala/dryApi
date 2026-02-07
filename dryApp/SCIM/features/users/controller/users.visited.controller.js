const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');

const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const User = req.getModel('User');
    req.getModel('Property', PropertySchema);

    const { page, limit } = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });

    const user = await User.findById(req.user.id)
        .select('visited')
        .populate({ path: 'visited.property', select: '_id titre ville prix images noteMoyenne createdAt isDeleted' });

    if (!user) return sendResponse(res, null, 'Utilisateur introuvable.', false);

    const sorted = (user.visited || []).sort((a, b) => new Date(b.lastVisitedAt) - new Date(a.lastVisitedAt));
    const start = (page - 1) * limit;
    const end = start + limit;

    const items = sorted
        .slice(start, end)
        .map((v) => ({
            _id: v.property?._id,
            titre: v.property?.titre,
            ville: v.property?.ville,
            prix: v.property?.prix,
            images: v.property?.images,
            noteMoyenne: v.property?.noteMoyenne || 0,
            lastVisitedAt: v.lastVisitedAt,
            count: v.count || 1,
            isDeleted: v.property?.isDeleted,
        }))
        .filter((i) => i._id && !i.isDeleted)
        .map(({ isDeleted, ...rest }) => rest);

    return sendResponse(res, { total: sorted.length, page, limit, totalPages: Math.ceil(sorted.length / limit), items }, 'Biens visités');
});

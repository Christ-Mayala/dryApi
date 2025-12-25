const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const { getPagination } = require('../../../../../dry/utils/pagination');
const { parseBoolean, parseCsv, parseNumber } = require('../../../../../dry/utils/parse');

const PropertySchema = require('../model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);
    req.getModel('User');

    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 10, maxLimit: 100 });

    const query = { isDeleted: false };
    query.$and = [
        {
            $or: [{ status: 'active' }, { status: { $exists: false } }],
        },
    ];

    const search = req.query.search;
    if (search) {
        query.$and.push({
            $or: [
                { titre: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { ville: { $regex: search, $options: 'i' } },
                { categorie: { $regex: search, $options: 'i' } },
            ],
        });
    }

    if (req.query.ville) query.ville = req.query.ville;

    const cats = parseCsv(req.query.categorie);
    if (cats.length === 1) query.categorie = cats[0];
    if (cats.length > 1) query.categorie = { $in: cats };

    if (req.query.transactionType) query.transactionType = req.query.transactionType;

    const bonPlan = parseBoolean(req.query.isBonPlan);
    if (bonPlan !== undefined) query.isBonPlan = bonPlan;

    if (query.isBonPlan === true) {
        const now = new Date();
        query.$and = query.$and || [];
        query.$and.push({
            $or: [
                { bonPlanExpiresAt: { $exists: false } },
                { bonPlanExpiresAt: null },
                { bonPlanExpiresAt: { $gte: now } },
            ],
        });
    }

    const prixMin = parseNumber(req.query.prixMin);
    const prixMax = parseNumber(req.query.prixMax);
    if (prixMin !== undefined || prixMax !== undefined) {
        query.prix = {};
        if (prixMin !== undefined) query.prix.$gte = prixMin;
        if (prixMax !== undefined) query.prix.$lte = prixMax;
    }

    const total = await Property.countDocuments(query);

    const properties = await Property.find(query)
        .populate('utilisateur', 'name nom email telephone')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    const categories = [...new Set(properties.map((p) => p.categorie).filter(Boolean))];

    return sendResponse(
        res,
        { total, page, limit, totalPages: Math.ceil(total / limit), properties, categories },
        'Liste des annonces',
    );
});

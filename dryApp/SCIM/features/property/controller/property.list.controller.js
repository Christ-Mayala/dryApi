const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');
const { parseBoolean, parseCsv, parseNumber } = require('../../../../../dry/utils/data/parse');

const PropertySchema = require('../model/property.schema');

const getSortQuery = (sortBy) => {
    switch (sortBy) {
        case 'date-asc':
            return { createdAt: 1, _id: 1 };
        case 'price-asc':
            return { prix: 1, createdAt: -1 };
        case 'price-desc':
            return { prix: -1, createdAt: -1 };
        case 'rating-desc':
            return { noteMoyenne: -1, createdAt: -1 };
        case 'surface-desc':
            return { superficie: -1, createdAt: -1 };
        case 'date-desc':
        default:
            return { createdAt: -1, _id: -1 };
    }
};

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

    const chambresMin = parseNumber(req.query.nombre_chambres ?? req.query.nombreChambres ?? req.query.bedrooms);
    if (chambresMin !== undefined) {
        query.nombre_chambres = { $gte: chambresMin };
    }

    const sallesDeBainMin = parseNumber(
        req.query.nombre_salles_bain ?? req.query.nombreSallesBain ?? req.query.bathrooms,
    );
    if (sallesDeBainMin !== undefined) {
        query.nombre_salles_bain = { $gte: sallesDeBainMin };
    }

    const superficieMin = parseNumber(req.query.superficieMin ?? req.query.minSurface);
    const superficieMax = parseNumber(req.query.superficieMax ?? req.query.maxSurface);
    if (superficieMin !== undefined || superficieMax !== undefined) {
        query.superficie = {};
        if (superficieMin !== undefined) query.superficie.$gte = superficieMin;
        if (superficieMax !== undefined) query.superficie.$lte = superficieMax;
    }

    const total = await Property.countDocuments(query);

    const sortQuery = getSortQuery(req.query.sortBy);

    const properties = await Property.find(query)
        .populate('utilisateur', 'name nom email telephone')
        .skip(skip)
        .limit(limit)
        .sort(sortQuery);

    const categories = [...new Set(properties.map((p) => p.categorie).filter(Boolean))];

    return sendResponse(
        res,
        { total, page, limit, totalPages: Math.ceil(total / limit), properties, categories },
        'Liste des annonces',
    );
});

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');
const { parseCsv } = require('../../../../../dry/utils/data/parse');

const PropertySchema = require('../../property/model/property.schema');

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);
    req.getModel('User');
    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 10, maxLimit: 100 });

    const query = { isDeleted: false };

    const cats = parseCsv(req.query.categorie);
    if (cats.length === 1) query.categorie = cats[0];
    if (cats.length > 1) query.categorie = { $in: cats };

    if (req.query.transactionType) query.transactionType = req.query.transactionType;

    if (req.query.search) {
        query.$or = [
            { titre: { $regex: req.query.search, $options: 'i' } },
            { ville: { $regex: req.query.search, $options: 'i' } },
        ];
    }

    const [properties, total] = await Promise.all([
        Property.find(query)
            .populate('utilisateur', 'name nom email')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip),
        Property.countDocuments(query),
    ]);

    return sendResponse(res, { properties, totalPages: Math.ceil(total / limit), currentPage: page, total }, 'Liste des propriétés');
});

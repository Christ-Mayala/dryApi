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

    // Filtrage par catégorie
    const cats = parseCsv(req.query.categorie);
    if (cats.length === 1) query.categorie = cats[0];
    else if (cats.length > 1) query.categorie = { $in: cats };

    // Filtrage par transaction
    if (req.query.transactionType) query.transactionType = req.query.transactionType;
    
    // Filtrage par statut (IMPORTANT)
    if (req.query.status && req.query.status !== 'all' && req.query.status !== '') {
        query.status = req.query.status;
    }

    // Recherche textuelle
    if (req.query.search) {
        const searchRegex = { $regex: req.query.search, $options: 'i' };
        
        // On combine la recherche avec le statut déjà présent dans query
        const searchOr = [
            { titre: searchRegex },
            { ville: searchRegex },
            { categorie: searchRegex },
            { adresse: searchRegex }
        ];

        // Si query a déjà des éléments (comme status), on utilise $and pour combiner
        if (Object.keys(query).length > 1) { // isDeleted est toujours là
            query.$and = query.$and || [];
            query.$and.push({ $or: searchOr });
        } else {
            query.$or = searchOr;
        }
    }

    // Exécution des requêtes
    const total = await Property.countDocuments(query);
    const properties = await Property.find(query)
            .populate('utilisateur', 'name nom email')
            .populate('adminReference', 'name nom email')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

    return sendResponse(
        res,
        {
            properties,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        'Liste des proprietes',
    );
});

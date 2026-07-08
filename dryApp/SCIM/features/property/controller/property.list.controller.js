const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');
const { parseBoolean, parseCsv, parseNumber } = require('../../../../../dry/utils/data/parse');

const PropertySchema = require('../model/property.schema');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getSortQuery = (sortBy) => {
    switch (sortBy) {
        case 'date-asc':     return { createdAt: 1, _id: 1 };
        case 'price-asc':    return { prix: 1, createdAt: -1 };
        case 'price-desc':   return { prix: -1, createdAt: -1 };
        case 'rating-desc':  return { noteMoyenne: -1, createdAt: -1 };
        case 'surface-desc': return { superficie: -1, createdAt: -1 };
        case 'date-desc':
        default:             return { createdAt: -1, _id: -1 };
    }
};

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);
    req.getModel('User');

    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 10, maxLimit: 100 });

    // Base query — toujours exclure les supprimés
    const query = { isDeleted: false };

    // ── Statut ──
    // Admin peut passer ?status=active|inactive, ou omettre pour "tous"
    if (req.query.status && req.query.status !== 'all') {
        query.status = req.query.status;
    } else if (!req.query.status) {
        // Client public : n'afficher que les biens actifs
        query.$or = [{ status: 'active' }, { status: { $exists: false } }];
    }
    // status=all → pas de filtre, on retourne tout (usage admin)

    // ── Recherche texte ──
    // Cherche dans titre, description, ville, categorie, adresse
    const search = (req.query.search || '').trim();
    if (search) {
        const searchRegex = { $regex: escapeRegExp(search), $options: 'i' };
        const searchCondition = {
            $or: [
                { titre:       searchRegex },
                { description: searchRegex },
                { ville:       searchRegex },
                { categorie:   searchRegex },
                { adresse:     searchRegex },
            ],
        };
        // Combiner proprement avec l'éventuel $or du statut
        if (query.$or) {
            query.$and = [{ $or: query.$or }, searchCondition];
            delete query.$or;
        } else if (query.$and) {
            query.$and.push(searchCondition);
        } else {
            query.$and = [searchCondition];
        }
    }

    // ── Ville (filtre exact ou regex souple) ──
    if (req.query.ville) {
        query.ville = { $regex: escapeRegExp(req.query.ville.trim()), $options: 'i' };
    }

    // ── Catégorie ──
    const cats = parseCsv(req.query.categorie);
    if (cats.length === 1) query.categorie = cats[0];
    if (cats.length > 1)   query.categorie = { $in: cats };

    // ── Type de transaction ──
    if (req.query.transactionType) query.transactionType = req.query.transactionType;

    // ── Bon Plan ──
    const bonPlan = parseBoolean(req.query.isBonPlan);
    if (bonPlan !== undefined) {
        query.isBonPlan = bonPlan;
        if (bonPlan === true) {
            // Exclure les bons plans expirés
            const now = new Date();
            const bonPlanCondition = {
                $or: [
                    { bonPlanExpiresAt: { $exists: false } },
                    { bonPlanExpiresAt: null },
                    { bonPlanExpiresAt: { $gte: now } },
                ],
            };
            if (query.$and) {
                query.$and.push(bonPlanCondition);
            } else {
                query.$and = [bonPlanCondition];
            }
        }
    }

    // ── Prix ──
    const prixMin = parseNumber(req.query.prixMin);
    const prixMax = parseNumber(req.query.prixMax);
    if (prixMin !== undefined || prixMax !== undefined) {
        query.prix = {};
        if (prixMin !== undefined) query.prix.$gte = prixMin;
        if (prixMax !== undefined) query.prix.$lte = prixMax;
    }

    // ── Chambres (min) — accepte plusieurs alias ──
    const chambresMin = parseNumber(
        req.query.nombre_chambres ?? req.query.nombreChambres ?? req.query.bedrooms,
    );
    if (chambresMin !== undefined) {
        query.nombre_chambres = { $gte: chambresMin };
    }

    // ── Salles de bain (min) ──
    const sallesMin = parseNumber(
        req.query.nombre_salles_bain ?? req.query.nombreSallesBain ?? req.query.bathrooms,
    );
    if (sallesMin !== undefined) {
        query.nombre_salles_bain = { $gte: sallesMin };
    }

    // ── Superficie ──
    const superficieMin = parseNumber(req.query.superficieMin ?? req.query.minSurface);
    const superficieMax = parseNumber(req.query.superficieMax ?? req.query.maxSurface);
    if (superficieMin !== undefined || superficieMax !== undefined) {
        query.superficie = {};
        if (superficieMin !== undefined) query.superficie.$gte = superficieMin;
        if (superficieMax !== undefined) query.superficie.$lte = superficieMax;
    }

    // ── Exécution ──
    const total = await Property.countDocuments(query);
    const sortQuery = getSortQuery(req.query.sortBy);

    const properties = await Property.find(query)
        .populate('utilisateur', 'name nom email telephone')
        .skip(skip)
        .limit(limit)
        .sort(sortQuery)
        .lean();

    // Un bon plan expiré ne doit plus s'afficher comme tel, même si le job de nettoyage
    // périodique n'est pas encore passé sur ce document.
    const now = new Date();
    for (const p of properties) {
        if (p.isBonPlan && p.bonPlanExpiresAt && new Date(p.bonPlanExpiresAt) < now) {
            p.isBonPlan = false;
        }
    }

    const categories = [...new Set(properties.map((p) => p.categorie).filter(Boolean))];

    return sendResponse(
        res,
        { total, page, limit, totalPages: Math.ceil(total / limit), properties, categories },
        'Liste des annonces',
    );
});

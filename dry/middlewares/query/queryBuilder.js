/**
 * Middleware de filtrage, pagination, tri et recherche avancée (comme advancedResults de control-api).
 * 
 * @param {Function|Model} modelOrGetter - Modèle Mongoose OU fonction(req) => Model
 * @param {Object|Array} populateOpts - Options de populate (objet ou tableau d'objets)
 * @param {Object} options - Options supplémentaires
 * @param {string} options.select - Sélection de champs par défaut (ex: '-password')
 * @param {Object} options.defaultFilter - Filtre par défaut à appliquer (ex: { isDeleted: false })
 */
// Echappe les caracteres speciaux regex avant de construire un $regex a partir
// d'une entree utilisateur libre (req.query.search) — sans ca, un pattern a
// backtracking catastrophique (ex: "(a+)+$") bloque le thread Mongo/Node en
// evaluation ReDoS. Toute recherche reste "contains, insensible a la casse"
// pour l'utilisateur, juste sans interpretation des metacaracteres regex.
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Limite haute absolue de pagination — sans plafond, un client (authentifie ou
// non selon la route) peut demander ?limit=5000000 et forcer un .find().limit()
// non borne, DoS memoire/CPU. 100 couvre tous les usages legitimes actuels.
const MAX_LIMIT = 100;

const queryBuilder = (modelOrGetter, populateOpts = null, options = {}) => async (req, res, next) => {
    try {
        // Résoudre le modèle (direct ou via une fonction getter(req)).
        // ATTENTION : un modèle Mongoose compilé est lui-même une fonction
        // (constructeur), donc `typeof === 'function'` seul ne suffit pas à
        // distinguer "un modèle passé directement" d'"un getter à appeler avec req".
        // On ne traite comme getter que les fonctions qui n'ont PAS les marqueurs
        // d'un modèle Mongoose compilé (modelName + schema).
        const isCompiledModel = (val) =>
            typeof val === 'function' && Boolean(val.modelName) && Boolean(val.schema);
        const model =
            typeof modelOrGetter === 'function' && !isCompiledModel(modelOrGetter)
                ? modelOrGetter(req)
                : modelOrGetter;
        if (!model) {
            return next(new Error('Modèle requis pour queryBuilder'));
        }

        // 1. Copie de req.query
        const reqQuery = { ...req.query };

        // 2. Champs à exclure du filtrage (réservés à la pagination/tri/recherche)
        const removeFields = ['select', 'sort', 'page', 'limit', 'rows', 'fields', 'search', 'json'];
        removeFields.forEach(param => delete reqQuery[param]);
        // ── 2a. Cast number fields based on Mongoose schema ──
        // HTTP values come as strings, but schema expects Number
        const schemaPaths = model.schema ? model.schema.paths : {};
        Object.keys(reqQuery).forEach((key) => {
            const val = reqQuery[key];
            const schemaType = schemaPaths[key];
            if (
                schemaType &&
                schemaType.instance === 'Number' &&
                typeof val === 'string' &&
                !val.includes(',') &&
                /^\d+/.test(val)
            ) {
                reqQuery[key] = Number(val);
            }
        });
        // ── 2b. Convert comma-separated values to $in arrays ──
        Object.keys(reqQuery).forEach((key) => {
            if (typeof reqQuery[key] === "string" && reqQuery[key].includes(",")) {
                const values = reqQuery[key].split(",").map((val) => {
                    if (/^[0-9a-fA-F]{24}$/.test(val)) {
                        try { return require("mongoose").Types.ObjectId(val); } catch { return val; }
                    }
                    return val;
                });
                reqQuery[key] = { in: values };
            }
        });

        // 3. Transformation des opérateurs (gt, gte, lt, lte, in, ne, or, eq) en syntaxe Mongo ($gt, etc.)
        let queryStr = JSON.stringify(reqQuery);
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in|ne|or|eq)\b/g, match => `$${match}`);

        // 4. Construction de la requête de base
        let findQuery = JSON.parse(queryStr);
        // 4b. Support du paramètre json pour filtres complexes
        if (req.query.json) {
            try {
                const jsonFilter = JSON.parse(req.query.json);
                if (Object.keys(findQuery).length === 0) {
                    findQuery = jsonFilter;
                } else {
                    findQuery = { $and: [findQuery, jsonFilter] };
                }
            } catch (e) { /* invalid JSON, ignore */ }
        }

        // 4c. Fusion avec le filtre par défaut (ex: { isDeleted: false })
        if (options.defaultFilter && Object.keys(options.defaultFilter).length > 0) {
            if (Object.keys(findQuery).length === 0) {
                findQuery = { ...options.defaultFilter };
            } else {
                findQuery = { $and: [options.defaultFilter, findQuery] };
            }
        }

        // 5. Recherche textuelle (si fields ET search sont fournis)
        if (req.query.fields && req.query.search) {
            const searchFields = req.query.fields.split(',').map(f => f.trim()).filter(Boolean);
            const searchTerm = req.query.search;
            if (searchFields.length > 0 && searchTerm) {
                // Filtrer les champs non recherchables (ObjectId, dot-notation)
                const searchableFields = searchFields.filter((property) => {
                    if (property.includes('.')) return false;
                    const st = schemaPaths[property];
                    if (st && st.instance === 'ObjectId') return false;
                    return true;
                });

                if (searchableFields.length > 0) {
                    const orConditions = searchableFields.map(field => ({
                        [field]: { $regex: escapeRegex(searchTerm), $options: 'i' }
                    }));
                    const currentQuery = { ...findQuery };
                    delete currentQuery.$and;
                    if (Object.keys(currentQuery).length === 0) {
                        findQuery = { $or: orConditions };
                    } else {
                        findQuery = { $and: [currentQuery, { $or: orConditions }] };
                    }
                }
            }
        } else if (req.query.search && !req.query.fields) {
            // Recherche générique dans les champs String du modèle
            const allSchemaPaths = model.schema && model.schema.paths ? Object.keys(model.schema.paths) : [];
            const stringPaths = schemaPaths.filter(p => {
                const pathType = model.schema.paths[p];
                return pathType && (pathType.instance === 'String' || (pathType.options && pathType.options.type === String));
            }).filter(p => !['_id', '__v', 'password', 'token'].includes(p));
            
            if (stringPaths.length > 0) {
                const searchRegex = { $regex: escapeRegex(req.query.search), $options: 'i' };
                const orConditions = stringPaths.map(field => ({ [field]: searchRegex }));
                const currentQuery = { ...findQuery };
                delete currentQuery.$and;
                if (Object.keys(currentQuery).length === 0) {
                    findQuery = { $or: orConditions };
                } else {
                    findQuery = { $and: [currentQuery, { $or: orConditions }] };
                }
            }
        }

        // 6. Comptage total (pour la pagination)
        const total = await model.countDocuments(findQuery);

        // 7. Création de la requête Mongoose
        let query = model.find(findQuery);

        // 8. Select (Champs à afficher) - priorité à req.query.select, fallback sur options.select
        const selectFields = req.query.select || options.select || '';
        if (selectFields) {
            const fields = selectFields.split(',').join(' ');
            query = query.select(fields);
        }

        // 9. Sort (Tri)
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-createdAt');
        }

        // 10. Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(
            MAX_LIMIT,
            parseInt(req.query.limit, 10) || parseInt(req.query.rows, 10) || 10,
        );
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        query = query.skip(startIndex).limit(limit);

        // 11. Populate (Jointures)
        if (populateOpts) {
            if (Array.isArray(populateOpts)) {
                populateOpts.forEach(opt => {
                    query = query.populate(opt);
                });
            } else {
                query = query.populate(populateOpts);
            }
        }

        // 12. Exécution de la requête
        const results = await query;

        // 13. Construction de l'objet pagination
        const pagination = {
            total,
            count: results.length,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };

        if (endIndex < total) {
            pagination.next = { page: page + 1, limit };
        }
        if (startIndex > 0) {
            pagination.prev = { page: page - 1, limit };
        }

        // 14. Attacher le résultat à l'objet Response
        res.advancedResults = {
            success: true,
            data: results,
            pagination
        };

        next();
    } catch (err) {
        console.error('[queryBuilder] Error:', err.message);
        res.advancedResults = {
            success: false,
            data: [],
            pagination: { total: 0, count: 0, page: 1, limit: 10, totalPages: 0 }
        };
        next();
    }
};

module.exports = queryBuilder;

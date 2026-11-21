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

// Longueur maximale d'un terme de recherche : au-delà, on refuse la requête
// plutôt que de construire un regex coûteux et malveillant.
const MAX_SEARCH_LENGTH = 200;

// Opérateurs Mongo permettant l'exécution de code ou d'expressions arbitraires :
// ils sont refusés dans le filtre `?json=` fourni par le client.
const OPERATEURS_INTERDITS = new Set(['$where', '$expr', '$function', '$accumulator', '$jsonSchema']);

function contientOperateurInterdit(valeur) {
  if (Array.isArray(valeur)) return valeur.some(contientOperateurInterdit);
  if (!valeur || typeof valeur !== 'object') return false;
  return Object.entries(valeur).some(([cle, enfant]) =>
    OPERATEURS_INTERDITS.has(cle) || contientOperateurInterdit(enfant)
  );
}

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
        const operatorRegex = /\$[a-zA-Z0-9_]+/g;
        const protectedOperators = new Map();
        let opCounter = 0;
        queryStr = queryStr.replace(operatorRegex, (match) => {
            const key = `__MONGO_OP_${opCounter++}__`;
            protectedOperators.set(key, match);
            return key;
        });
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in|ne|or|eq)\b/g, match => `$${match}`);
        queryStr = queryStr.replace(/__MONGO_OP_(\d+)__/g, (match, index) => protectedOperators.get(match) || match);

        // 4. Construction de la requête de base
        let findQuery = JSON.parse(queryStr);
        // 4b. Support du paramètre json pour filtres complexes.
        // Un JSON invalide ou contenant un opérateur d'exécution de code est
        // refusé : il ne doit jamais être silencieusement ignoré (risque de
        // faire croire à un filtre appliqué alors qu'il ne l'est pas).
        if (req.query.json) {
            let jsonFilter;
            try {
                jsonFilter = JSON.parse(req.query.json);
            } catch {
                const erreur = new Error('Paramètre json invalide');
                erreur.status = 400;
                return next(erreur);
            }
            if (!jsonFilter || typeof jsonFilter !== 'object' || Array.isArray(jsonFilter)) {
                const erreur = new Error('Paramètre json invalide');
                erreur.status = 400;
                return next(erreur);
            }
            if (contientOperateurInterdit(jsonFilter)) {
                const erreur = new Error('Opérateur de requête interdit');
                erreur.status = 400;
                return next(erreur);
            }
            findQuery = Object.keys(findQuery).length === 0
                ? jsonFilter
                : { $and: [findQuery, jsonFilter] };
        }

        // 4c. Fusion avec le filtre par défaut (ex: { isDeleted: false })
        if (options.defaultFilter && Object.keys(options.defaultFilter).length > 0) {
            if (Object.keys(findQuery).length === 0) {
                findQuery = { ...options.defaultFilter };
            } else {
                findQuery = { $and: [options.defaultFilter, findQuery] };
            }
        }

        // 5. Recherche textuelle. Le filtre ACL est inclus dans `findQuery` :
        // il est impératif de le CONSERVER. L'ancien code supprimait `$and`
        // avant d'ajouter `$or`, ce qui permettait de contourner totalement
        // les restrictions d'espace avec `?search=`.
        if (req.query.search) {
            if (typeof req.query.search !== 'string') {
                const erreur = new Error('Terme de recherche invalide');
                erreur.status = 400;
                return next(erreur);
            }
            const searchTerm = req.query.search;
            if (!searchTerm.trim()) {
                const erreur = new Error('Terme de recherche vide');
                erreur.status = 400;
                return next(erreur);
            }
            if (searchTerm.length > MAX_SEARCH_LENGTH) {
                const erreur = new Error('Terme de recherche trop long');
                erreur.status = 400;
                return next(erreur);
            }

            let champs = [];
            if (req.query.fields) {
                champs = req.query.fields
                    .split(',')
                    .map((champ) => champ.trim())
                    .filter(Boolean)
                    .filter((champ) => {
                        if (champ.includes('.') || !schemaPaths[champ]) return false;
                        return schemaPaths[champ].instance !== 'ObjectId';
                    });
            } else {
                // `schemaPaths` est un OBJET : `Object.keys()` est obligatoire.
                champs = Object.keys(schemaPaths).filter((champ) => {
                    const type = schemaPaths[champ];
                    if (['_id', '__v', 'password', 'token'].includes(champ)) return false;
                    return Boolean(type) && (type.instance === 'String' || type.options?.type === String);
                });
            }

            if (champs.length > 0) {
                const searchRegex = { $regex: escapeRegex(searchTerm), $options: 'i' };
                const condition = { $or: champs.map((champ) => ({ [champ]: searchRegex })) };
                if (Object.keys(findQuery).length === 0) {
                    findQuery = condition;
                } else if (Array.isArray(findQuery.$and) && Object.keys(findQuery).length === 1) {
                    // Le filtre ACL est déjà un `$and` : on y ajoute la recherche
                    // sans l'imbriquer dans un second `$and`.
                    findQuery = { $and: [...findQuery.$and, condition] };
                } else {
                    findQuery = { $and: [findQuery, condition] };
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
        // Ne plus renvoyer une liste vide « réussie » : une erreur de requête
        // doit remonter au gestionnaire d'erreurs centralisé, sinon le client
        // croit à tort qu'aucun document ne correspond alors que l'ACL a
        // peut-être été contournée ou que la base est indisponible.
        err.message = `[queryBuilder] ${err.message}`;
        return next(err);
    }
};

module.exports = queryBuilder;

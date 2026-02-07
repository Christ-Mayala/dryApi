const queryBuilder = (model, populateOpts = null) => async (req, res, next) => {
    try {
        let query;

        // 1. Copie de req.query
        const reqQuery = { ...req.query };

        // 2. Champs à exclure du filtrage (ceux réservés à la pagination/tri)
        const removeFields = ['select', 'sort', 'page', 'limit'];
        removeFields.forEach(param => delete reqQuery[param]);

        // 3. Transformation des opérateurs (gt, gte, lt, lte, in) en syntaxe Mongo ($gt, etc.)
        let queryStr = JSON.stringify(reqQuery);
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

        // 4. Création de la requête (Le plugin Soft Delete filtre déjà les status='deleted')
        query = model.find(JSON.parse(queryStr));

        // 5. Select (Choisir les champs à afficher)
        if (req.query.select) {
            const fields = req.query.select.split(',').join(' ');
            query = query.select(fields);
        }

        // 6. Sort (Tri)
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            // Tri par défaut : plus récent en premier
            query = query.sort('-createdAt');
        }

        // 7. Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = await model.countDocuments(JSON.parse(queryStr));

        query = query.skip(startIndex).limit(limit);

        // 8. Populate (Jointures) si fourni
        if (populateOpts) {
            query = query.populate(populateOpts);
        }

        // Exécution de la requête
        const results = await query;

        // Gestion objet pagination (Next/Prev pages)
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

        // 9. Attacher le résultat à l'objet Response
        res.advancedResults = {
            success: true,
            data: results,
            pagination
        };

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = queryBuilder;

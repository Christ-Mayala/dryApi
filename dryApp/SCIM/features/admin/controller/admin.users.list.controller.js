const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

/**
 * GET /admin/users
 * Utilise le middleware queryBuilder pour filtrer/paginer.
 * Le contrôleur ne fait que répondre avec les résultats déjà filtrés.
 */
module.exports = asyncHandler(async (req, res) => {
    const { data: users, pagination } = res.advancedResults;
    
    return sendResponse(
        res,
        {
            users,
            page: pagination.page,
            currentPage: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages,
        },
        'Utilisateurs',
    );
});

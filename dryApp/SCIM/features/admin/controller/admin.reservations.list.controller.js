const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const { decorateReservationCollectionForClient } = require('../../reservation/controller/reservation.support.util');

/**
 * GET /admin/reservations
 * Utilise le middleware queryBuilder pour filtrer/paginer.
 * Le contrôleur ne fait que décorer les résultats et répondre.
 */
module.exports = asyncHandler(async (req, res) => {
    const { data: reservations, pagination } = res.advancedResults;
    
    const decorated = decorateReservationCollectionForClient(reservations);
    
    return sendResponse(
        res,
        {
            reservations: decorated,
            page: pagination.page,
            currentPage: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages,
        },
        'Reservations',
    );
});

const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

/**
 * Journal d'audit (lecture seule).
 *
 * Les entrees proviennent de la collection `logs`, alimentee automatiquement
 * par le plugin DRY (creation / modification / suppression) et par les
 * routes sensibles (`withAudit`). Aucune ecriture n'est exposee ici.
 */
exports.getAll = asyncHandler(async (req, res) => {
  const { data, pagination } = res.advancedResults || { data: [], pagination: null };
  return sendResponse(res, data, "Journal d'audit", true, pagination || undefined);
});

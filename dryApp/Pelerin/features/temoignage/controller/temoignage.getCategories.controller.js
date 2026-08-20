const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const TemoignageSchema = require('../model/temoignage.schema');
const {
  TEMOIGNAGE_CATEGORIES,
} = require('../../../services/temoignageCategorization.service');

// Labels français — doit rester synchrone avec
// src/features/temoignage/types.ts (mobile).
const CATEGORY_LABELS = {
  conversion: 'Conversion',
  guerison: 'Guérison',
  delivrance: 'Délivrance',
  famille: 'Famille',
  deuil: 'Deuil',
  travail: 'Travail',
  foi: 'Foi',
  autre: 'Autre',
};

// GET /temoignage/categories — public, liste des categories avec le nombre de
// temoignages approuves par categorie.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('Temoignage', TemoignageSchema);

  const counts = await Model.aggregate([
    { $match: { isApproved: true, status: { $ne: 'deleted' } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  const countMap = {};
  for (const row of counts) {
    if (row._id) countMap[row._id] = row.count;
  }

  const data = TEMOIGNAGE_CATEGORIES.map((key) => ({
    key,
    label: CATEGORY_LABELS[key] || key,
    count: countMap[key] || 0,
  }));

  return sendResponse(res, data, 'Categories recuperees');
});

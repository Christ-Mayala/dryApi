const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');
const { getPagination } = require('../../../../../dry/utils/pagination');

module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');

  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });

  // Par défaut, l'admin ne voit que les comptes actifs.
  // status peut être: active | inactive | deleted | all
  const statusFilter = String(req.query.status || 'active').toLowerCase().trim();

  const query = {};

  const deletedCond = [{ status: 'deleted' }, { deleted: true }];

  if (statusFilter === 'active') {
    query.status = 'active';
    query.deleted = { $ne: true };
  } else if (statusFilter === 'inactive') {
    query.status = 'inactive';
    query.deleted = { $ne: true };
  } else if (statusFilter === 'deleted') {
    query.$or = deletedCond;
  } else if (statusFilter === 'all') {
  } else {
    throw new Error('Filtre statut invalide');
  }

  if (req.query.role) query.role = req.query.role;

  if (req.query.search) {
    const searchOr = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
      { telephone: { $regex: req.query.search, $options: 'i' } },
    ];

    if (statusFilter === 'deleted') {
      delete query.$or;
      query.$and = [{ $or: deletedCond }, { $or: searchOr }];
    } else {
      query.$or = searchOr;
    }
  }

  const [items, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).limit(limit).skip(skip),
    User.countDocuments(query),
  ]);

  return sendResponse(res, { items, totalPages: Math.ceil(total / limit), currentPage: page, total }, 'Utilisateurs');
});

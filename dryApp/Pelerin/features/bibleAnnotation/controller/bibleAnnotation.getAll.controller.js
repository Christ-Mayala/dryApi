const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const BibleAnnotationSchema = require('../model/bibleAnnotation.schema');

// GET /bibleannotation — annotations de l'utilisateur courant uniquement.
// Filtres optionnels: ?favorite=true, ?bookCode=jean, ?version=LSG1910
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('BibleAnnotation', BibleAnnotationSchema);
  const filter = { createdBy: req.user.id };

  if (req.query.favorite === 'true') filter.isFavorite = true;
  if (req.query.bookCode) filter.bookCode = String(req.query.bookCode).toLowerCase();
  if (req.query.version) filter.version = req.query.version;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);

  const [data, total] = await Promise.all([
    Model.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Model.countDocuments(filter),
  ]);

  return sendResponse(res, data, 'Annotations recuperees', true, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

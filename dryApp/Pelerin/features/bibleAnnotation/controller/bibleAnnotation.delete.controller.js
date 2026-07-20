const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const BibleAnnotationSchema = require('../model/bibleAnnotation.schema');

// DELETE /bibleannotation/:id — uniquement sa propre annotation (hard delete :
// il ne s'agit pas d'un contenu editorial mais d'une donnee perso jetable).
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('BibleAnnotation', BibleAnnotationSchema);
  const item = await Model.findOne({ _id: req.params.id, createdBy: req.user.id });
  if (!item) throw httpError('Annotation introuvable', 404);

  await item.deleteOne();
  return sendResponse(res, null, 'Annotation supprimee');
});

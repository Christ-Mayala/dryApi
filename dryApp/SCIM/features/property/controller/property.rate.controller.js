const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const PropertySchema = require('../model/property.schema');

module.exports = asyncHandler(async (req, res) => {
  const Property = req.getModel('Property', PropertySchema);

  const property = await Property.findById(req.params.id);
  if (!property || property.isDeleted) {
    return sendResponse(res, null, 'Bien introuvable.', false);
  }

  const rawRating = req.body?.rating ?? req.body?.note;
  const note = Number(rawRating);
  if (!Number.isFinite(note) || note < 1 || note > 5) {
    return sendResponse(res, null, 'Note invalide (1-5).', false);
  }

  property.evaluations = Array.isArray(property.evaluations) ? property.evaluations : [];

  const existingIndex = property.evaluations.findIndex(
    (entry) => entry.utilisateur && entry.utilisateur.toString() === req.user.id,
  );

  let updated = false;
  if (existingIndex >= 0) {
    property.evaluations[existingIndex].note = note;
    updated = true;
  } else {
    property.evaluations.push({
      utilisateur: req.user.id,
      note,
      creeLe: new Date(),
    });
  }

  const validEvaluations = property.evaluations.filter(
    (entry) => Number.isFinite(Number(entry?.note)) && Number(entry.note) >= 1 && Number(entry.note) <= 5,
  );

  const total = validEvaluations.reduce((acc, cur) => acc + Number(cur.note || 0), 0);
  const nombreAvis = validEvaluations.length;

  property.evaluations = validEvaluations;
  property.nombreAvis = nombreAvis;
  property.noteMoyenne = nombreAvis > 0 ? Number((total / nombreAvis).toFixed(2)) : 0;

  await property.save();

  return sendResponse(
    res,
    {
      noteMoyenne: property.noteMoyenne,
      nombreAvis: property.nombreAvis,
      userNote: note,
      updated,
    },
    updated ? 'Note mise a jour avec succes.' : 'Note enregistree avec succes.',
  );
});

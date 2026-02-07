const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const sendResponse = require('../../../../../dry/utils/http/response');

const ProfessionalSchema = require('../model/professional.schema');
const ProfessionalRatingSchema = require('../model/rating.schema');

module.exports = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new Error('Non autorisé');

  const professionalId = String(req.params.id || '').trim();
  if (!mongoose.Types.ObjectId.isValid(professionalId)) throw new Error('ID invalide');

  const ratingValue = Number(req.body?.rating);
  if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) throw new Error('Note invalide (1 à 5)');

  const Professional = req.getModel('Professional', ProfessionalSchema);
  const pro = await Professional.findById(professionalId);
  if (!pro) throw new Error('Professionnel introuvable');
  if (pro.approvalStatus !== 'approved') throw new Error('Professionnel indisponible');

  const ProfessionalRating = req.getModel('ProfessionalRating', ProfessionalRatingSchema);

  await ProfessionalRating.findOneAndUpdate(
    { professional: professionalId, user: req.user._id },
    { $set: { rating: ratingValue } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const agg = await ProfessionalRating.aggregate([
    { $match: { professional: new mongoose.Types.ObjectId(professionalId) } },
    { $group: { _id: '$professional', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const avg = agg?.[0]?.avg || 0;
  const count = agg?.[0]?.count || 0;

  const updated = await Professional.findByIdAndUpdate(
    professionalId,
    { $set: { rating: avg, ratingCount: count } },
    { new: true },
  );

  return sendResponse(res, updated, 'Note enregistrée');
});

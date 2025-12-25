const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ProfessionalSchema = require('../model/professional.schema');

const mapCloudinaryFile = (f) => {
  const url = f?.path || f?.secure_url || f?.url || '';
  const public_id = f?.filename || f?.public_id || '';
  return { url, public_id };
};

module.exports = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new Error('Non autorisé');

  const Professional = req.getModel('Professional', ProfessionalSchema);
  const pro = await Professional.findOne({ createdBy: req.user._id });
  if (!pro) throw new Error('Aucun profil professionnel trouvé');

  const body = req.body || {};

  const updates = {};
  if (body.name) updates.name = String(body.name).trim();
  if (body.telephone) updates.telephone = String(body.telephone).trim();
  if (body.whatsapp !== undefined) updates.whatsapp = String(body.whatsapp) === 'true' || body.whatsapp === true;
  if (body.pays) updates.pays = String(body.pays).trim();
  if (body.ville) updates.ville = String(body.ville).trim();
  if (body.quartier !== undefined) updates.quartier = String(body.quartier || '').trim();
  if (body.experienceRange) updates.experienceRange = body.experienceRange;
  if (body.description !== undefined) updates.description = String(body.description || '').trim();
  if (body.hoursAvailable !== undefined) updates.hoursAvailable = String(body.hoursAvailable || '').trim();
  if (body.preferredContact) updates.preferredContact = body.preferredContact;
  if (body.availabilityStatus) updates.availabilityStatus = body.availabilityStatus;

  if (body.daysAvailable !== undefined) {
    updates.daysAvailable = Array.isArray(body.daysAvailable)
      ? body.daysAvailable
      : (typeof body.daysAvailable === 'string' && body.daysAvailable
        ? String(body.daysAvailable).split(',').map((s) => s.trim()).filter(Boolean)
        : []);
  }

  const filesObj = req.files && typeof req.files === 'object' ? req.files : {};
  const profileArr = Array.isArray(filesObj.profileImage) ? filesObj.profileImage : [];
  const realArr = Array.isArray(filesObj.images) ? filesObj.images : [];

  if (profileArr.length) {
    const profileImage = mapCloudinaryFile(profileArr[0]);
    if (profileImage?.url) updates.profileImage = profileImage;
  }

  if (realArr.length) {
    const images = realArr.slice(0, 2).map(mapCloudinaryFile).filter((x) => x.url);
    updates.images = images;
  }

  const updated = await Professional.findByIdAndUpdate(pro._id, { $set: updates }, { new: true, runValidators: true });
  return sendResponse(res, updated, 'Profil professionnel mis à jour');
});

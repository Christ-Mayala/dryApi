const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const ProfessionalSchema = require('../model/professional.schema');

const mapCloudinaryFile = (f) => {
  const url = f?.path || f?.secure_url || f?.url || '';
  const public_id = f?.filename || f?.public_id || '';
  return { url, public_id };
};

module.exports = asyncHandler(async (req, res) => {
  const Professional = req.getModel('Professional', ProfessionalSchema);
  if (!req.user?._id) throw new Error('Non autorisé');

  const {
    name,
    nom,
    prenom,
    telephone,
    whatsapp,
    pays,
    ville,
    quartier,
    categoryId,
    tradeId,
    experienceRange,
    description,
    daysAvailable,
    hoursAvailable,
    preferredContact,
  } = req.body || {};

  if (!name || String(name).trim().length < 2) throw new Error('Nom requis');
  if (!telephone || String(telephone).trim().length < 6) throw new Error('Téléphone requis');
  if (!ville || String(ville).trim().length < 2) throw new Error('Ville requise');
  if (!categoryId) throw new Error('Catégorie requise');
  if (!tradeId) throw new Error('Métier requis');

  const filesObj = req.files && typeof req.files === 'object' ? req.files : {};
  const profileArr = Array.isArray(filesObj.profileImage) ? filesObj.profileImage : [];
  const realArr = Array.isArray(filesObj.images) ? filesObj.images : [];

  if (!profileArr.length) throw new Error('Photo de profil requise');

  const profileImage = mapCloudinaryFile(profileArr[0]);
  const images = realArr.slice(0, 2).map(mapCloudinaryFile).filter((x) => x.url);

  const pro = await Professional.create({
    name: String(name).trim(),
    nom: nom ? String(nom).trim() : undefined,
    prenom: prenom ? String(prenom).trim() : undefined,
    telephone: String(telephone).trim(),
    whatsapp: String(whatsapp) === 'true' || whatsapp === true,
    pays: pays ? String(pays).trim() : undefined,
    ville: String(ville).trim(),
    quartier: quartier ? String(quartier).trim() : undefined,
    categoryId,
    tradeId,
    experienceRange: experienceRange || '0-1',
    description: description ? String(description).trim() : '',
    daysAvailable: Array.isArray(daysAvailable)
      ? daysAvailable
      : (typeof daysAvailable === 'string' && daysAvailable
        ? daysAvailable.split(',').map((s) => s.trim()).filter(Boolean)
        : []),
    hoursAvailable: hoursAvailable ? String(hoursAvailable).trim() : '',
    preferredContact: preferredContact || 'both',
    profileImage: profileImage?.url ? profileImage : { url: '', public_id: '' },
    images,
    createdBy: req.user._id,
  });

  return sendResponse(res, pro, 'Profil professionnel créé (en attente de validation)');
});

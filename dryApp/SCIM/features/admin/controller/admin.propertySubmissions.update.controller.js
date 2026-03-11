const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { normalizePhoneE164 } = require('../../reservation/controller/reservation.support.util');

const PropertySubmissionSchema = require('../../property/model/propertySubmission.schema');

const toOptionalNumber = (value) => {
    if (value === null || value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
};

module.exports = asyncHandler(async (req, res) => {
    const PropertySubmission = req.getModel('PropertySubmission', PropertySubmissionSchema);
    const submission = await PropertySubmission.findById(req.params.id);
    if (!submission) return sendResponse(res, null, 'Soumission introuvable.', false);
    if (submission.status !== 'pending') {
        return sendResponse(res, null, 'Modification impossible: soumission deja traitee.', false);
    }

    const b = req.body || {};

    if (typeof b.nomComplet === 'string') submission.submitter.nomComplet = b.nomComplet.trim();
    if (typeof b.email === 'string') submission.submitter.email = b.email.trim().toLowerCase();
    if (typeof b.telephone === 'string') {
        const normalized = normalizePhoneE164(b.telephone);
        submission.submitter.telephone = normalized || b.telephone.trim();
    }

    if (typeof b.titre === 'string') submission.propertyDraft.titre = b.titre.trim();
    if (typeof b.description === 'string') submission.propertyDraft.description = b.description.trim();
    if (typeof b.ville === 'string') submission.propertyDraft.ville = b.ville.trim();
    if (typeof b.adresse === 'string') submission.propertyDraft.adresse = b.adresse.trim();
    if (typeof b.transactionType === 'string') submission.propertyDraft.transactionType = b.transactionType;
    if (typeof b.categorie === 'string') submission.propertyDraft.categorie = b.categorie;

    const prix = toOptionalNumber(b.prix);
    if (prix !== undefined) submission.propertyDraft.prix = prix;
    const superficie = toOptionalNumber(b.superficie);
    if (superficie !== undefined) submission.propertyDraft.superficie = superficie;
    const chambres = toOptionalNumber(b.nombre_chambres);
    if (chambres !== undefined) submission.propertyDraft.nombre_chambres = chambres;
    const sdb = toOptionalNumber(b.nombre_salles_bain);
    if (sdb !== undefined) submission.propertyDraft.nombre_salles_bain = sdb;
    const salons = toOptionalNumber(b.nombre_salons);
    if (salons !== undefined) submission.propertyDraft.nombre_salons = salons;

    ['garage', 'gardien', 'balcon', 'piscine', 'jardin'].forEach((k) => {
        if (typeof b[k] === 'boolean') submission.propertyDraft[k] = b[k];
    });

    // Optional image list cleanup by admin while reviewing.
    if (Array.isArray(b.images)) {
        submission.propertyDraft.images = b.images
            .filter((img) => img && typeof img.url === 'string' && img.url.trim())
            .map((img) => ({
                url: String(img.url).trim(),
                label: String(img.label || '').trim(),
            }));
    }

    await submission.save();
    return sendResponse(res, submission, 'Soumission mise a jour pour examen.');
});

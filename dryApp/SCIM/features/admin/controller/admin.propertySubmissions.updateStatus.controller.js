const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { triggerSitemapRegeneration } = require('../../../utils/triggerSitemap');

const PropertySchema = require('../../property/model/property.schema');
const PropertySubmissionSchema = require('../../property/model/propertySubmission.schema');

const toPropertyImages = (images = []) =>
    images
        .filter((img) => img && img.url)
        .map((img, idx) => ({
            url: img.url,
            public_id: `submission-${Date.now()}-${idx}`,
        }));

module.exports = asyncHandler(async (req, res) => {
    const PropertySubmission = req.getModel('PropertySubmission', PropertySubmissionSchema);
    const Property = req.getModel('Property', PropertySchema);

    const submission = await PropertySubmission.findById(req.params.id);
    if (!submission) return sendResponse(res, null, 'Soumission introuvable.', false);

    const nextStatus = String(req.body?.status || '').trim().toLowerCase();
    if (!['approved', 'rejected'].includes(nextStatus)) {
        return sendResponse(res, null, 'Statut invalide. Utiliser approved ou rejected.', false);
    }

    if (submission.status !== 'pending') {
        return sendResponse(res, null, 'Cette soumission a deja ete traitee.', false);
    }

    submission.status = nextStatus;
    submission.reviewedBy = req.user.id;
    submission.reviewedAt = new Date();
    submission.reviewNote = String(req.body?.reviewNote || '').trim();

    if (nextStatus === 'approved') {
        const draft = submission.propertyDraft || {};
        const images = toPropertyImages(draft.images || []);
        if (!images.length) {
            return sendResponse(res, null, 'Impossible d approuver sans au moins une image.', false);
        }

        const created = await Property.create({
            titre: draft.titre,
            description: draft.description,
            prix: Number(draft.prix || 0),
            ville: draft.ville,
            adresse: draft.adresse,
            transactionType: draft.transactionType || 'location',
            categorie: draft.categorie || 'Autre',
            superficie: draft.superficie,
            nombre_chambres: draft.nombre_chambres,
            nombre_salles_bain: draft.nombre_salles_bain,
            nombre_salons: draft.nombre_salons,
            garage: Boolean(draft.garage),
            gardien: Boolean(draft.gardien),
            balcon: Boolean(draft.balcon),
            piscine: Boolean(draft.piscine),
            jardin: Boolean(draft.jardin),
            images,
            status: 'active',
            utilisateur: req.user.id,
            adminReference: req.user.id,
            submittedByUser: submission.submitter?.user || undefined,
            submissionSource: 'client_submission',
        });

        submission.createdProperty = created._id;
        await submission.save();
        triggerSitemapRegeneration('admin-submission-approved');

        return sendResponse(res, { submission, property: created }, 'Soumission approuvee et bien publie.');
    }

    // Rejet demande: suppression definitive de la soumission pour la retirer de la liste.
    await submission.deleteOne();
    return sendResponse(res, null, 'Soumission rejetee et supprimee.');
});

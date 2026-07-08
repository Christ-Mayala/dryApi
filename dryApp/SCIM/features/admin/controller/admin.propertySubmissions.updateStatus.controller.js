const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const logger = require('../../../../../dry/utils/logging/logger');
const { triggerSitemapRegeneration } = require('../../../utils/triggerSitemap');

const PropertySchema = require('../../property/model/property.schema');
const PropertySubmissionSchema = require('../../property/model/propertySubmission.schema');
const MessageSchema = require('../../message/model/message.schema');
const emailService = require('../../../../../dry/services/auth/email.service');
const config = require('../../../../../config/database');

const toPropertyImages = (images = []) =>
    images
        .filter((img) => img && img.url)
        .map((img, idx) => ({
            url: img.url,
            public_id: `submission-${Date.now()}-${idx}`,
        }));

/* ── helpers email ── */
const buildApprovedHtml = ({ nomComplet, titre, ville, prix, frontendUrl }) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#f4f4f5;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#d4af37,#92700a);padding:32px;text-align:center">
    <h1 style="margin:0;color:#09090b;font-size:28px;font-weight:900;letter-spacing:-1px">SCIM Immobilier</h1>
    <p style="margin:8px 0 0;color:#09090b;font-size:13px;opacity:0.7;font-weight:700;text-transform:uppercase;letter-spacing:2px">Votre bien a été approuvé</p>
  </div>
  <div style="padding:32px">
    <p style="font-size:16px;color:#a1a1aa">Bonjour <strong style="color:#fff">${nomComplet}</strong>,</p>
    <p style="font-size:15px;color:#a1a1aa;line-height:1.7">
      Nous avons le plaisir de vous informer que votre bien a été <strong style="color:#10b981">approuvé et publié</strong> sur la plateforme SCIM Immobilier.
    </p>
    <div style="background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:20px;margin:24px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#71717a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:120px">Bien</td><td style="color:#fff;font-weight:700">${titre}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Ville</td><td style="color:#fff">${ville || '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Prix</td><td style="color:#d4af37;font-weight:900">${prix ? new Intl.NumberFormat('fr-FR').format(prix) + ' XAF' : '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Statut</td><td><span style="background:#10b981;color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">Publié</span></td></tr>
      </table>
    </div>
    <div style="text-align:center;margin:32px 0">
      <a href="${frontendUrl}/properties" style="background:#d4af37;color:#09090b;padding:14px 32px;border-radius:12px;font-weight:900;text-decoration:none;font-size:13px;letter-spacing:1px;text-transform:uppercase;display:inline-block">
        Voir les annonces
      </a>
    </div>
    <p style="font-size:13px;color:#71717a">Merci pour votre confiance,<br/><strong style="color:#a1a1aa">L'équipe SCIM Immobilier</strong></p>
  </div>
  <div style="background:#18181b;padding:16px;text-align:center">
    <p style="margin:0;color:#52525b;font-size:11px">© ${new Date().getFullYear()} SCIM Immobilier • Congo-Brazzaville</p>
  </div>
</div>`;

const buildRejectedHtml = ({ nomComplet, titre, reviewNote, frontendUrl }) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#f4f4f5;border-radius:16px;overflow:hidden">
  <div style="background:#27272a;padding:32px;text-align:center;border-bottom:2px solid #3f3f46">
    <h1 style="margin:0;color:#d4af37;font-size:28px;font-weight:900;letter-spacing:-1px">SCIM Immobilier</h1>
    <p style="margin:8px 0 0;color:#a1a1aa;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px">Retour sur votre soumission</p>
  </div>
  <div style="padding:32px">
    <p style="font-size:16px;color:#a1a1aa">Bonjour <strong style="color:#fff">${nomComplet}</strong>,</p>
    <p style="font-size:15px;color:#a1a1aa;line-height:1.7">
      Après examen de votre dossier, nous ne sommes pas en mesure de publier votre bien "<strong style="color:#fff">${titre}</strong>" pour le moment.
    </p>
    ${reviewNote ? `
    <div style="background:#1c1c1e;border-left:3px solid #d4af37;padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0">
      <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#71717a;margin-bottom:8px">Motif</p>
      <p style="margin:0;color:#e4e4e7;line-height:1.6">${reviewNote}</p>
    </div>` : ''}
    <p style="font-size:14px;color:#a1a1aa;line-height:1.7">
      Vous pouvez corriger les points mentionnés et soumettre à nouveau votre bien via notre formulaire de soumission.
    </p>
    <div style="text-align:center;margin:32px 0">
      <a href="${frontendUrl}/soumettre-bien" style="background:#d4af37;color:#09090b;padding:14px 32px;border-radius:12px;font-weight:900;text-decoration:none;font-size:13px;letter-spacing:1px;text-transform:uppercase;display:inline-block">
        Soumettre à nouveau
      </a>
    </div>
    <p style="font-size:13px;color:#71717a">Cordialement,<br/><strong style="color:#a1a1aa">L'équipe SCIM Immobilier</strong></p>
  </div>
  <div style="background:#18181b;padding:16px;text-align:center">
    <p style="margin:0;color:#52525b;font-size:11px">© ${new Date().getFullYear()} SCIM Immobilier • Congo-Brazzaville</p>
  </div>
</div>`;

module.exports = asyncHandler(async (req, res) => {
    const PropertySubmission = req.getModel('PropertySubmission', PropertySubmissionSchema);
    const Property = req.getModel('Property', PropertySchema);
    const Message = req.getModel('Message', MessageSchema);

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

    const submitterEmail = String(submission.submitter?.email || '').trim().toLowerCase();
    const submitterName  = String(submission.submitter?.nomComplet || 'Client').trim();
    const propertyTitle  = String(submission.propertyDraft?.titre || 'votre bien').trim();
    const frontendUrl    = String(config.FRONTEND_URL || 'https://scim.netlify.app').split(',')[0].trim();

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

        // ── Email de notification : approbation ──
        if (submitterEmail) {
            try {
                await emailService.sendGenericEmail({
                    email: submitterEmail,
                    subject: `✅ Votre bien "${propertyTitle}" est maintenant publié sur SCIM`,
                    html: buildApprovedHtml({
                        nomComplet: submitterName,
                        titre: propertyTitle,
                        ville: draft.ville,
                        prix: draft.prix,
                        frontendUrl,
                    }),
                    text: `Bonjour ${submitterName}, votre bien "${propertyTitle}" a été approuvé et publié sur SCIM Immobilier. Consultez les annonces sur ${frontendUrl}/properties`,
                });
            } catch (err) {
                logger(`Email approbation soumission non envoyé: ${err?.message || err}`, 'warning');
            }
        }

        // ── Message interne : approbation ──
        if (submission.submitter?.user) {
            try {
                await Message.create({
                    expediteur: req.user.id,
                    destinataire: submission.submitter.user,
                    sujet: `Votre bien "${propertyTitle}" est maintenant en ligne ! 🎉`,
                    contenu: [
                        `Bonjour ${submitterName},`,
                        ``,
                        `Excellente nouvelle ! Votre bien a été examiné et approuvé par notre équipe.`,
                        ``,
                        `🏠 Bien : ${propertyTitle}`,
                        `📍 Ville : ${draft.ville || '—'}`,
                        `💰 Prix : ${draft.prix ? new Intl.NumberFormat('fr-FR').format(draft.prix) + ' XAF' : '—'}`,
                        `✅ Statut : Publié et visible sur la plateforme`,
                        ``,
                        `Consultez vos annonces sur : ${frontendUrl}/properties`,
                    ].join('\n'),
                });
            } catch (_) {}
        }

        return sendResponse(res, { submission, property: created }, 'Soumission approuvee et bien publie.');
    }

    // ── Rejet ──
    await submission.save();

    // ── Email de notification : rejet ──
    if (submitterEmail) {
        try {
            await emailService.sendGenericEmail({
                email: submitterEmail,
                subject: `Retour sur votre soumission "${propertyTitle}" — SCIM Immobilier`,
                html: buildRejectedHtml({
                    nomComplet: submitterName,
                    titre: propertyTitle,
                    reviewNote: submission.reviewNote,
                    frontendUrl,
                }),
                text: [
                    `Bonjour ${submitterName},`,
                    `Votre bien "${propertyTitle}" n'a pas pu être publié.`,
                    submission.reviewNote ? `Motif : ${submission.reviewNote}` : '',
                    `Vous pouvez corriger les points mentionnés et soumettre à nouveau sur ${frontendUrl}/soumettre-bien`,
                ].filter(Boolean).join('\n'),
            });
        } catch (err) {
            logger(`Email rejet soumission non envoyé: ${err?.message || err}`, 'warning');
        }
    }

    // ── Message interne : rejet ──
    if (submission.submitter?.user) {
        try {
            await Message.create({
                expediteur: req.user.id,
                destinataire: submission.submitter.user,
                sujet: `Retour sur votre bien "${propertyTitle}"`,
                contenu: [
                    `Bonjour ${submitterName},`,
                    ``,
                    `Après examen de votre dossier, nous ne sommes pas en mesure de publier votre bien "${propertyTitle}" pour le moment.`,
                    submission.reviewNote ? `\n📋 Motif : ${submission.reviewNote}` : '',
                    ``,
                    `Vous pouvez corriger les points mentionnés et soumettre à nouveau votre bien via le formulaire disponible sur la plateforme.`,
                    ``,
                    `N'hésitez pas à nous contacter si vous avez des questions.`,
                ].filter(line => line !== null).join('\n'),
            });
        } catch (_) {}
    }

    return sendResponse(res, { submission }, 'Soumission rejetee et conservee dans l\'historique.');
});

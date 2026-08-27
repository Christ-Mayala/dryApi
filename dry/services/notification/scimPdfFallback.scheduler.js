const cron = require('node-cron');

const config = require('../../../config/database');
const getModel = require('../../core/factories/modelFactory');
const logger = require('../../utils/logging/logger');
const emailService = require('../../services/auth/email.service');
const PdfService = require('../../services/documents/pdf.service');

const ReservationSchema = require('../../../dryApp/SCIM/features/reservation/model/reservation.schema');
const { decorateReservationForClient } = require('../../../dryApp/SCIM/features/reservation/controller/reservation.support.util');
const { buildReservationReceiptPdf } = require('../../../dryApp/SCIM/utils/scimDocument.util');

const APP_NAME = 'SCIM';
const CONFIRMED_STATUSES = ['confirmee', 'confirmed', 'confirmée'];

const parseBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const getScimAppExists = () => {
    const scimPath = require('path').join(process.cwd(), 'dryApp', APP_NAME);
    return require('fs').existsSync(scimPath);
};

let started = false;
let running = false;

const runPdfFallback = async () => {
    if (running) return;
    running = true;

    try {
        const delayMs = 2 * 60 * 60 * 1000; // 2h après confirmation sans téléchargement
        const maxBatch = Math.min(50, Math.max(1, Number.parseInt(config.SCIM_PDF_FALLBACK_BATCH_SIZE || '20', 10) || 20));
        const nowMs = Date.now();

        const Reservation = getModel(APP_NAME, 'Reservation', ReservationSchema);

        const candidates = await Reservation.find({
            status: { $in: CONFIRMED_STATUSES },
            $or: [
                { 'support.pdfAcknowledged': { $exists: false } },
                { 'support.pdfAcknowledged': false },
            ],
            $or: [
                { 'support.pdfEmailedAt': { $exists: false } },
                { 'support.pdfEmailedAt': null },
            ],
        })
            .sort({ updatedAt: 1 })
            .limit(maxBatch)
            .populate('property', 'titre ville adresse prix devise categorie utilisateur')
            .populate('user', 'name nom email telephone');

        const eligible = [];
        for (const r of candidates) {
            const confirmedAt = new Date(r.support?.confirmedAt || r.updatedAt || r.createdAt);
            if (Number.isNaN(confirmedAt.getTime())) continue;
            if (nowMs - confirmedAt.getTime() < delayMs) continue;
            if (!r.user?.email) continue;
            eligible.push(r);
        }

        if (!eligible.length) return;

        for (const reservation of eligible) {
            try {
                const data = decorateReservationForClient(reservation);
                const filename = `recu-${data.reference || data._id}.pdf`;

                const pdfBuffer = await PdfService.build(
                    (doc) => buildReservationReceiptPdf(doc, {
                        reservation: data,
                        property: reservation.property,
                        client: reservation.user,
                    }),
                    { size: 'A4', margin: 50 }
                );

                const base64Content = pdfBuffer.toString('base64');

                const ok = await emailService.sendGenericEmail({
                    email: reservation.user.email,
                    subject: `Votre reçu de réservation — ${data.reference}`,
                    html: `<p>Bonjour ${reservation.user.name || reservation.user.nom || ''},</p>
                           <p>Vous n'avez pas encore téléchargé votre reçu de réservation <strong>${data.reference}</strong> pour le bien <strong>"${reservation.property?.titre || ''}"</strong>.</p>
                           <p>Veuillez trouver ci-joint une copie de votre récapitulatif. Vous pouvez aussi le télécharger depuis votre tableau de bord.</p>
                           <p>L'équipe SCIM Immobilier</p>`,
                    text: `Bonjour ${reservation.user.name || reservation.user.nom || ''},\n\nVous n'avez pas encore téléchargé votre reçu de réservation ${data.reference}.\nVeuillez trouver ci-joint une copie de votre récapitulatif.\n\nL'équipe SCIM Immobilier`,
                    attachments: [
                        {
                            filename: filename,
                            content: base64Content,
                            encoding: 'base64',
                        },
                    ],
                });

                if (ok) {
                    reservation.support = reservation.support || {};
                    reservation.support.pdfEmailedAt = new Date();
                    reservation.support.pdfEmailAttempts = (reservation.support.pdfEmailAttempts || 0) + 1;
                    await reservation.save();
                    logger(`PDF fallback email sent for reservation ${reservation._id} to ${reservation.user.email}`, 'info');
                }
            } catch (error) {
                logger(`SCIM PDF fallback error for reservation ${reservation?._id}: ${error?.message || error}`, 'error');
            }
        }
    } catch (error) {
        logger(`SCIM PDF fallback scheduler failure: ${error.message}`, 'error');
    } finally {
        running = false;
    }
};

const startScimPdfFallbackScheduler = () => {
    if (started) return;
    started = true;

    if (!getScimAppExists()) return;

    const enabled = parseBool(config.SCIM_PDF_FALLBACK_ENABLED, true);
    if (!enabled) {
        logger('SCIM PDF fallback scheduler disabled by config', 'info');
        return;
    }

    const expression = String(config.SCIM_PDF_FALLBACK_CRON || '0 */6 * * *').trim();
    cron.schedule(expression, () => {
        runPdfFallback().catch(() => {});
    });

    setTimeout(() => {
        runPdfFallback().catch(() => {});
    }, 60000).unref();

    logger(`SCIM PDF fallback scheduler started (${expression})`, 'info');
};

module.exports = {
    startScimPdfFallbackScheduler,
    runPdfFallback,
};

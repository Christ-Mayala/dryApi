const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const config = require('../../../config/database');
const getModel = require('../../core/factories/modelFactory');
const logger = require('../../utils/logging/logger');

const ReservationSchema = require('../../../dryApp/SCIM/features/reservation/model/reservation.schema');
const MessageSchema = require('../../../dryApp/SCIM/features/message/model/message.schema');
const PropertySchema = require('../../../dryApp/SCIM/features/property/model/property.schema');
const {
    parseReminderMinutes,
    buildStatusHistoryEntry,
    findAdminContact,
    formatVisitDate,
    sendReservationContactNotifications,
    normalizeReservationStatusKey,
    CONFIRMED_STATUS_VALUES,
} = require('../../../dryApp/SCIM/features/reservation/controller/reservation.support.util');

const APP_NAME = 'SCIM';

const parseBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const isConfirmedStatus = (value) => normalizeReservationStatusKey(value) === 'confirmee';

const hasAcknowledged = (reservation) => Boolean(reservation?.support?.acknowledgedAt);

const hasReminderAlreadySent = (reservation) => Boolean(reservation?.support?.reminderSentAt);

const getConfirmedDate = (reservation) => {
    return reservation?.support?.confirmedAt || reservation?.updatedAt || reservation?.createdAt || null;
};

const shouldReminderTrigger = (reservation, nowMs, reminderAfterMinutes) => {
    if (!isConfirmedStatus(reservation?.status)) return false;
    if (hasAcknowledged(reservation)) return false;
    if (hasReminderAlreadySent(reservation)) return false;

    const confirmedAt = getConfirmedDate(reservation);
    if (!confirmedAt) return false;
    const confirmedAtMs = new Date(confirmedAt).getTime();
    if (Number.isNaN(confirmedAtMs)) return false;

    return nowMs - confirmedAtMs >= reminderAfterMinutes * 60 * 1000;
};

const getScimAppExists = () => {
    const scimPath = path.join(process.cwd(), 'dryApp', APP_NAME);
    return fs.existsSync(scimPath);
};

let started = false;
let running = false;

const processReservationReminder = async ({ reservation, Message, adminUser }) => {
    const reference = reservation.reference || reservation.support?.reference || reservation._id;
    const propertyTitle = reservation.property?.titre || 'le bien';
    const user = reservation.user;
    const visitDate = reservation.date;
    const now = new Date();

    try {
        if (adminUser && String(adminUser._id) !== String(user?._id || user)) {
            const lines = [
                `Rappel reservation ${reference}.`,
                `Bien: "${propertyTitle}".`,
                `Date de visite: ${formatVisitDate(visitDate)}.`,
                `Merci de confirmer la reception en repondant OUI ${reference}.`,
            ];
            await Message.create({
                expediteur: adminUser._id,
                destinataire: user?._id || user,
                sujet: `Rappel reservation ${reference}`,
                contenu: lines.join('\n'),
            });
        }
    } catch (_) {}

    let report = null;
    try {
        report = await sendReservationContactNotifications({
            reservation,
            user,
            propertyTitle,
            visitDate,
            stage: 'reminder',
        });
    } catch (_) {}

    reservation.support = reservation.support || {};
    reservation.support.reminderSentAt = now;
    reservation.support.reminderAttempts = Number(reservation.support.reminderAttempts || 0) + 1;
    reservation.support.lastContactAt = now;
    reservation.support.lastContactChannel = report?.primaryChannel || 'internal_message';
    reservation.statusHistory = [
        ...(Array.isArray(reservation.statusHistory) ? reservation.statusHistory : []),
        buildStatusHistoryEntry({
            status: reservation.status,
            actorId: adminUser?._id || null,
            note: `Relance automatique envoyee (${reservation.support.lastContactChannel || 'web'}).`,
            source: 'system',
        }),
    ];

    await reservation.save();
    return { reference, channel: reservation.support.lastContactChannel || '' };
};

const runScimReservationReminderNow = async () => {
    if (running) return;
    running = true;

    try {
        const reminderAfterMinutes = parseReminderMinutes();
        const maxBatch = Math.min(200, Math.max(1, Number.parseInt(config.SCIM_REMINDER_BATCH_SIZE || '30', 10) || 30));
        const nowMs = Date.now();

        const Reservation = getModel(APP_NAME, 'Reservation', ReservationSchema);
        const Message = getModel(APP_NAME, 'Message', MessageSchema);
        getModel(APP_NAME, 'Property', PropertySchema);
        const User = getModel(APP_NAME, 'User');

        const adminUser = await findAdminContact(User);
        const reservations = await Reservation.find({
            status: { $in: CONFIRMED_STATUS_VALUES },
            $and: [
                { $or: [{ 'support.acknowledgedAt': { $exists: false } }, { 'support.acknowledgedAt': null }] },
                { $or: [{ 'support.reminderSentAt': { $exists: false } }, { 'support.reminderSentAt': null }] },
            ],
        })
            .sort({ updatedAt: 1 })
            .limit(maxBatch)
            .populate('property', 'titre')
            .populate('user', 'name nom email telephone');

        const candidates = reservations.filter((r) => shouldReminderTrigger(r, nowMs, reminderAfterMinutes));
        if (!candidates.length) return;

        for (const reservation of candidates) {
            try {
                await processReservationReminder({ reservation, Message, adminUser });
            } catch (error) {
                logger(`SCIM reminder error for reservation ${reservation?._id}: ${error?.message || String(error)}`, 'error');
            }
        }
    } catch (error) {
        logger(`SCIM reminder scheduler failure: ${error?.message || String(error)}`, 'error');
    } finally {
        running = false;
    }
};

const startScimReservationReminderScheduler = () => {
    if (started) return;
    started = true;

    if (!getScimAppExists()) return;

    const enabled = parseBool(config.SCIM_REMINDER_ENABLED, true);
    if (!enabled) {
        logger('SCIM reminder scheduler disabled by config', 'info');
        return;
    }

    const expression = String(config.SCIM_REMINDER_CRON || '*/1 * * * *').trim();
    cron.schedule(expression, () => {
        runScimReservationReminderNow().catch(() => {});
    });

    setTimeout(() => {
        runScimReservationReminderNow().catch(() => {});
    }, 15000).unref();

    logger(`SCIM reminder scheduler started (${expression})`, 'info');
};

module.exports = {
    startScimReservationReminderScheduler,
    runScimReservationReminderNow,
};

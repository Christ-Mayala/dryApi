const asyncHandler = require('express-async-handler');
const PdfService = require('../../../../../dry/services/documents/pdf.service');

const PropertySchema = require('../../property/model/property.schema');
const MessageSchema = require('../../message/model/message.schema');
const ReservationSchema = require('../../reservation/model/reservation.schema');
const { normalizeReservationStatusKey, normalizeRequestTypeKey } = require('../../reservation/controller/reservation.support.util');
const { buildActivityReportPdf } = require('../../../utils/scimDocument.util');

const parseRangeDate = (value, fallback) => {
    const d = value ? new Date(value) : fallback;
    return Number.isNaN(d?.getTime()) ? fallback : d;
};

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);
    const User = req.getModel('User');
    const Message = req.getModel('Message', MessageSchema);
    const Reservation = req.getModel('Reservation', ReservationSchema);

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const from = parseRangeDate(req.query.from, defaultFrom);
    const to = parseRangeDate(req.query.to, now);

    const [
        activeProperties,
        newProperties,
        totalUsers,
        newUsers,
        newMessages,
        unreadMessages,
        reservationsInRange,
        topProperties,
    ] = await Promise.all([
        Property.countDocuments({ isDeleted: false, status: 'active' }),
        Property.countDocuments({ isDeleted: false, createdAt: { $gte: from, $lte: to } }),
        User.countDocuments({ status: { $ne: 'deleted' } }),
        User.countDocuments({ status: { $ne: 'deleted' }, createdAt: { $gte: from, $lte: to } }),
        Message.countDocuments({ createdAt: { $gte: from, $lte: to } }),
        Message.countDocuments({ lu: false }),
        Reservation.find({ createdAt: { $gte: from, $lte: to } }).select('status requestType'),
        Property.find({ isDeleted: false }).sort({ vues: -1 }).limit(8).select('titre ville vues'),
    ]);

    const reservationsByStatus = { en_attente: 0, confirmee: 0, terminee: 0, annulee: 0 };
    const reservationsByType = { visite: 0, location: 0, achat: 0 };

    for (const r of reservationsInRange) {
        const statusKey = normalizeReservationStatusKey(r.status);
        if (reservationsByStatus[statusKey] === undefined) reservationsByStatus[statusKey] = 0;
        reservationsByStatus[statusKey] += 1;

        const typeKey = normalizeRequestTypeKey(r.requestType);
        reservationsByType[typeKey] = (reservationsByType[typeKey] || 0) + 1;
    }

    const stats = {
        activeProperties,
        newProperties,
        totalUsers,
        newUsers,
        newMessages,
        unreadMessages,
        totalReservations: reservationsInRange.length,
        reservationsByStatus,
        reservationsByType,
        topProperties,
    };

    const filename = `rapport-activite-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.pdf`;
    const generatedBy = req.user?.nom || req.user?.name || req.user?.email || 'administration SCIM';
    const periodLabel = String(req.query.periodLabel || '').trim();

    return PdfService.stream(
        (doc) => buildActivityReportPdf(doc, { stats, range: { from, to }, generatedBy, periodLabel }),
        res,
        filename,
    );
});

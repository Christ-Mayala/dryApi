const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const PropertySchema = require('../../property/model/property.schema');
const MessageSchema = require('../../message/model/message.schema');
const ReservationSchema = require('../../reservation/model/reservation.schema');
const { normalizeReservationStatusKey } = require('../../reservation/controller/reservation.support.util');

const toIsoMonth = (date) => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

const monthRange = (size = 6) => {
    const out = [];
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);

    for (let i = size - 1; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        out.push(toIsoMonth(d));
    }

    return out;
};

const safeCount = (obj, key) => Number(obj?.[key] || 0);

module.exports = asyncHandler(async (req, res) => {
    const Property = req.getModel('Property', PropertySchema);
    const User = req.getModel('User');
    const Message = req.getModel('Message', MessageSchema);
    const Reservation = req.getModel('Reservation', ReservationSchema);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
        totalProperties,
        activeProperties,
        totalUsers,
        totalMessages,
        unreadMessages,
        newUsersThisMonth,
        topProperties,
        propertyTypes,
        reservationStatusAgg,
        totalReservations,
        reservationsThisMonth,
        createdInLast30,
        latestProperties,
        latestUsers,
        latestReservations,
        latestMessages,
        monthlyAgg,
    ] = await Promise.all([
        Property.countDocuments({ isDeleted: false }),
        Property.countDocuments({ isDeleted: false, $or: [{ status: 'active' }, { status: { $exists: false } }] }),
        User.countDocuments({ status: { $ne: 'deleted' } }),
        Message.countDocuments({}),
        Message.countDocuments({ lu: false }),
        User.countDocuments({ createdAt: { $gte: monthStart }, status: { $ne: 'deleted' } }),
        Property.find({ isDeleted: false })
            .sort({ createdAt: -1 })
            .limit(6)
            .select('titre ville prix categorie status transactionType isBonPlan noteMoyenne vues images favoris createdAt'),
        Property.aggregate([
            { $match: { isDeleted: false } },
            { $group: { _id: '$categorie', count: { $sum: 1 } } },
            { $project: { name: '$_id', value: '$count', _id: 0 } },
            { $sort: { value: -1 } },
        ]),
        Reservation.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Reservation.countDocuments({}),
        Reservation.countDocuments({ createdAt: { $gte: monthStart } }),
        Promise.all([
            Property.countDocuments({ isDeleted: false, createdAt: { $gte: last30Days } }),
            User.countDocuments({ status: { $ne: 'deleted' }, createdAt: { $gte: last30Days } }),
            Reservation.countDocuments({ createdAt: { $gte: last30Days } }),
            Message.countDocuments({ createdAt: { $gte: last30Days } }),
        ]),
        Property.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(3).select('titre ville createdAt'),
        User.find({ status: { $ne: 'deleted' } }).sort({ createdAt: -1 }).limit(3).select('name nom email createdAt'),
        Reservation.find({})
            .sort({ createdAt: -1 })
            .limit(4)
            .populate('property', 'titre')
            .populate('user', 'name nom email')
            .select('status createdAt date reference property user'),
        Message.find({})
            .sort({ createdAt: -1 })
            .limit(4)
            .populate('expediteur', 'name nom email')
            .populate('destinataire', 'name nom email')
            .select('sujet lu createdAt expediteur destinataire'),
        Promise.all([
            Property.aggregate([
                { $match: { isDeleted: false, createdAt: { $gte: sixMonthsAgo } } },
                { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
            ]),
            User.aggregate([
                { $match: { status: { $ne: 'deleted' }, createdAt: { $gte: sixMonthsAgo } } },
                { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
            ]),
            Reservation.aggregate([
                { $match: { createdAt: { $gte: sixMonthsAgo } } },
                { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
            ]),
        ]),
    ]);

    const [newPropertiesLast30, newUsersLast30, newReservationsLast30, newMessagesLast30] = createdInLast30;

    const reservationCounts = { en_attente: 0, confirmee: 0, annulee: 0 };
    for (const row of reservationStatusAgg || []) {
        const key = normalizeReservationStatusKey(row?._id);
        if (reservationCounts[key] === undefined) reservationCounts[key] = 0;
        reservationCounts[key] += safeCount(row, 'count');
    }

    const months = monthRange(6);
    const [propertyByMonthRaw, userByMonthRaw, reservationByMonthRaw] = monthlyAgg;

    const mapAgg = (rows) => {
        const out = {};
        for (const row of rows || []) {
            const y = row?._id?.y;
            const m = row?._id?.m;
            if (!y || !m) continue;
            out[`${y}-${String(m).padStart(2, '0')}`] = safeCount(row, 'count');
        }
        return out;
    };

    const propertyByMonth = mapAgg(propertyByMonthRaw);
    const userByMonth = mapAgg(userByMonthRaw);
    const reservationByMonth = mapAgg(reservationByMonthRaw);

    const salesData = months.map((month) => ({
        name: month,
        properties: propertyByMonth[month] || 0,
        users: userByMonth[month] || 0,
        reservations: reservationByMonth[month] || 0,
    }));

    const recentActivities = [
        ...latestProperties.map((p) => ({
            type: 'property',
            title: 'Nouveau bien',
            description: `${p.titre} (${p.ville || 'ville inconnue'})`,
            time: p.createdAt,
            status: 'success',
        })),
        ...latestUsers.map((u) => ({
            type: 'user',
            title: 'Nouvel utilisateur',
            description: `${u.name || ''} ${u.nom || ''}`.trim() || u.email,
            time: u.createdAt,
            status: 'info',
        })),
        ...latestMessages.map((m) => ({
            type: 'message',
            title: m.lu ? 'Message traite' : 'Message non lu',
            description: m.sujet || 'Sans sujet',
            time: m.createdAt,
            status: m.lu ? 'success' : 'warning',
        })),
        ...latestReservations.map((r) => ({
            type: 'reservation',
            title: 'Nouvelle reservation',
            description: `${r.property?.titre || 'Bien'} - ${normalizeReservationStatusKey(r.status)}`,
            time: r.createdAt,
            status: normalizeReservationStatusKey(r.status) === 'annulee' ? 'danger' : 'info',
        })),
    ]
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 10);

    const pendingReservations = reservationCounts.en_attente || 0;

    const payload = {
        stats: {
            totalProperties,
            activeProperties,
            pendingProperties: 0,
            totalUsers,
            activeUsers: totalUsers,
            newUsersThisMonth,
            totalMessages,
            unreadMessages,
            totalReservations,
            reservationsThisMonth,
            pendingReservations,
            confirmedReservations: reservationCounts.confirmee || 0,
            cancelledReservations: reservationCounts.annulee || 0,
        },
        topProperties,
        recentActivities,
        salesData,
        propertyTypes,

        // UI-ready dashboard blocks for a cleaner admin page.
        cards: [
            {
                key: 'properties',
                title: 'Biens actifs',
                value: activeProperties,
                subtitle: `${newPropertiesLast30} ajoutes sur 30 jours`,
                trend: newPropertiesLast30,
                trendType: newPropertiesLast30 > 0 ? 'up' : 'flat',
                color: '#0ea5e9',
                icon: 'building',
            },
            {
                key: 'users',
                title: 'Utilisateurs',
                value: totalUsers,
                subtitle: `${newUsersLast30} nouveaux sur 30 jours`,
                trend: newUsersLast30,
                trendType: newUsersLast30 > 0 ? 'up' : 'flat',
                color: '#10b981',
                icon: 'users',
            },
            {
                key: 'reservations',
                title: 'Reservations',
                value: totalReservations,
                subtitle: `${pendingReservations} en attente`,
                trend: newReservationsLast30,
                trendType: newReservationsLast30 > 0 ? 'up' : 'flat',
                color: '#f59e0b',
                icon: 'calendar',
            },
            {
                key: 'messages',
                title: 'Messagerie',
                value: totalMessages,
                subtitle: `${unreadMessages} non lus`,
                trend: newMessagesLast30,
                trendType: newMessagesLast30 > 0 ? 'up' : 'flat',
                color: '#8b5cf6',
                icon: 'mail',
            },
        ],
        highlights: {
            reservationStatus: [
                { key: 'en_attente', label: 'En attente', value: reservationCounts.en_attente || 0 },
                { key: 'confirmee', label: 'Confirmees', value: reservationCounts.confirmee || 0 },
                { key: 'annulee', label: 'Annulees', value: reservationCounts.annulee || 0 },
            ],
            quickActions: [
                { key: 'review_reservations', label: 'Traiter reservations en attente', count: pendingReservations, priority: pendingReservations > 0 ? 'high' : 'normal' },
                { key: 'reply_messages', label: 'Repondre aux messages non lus', count: unreadMessages, priority: unreadMessages > 0 ? 'high' : 'normal' },
            ],
        },
        feed: {
            reservations: latestReservations.map((r) => ({
                id: r._id,
                reference: r.reference || String(r._id),
                propertyTitle: r.property?.titre || 'Bien',
                customer: `${r.user?.name || ''} ${r.user?.nom || ''}`.trim() || r.user?.email || 'Client',
                status: normalizeReservationStatusKey(r.status),
                visitDate: r.date,
                createdAt: r.createdAt,
            })),
            messages: latestMessages.map((m) => ({
                id: m._id,
                subject: m.sujet || 'Sans sujet',
                read: Boolean(m.lu),
                from: `${m.expediteur?.name || ''} ${m.expediteur?.nom || ''}`.trim() || m.expediteur?.email || 'Expediteur',
                to: `${m.destinataire?.name || ''} ${m.destinataire?.nom || ''}`.trim() || m.destinataire?.email || 'Destinataire',
                createdAt: m.createdAt,
            })),
        },
    };

    return sendResponse(res, payload, 'Dashboard stats');
});

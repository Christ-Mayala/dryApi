const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const MessageSchema = require('../model/message.schema');
const ReservationSchema = require('../../reservation/model/reservation.schema');
const { buildStatusHistoryEntry, CONFIRMED_STATUS_VALUES } = require('../../reservation/controller/reservation.support.util');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);
    const User = req.getModel('User');

    const receiverId = req.params.receiverId;
    const sujet = String(req.body?.sujet || '').trim().slice(0, 200);
    const contenu = String(req.body?.contenu || '').trim();
    if (!contenu) return sendResponse(res, null, 'Message vide.', false);

    const dest = await User.findById(receiverId).select('role');
    if (!dest) return sendResponse(res, null, 'Destinataire introuvable.', false);

    const isAdminSender = req.user.role === 'admin';
    const isAdminDest = dest.role === 'admin';

    if (!isAdminSender && !isAdminDest) {
        return sendResponse(res, null, 'Vous ne pouvez contacter que l\'agence (admin).', false);
    }

    const message = await Message.create({
        expediteur: req.user.id,
        destinataire: receiverId,
        sujet,
        contenu,
    });

    if (!isAdminSender && isAdminDest) {
        try {
            const Reservation = req.getModel('Reservation', ReservationSchema);
            const text = `${sujet}\n${contenu}`.toLowerCase();

            const candidates = await Reservation.find({
                user: req.user.id,
                status: { $in: CONFIRMED_STATUS_VALUES },
                $or: [{ 'support.acknowledgedAt': { $exists: false } }, { 'support.acknowledgedAt': null }],
            })
                .sort({ 'support.confirmedAt': -1, updatedAt: -1 })
                .limit(10);

            let target = candidates.find((r) => {
                const ref = String(r.reference || r.support?.reference || '').toLowerCase();
                return ref && text.includes(ref);
            });

            if (!target && candidates.length === 1) {
                target = candidates[0];
            }

            if (target) {
                target.support = target.support || {};
                target.support.acknowledgedAt = new Date();
                target.support.lastContactAt = new Date();
                target.support.lastContactChannel = 'message_reply';
                target.statusHistory = [
                    ...(Array.isArray(target.statusHistory) ? target.statusHistory : []),
                    buildStatusHistoryEntry({
                        status: target.status,
                        actorId: req.user.id,
                        note: 'Accuse reception detecte via messagerie',
                        source: 'message',
                    }),
                ];
                await target.save();
            }
        } catch (_) {}
    }

    const populated = await Message.findById(message._id)
        .populate('expediteur', 'name nom email telephone')
        .populate('destinataire', 'name nom email telephone');

    const io = req.app?.get('io');
    if (io) {
        const me = String(req.user.id);
        const other = String(receiverId);
        io.to(me).emit('message:new', populated);
        io.to(other).emit('message:new', populated);
    }

    return sendResponse(res, populated, 'Message envoye');
});

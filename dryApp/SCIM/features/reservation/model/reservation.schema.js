const mongoose = require('mongoose');

const normalizeReservationStatus = (value) => {
    if (value === undefined || value === null) return value;
    const s = String(value).trim().toLowerCase();

    if (['en attente', 'en_attente', 'attente', 'pending', 'enattente'].includes(s)) return 'en attente';
    if (['confirmée', 'confirmee', 'confirmé', 'confirme', 'confirmed'].includes(s)) return 'confirmée';
    if (['annulée', 'annulee', 'annule', 'cancelled', 'canceled'].includes(s)) return 'annulée';

    return value;
};

const ReservationSchema = new mongoose.Schema(
    {
        property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: Date, required: true },
        status: {
            type: String,
            enum: ['en attente', 'confirmée', 'annulée', 'en_attente', 'confirmee', 'annulee', 'pending', 'confirmed', 'cancelled'],
            default: 'en attente',
            set: normalizeReservationStatus,
            get: normalizeReservationStatus,
        },
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true, getters: true },
        toObject: { virtuals: true, getters: true },
    },
);

module.exports = ReservationSchema;

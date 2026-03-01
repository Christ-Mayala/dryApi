const mongoose = require('mongoose');

const STATUS_ENUM = ['en_attente', 'confirmee', 'annulee'];

const stripDiacritics = (value) => {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

const normalizeReservationStatus = (value) => {
    if (value === undefined || value === null) return 'en_attente';
    const raw = stripDiacritics(value).trim().toLowerCase();
    if (!raw) return 'en_attente';

    const compact = raw.replace(/[\s-]+/g, '_');

    if (compact.startsWith('confirm')) return 'confirmee';
    if (compact.startsWith('annul') || compact.startsWith('cancel')) return 'annulee';
    if (compact === 'pending' || compact.includes('attente')) return 'en_attente';

    return compact;
};

const ReservationSchema = new mongoose.Schema(
    {
        property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: Date, required: true },
        telephone: { type: String, trim: true, default: '' },
        isWhatsapp: { type: Boolean, default: false },
        reference: { type: String, trim: true, uppercase: true, unique: true, sparse: true, index: true },
        status: {
            type: String,
            enum: STATUS_ENUM,
            default: 'en_attente',
            set: normalizeReservationStatus,
            get: normalizeReservationStatus,
        },
        statusHistory: [
            {
                status: {
                    type: String,
                    enum: STATUS_ENUM,
                    default: 'en_attente',
                    set: normalizeReservationStatus,
                    get: normalizeReservationStatus,
                },
                actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
                note: { type: String, trim: true, default: '' },
                source: { type: String, trim: true, default: 'web' },
                at: { type: Date, default: Date.now },
            },
        ],
        support: {
            mode: { type: String, trim: true, default: 'web_async' },
            reference: { type: String, trim: true, default: '' },
            expectedResponseMinutes: { type: Number, default: 30, min: 1 },
            reminderAfterMinutes: { type: Number, default: 30, min: 1 },
            whatsappPhone: { type: String, trim: true, default: '' },
            whatsappUrl: { type: String, trim: true, default: '' },
            requesterPhone: { type: String, trim: true, default: '' },
            requesterEmail: { type: String, trim: true, lowercase: true, default: '' },
            confirmedAt: { type: Date, default: null },
            acknowledgedAt: { type: Date, default: null },
            reminderSentAt: { type: Date, default: null },
            reminderAttempts: { type: Number, default: 0, min: 0 },
            lastContactAt: { type: Date, default: null },
            lastContactChannel: { type: String, trim: true, default: '' },
            asyncNotice: { type: String, trim: true, default: '' },
        },
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true, getters: true },
        toObject: { virtuals: true, getters: true },
    },
);

ReservationSchema.index({ user: 1, createdAt: -1 });
ReservationSchema.index({ property: 1, createdAt: -1 });

ReservationSchema.pre('validate', function normalizeLegacyReservationStatus() {
    this.status = normalizeReservationStatus(this.status);

    if (Array.isArray(this.statusHistory)) {
        for (const entry of this.statusHistory) {
            if (!entry) continue;
            entry.status = normalizeReservationStatus(entry.status);
        }
    }
});

module.exports = ReservationSchema;

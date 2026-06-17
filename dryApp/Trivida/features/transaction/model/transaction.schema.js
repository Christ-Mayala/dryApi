const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    localId: { type: Number }, // ID local du client (pour le mapping)
    
    type: { 
        type: String, 
        enum: ['revenu', 'depense', 'loan_in', 'loan_out', 'loan_repayment_received', 'loan_repayment_sent'],
        required: true,
        index: true
    },
    
    category: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true, index: true },
    description: { type: String, default: '' },
    
    // Liaison avec d'autres entités
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
    linkedId: { type: mongoose.Schema.Types.ObjectId }, // Pour les dettes/prêts
    moduleType: { type: String, enum: ['debt', 'activity', null], default: null },
    
    // Items (pour les transactions détaillées)
    items: { type: String }, // JSON stringifié côté mobile
    
    // Soft delete
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
}, {
    timestamps: true,
    versionKey: false,
});

// Index composés pour les requêtes fréquentes
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, type: 1 });
TransactionSchema.index({ userId: 1, category: 1 });

// Exclure les transactions supprimées
TransactionSchema.pre(/^find/, function() {
    this.where({ deleted: { $ne: true } });
});

module.exports = TransactionSchema;

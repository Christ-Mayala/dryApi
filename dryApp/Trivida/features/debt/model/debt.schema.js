const mongoose = require('mongoose');

const DebtSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    localId: { type: Number },
    
    contactName: { type: String, required: true },
    contactPhone: { type: String },
    
    amount: { type: Number, required: true },
    type: { type: String, enum: ['i_owe', 'owe_me', 'owes_me'], required: true }, // Je dois / On me doit (owes_me = alias legacy)
    status: { type: String, enum: ['pending', 'paid', 'settled', 'cancelled'], default: 'pending', index: true },
    
    dueDate: { type: Date },
    notes: { type: String },
    
    // Soft delete
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
}, {
    timestamps: true,
    versionKey: false,
});

// Index composés
DebtSchema.index({ userId: 1, status: 1 });
DebtSchema.index({ userId: 1, type: 1 });

// Exclure les dettes supprimées
DebtSchema.pre(/^find/, function() {
    this.where({ deleted: { $ne: true } });
});

module.exports = DebtSchema;

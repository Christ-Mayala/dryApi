const mongoose = require('mongoose');

const SavingsGoalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    localId: { type: Number },
    
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    
    targetDate: { type: Date },
    
    // Soft delete
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
}, {
    timestamps: true,
    versionKey: false,
});

// Index composés
SavingsGoalSchema.index({ userId: 1, name: 1 });

// Exclure les objectifs supprimés
SavingsGoalSchema.pre(/^find/, function() {
    this.where({ deleted: { $ne: true } });
});

module.exports = SavingsGoalSchema;

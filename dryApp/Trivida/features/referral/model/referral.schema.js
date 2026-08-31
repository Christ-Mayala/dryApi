const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  // Utilisateur qui parraine
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  referrerEmail: { type: String, required: true },
  
  // Code de parrainage unique (généré automatiquement)
  referralCode: { type: String, required: true, unique: true, uppercase: true },
  
  // Utilisateur parrainé (rempli quand le filleul s'inscrit)
  referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referredEmail: { type: String, default: null },
  
  // Statut : pending (invité mais pas inscrit), completed (inscrit), rewarded (récompense donnée)
  status: { type: String, enum: ['pending', 'completed', 'rewarded'], default: 'pending', index: true },
  
  // Récompenses
  referrerReward: { type: Number, default: 0 },       // Jours Premium offerts au parrain
  referredReward: { type: Number, default: 0 },        // Jours Premium offerts au filleul
  rewardType: { type: String, enum: ['premium_days', 'feature_unlock', null], default: null },
  
  // Dates
  invitedAt: { type: Date, default: Date.now },
  registeredAt: { type: Date },
  rewardedAt: { type: Date },
  
  // Tracking
  channel: { type: String, enum: ['whatsapp', 'sms', 'email', 'link', 'direct'], default: 'link' },
  
  // Soft delete
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { 
  timestamps: true, 
  versionKey: false 
});

// Index composés
ReferralSchema.index({ referralCode: 1 });
ReferralSchema.index({ referrerId: 1, status: 1 });
ReferralSchema.index({ referredUserId: 1 });

// Exclure les referrals supprimés
ReferralSchema.pre(/^find/, function() {
  this.where({ deleted: { $ne: true } });
});

module.exports = ReferralSchema;

const mongoose = require('mongoose');

const AnalyticsEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: String, required: true, index: true },
  date: { type: Date, default: Date.now, index: true },
  timestamp: { type: Number },
  
  // Propriétés flexibles pour chaque type d'événement
  props: { type: mongoose.Schema.Types.Mixed, default: {} },
  
  // Contexte
  platform: { type: String, enum: ['ios', 'android', 'web'] },
  appVersion: { type: String },
  
}, { 
  timestamps: true, 
  versionKey: false 
});

// Index composés pour les requêtes analytics
AnalyticsEventSchema.index({ userId: 1, event: 1, date: -1 });
AnalyticsEventSchema.index({ event: 1, date: -1 });
AnalyticsEventSchema.index({ date: -1 });

module.exports = AnalyticsEventSchema;

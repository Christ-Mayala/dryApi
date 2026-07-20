const mongoose = require('mongoose');

// Historique personnel : ce qu'un utilisateur a ressenti/pense pour une meditation
// donnee, a une date donnee. "createdBy" (plugin global) porte l'identite user.
const MeditationLogSchema = new mongoose.Schema({
  meditationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meditation', required: true },
  date: { type: Date, default: Date.now },
  feeling: { type: String, trim: true }, // ex: "paix", "doute", "joie", libre
  thoughts: { type: String, trim: true, maxlength: 5000 },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

MeditationLogSchema.index({ createdBy: 1, date: -1 });

module.exports = MeditationLogSchema;

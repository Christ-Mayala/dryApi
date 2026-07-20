const mongoose = require('mongoose');

// Une habitude spirituelle personnelle (ex: "Lire la Bible chaque jour", "Prier
// chaque matin"). Entierement geree par l'utilisateur — "createdBy" (plugin
// global) porte l'identite ; toujours filtre par proprietaire dans les controllers.
const HabitSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  icon: { type: String, trim: true, default: 'checkmark-circle-outline' }, // nom d'icone Ionicons
  frequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
  reminderTime: { type: String, trim: true, default: null }, // "HH:mm", gere cote client
  isActive: { type: Boolean, default: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

HabitSchema.index({ createdBy: 1, isActive: 1 });

module.exports = HabitSchema;

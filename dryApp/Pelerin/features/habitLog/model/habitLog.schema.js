const mongoose = require('mongoose');

// Une "case cochee" pour une habitude a une date donnee. Un log = ce jour-la
// l'habitude a ete faite. "createdBy" (plugin global) porte l'identite user.
const HabitLogSchema = new mongoose.Schema({
  habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
  date: { type: String, required: true, trim: true }, // "YYYY-MM-DD", simple et sans fuseau horaire
  label: { type: String, trim: true }
}, {
  timestamps: true
});

HabitLogSchema.index({ createdBy: 1, habitId: 1, date: 1 }, { unique: true });

module.exports = HabitLogSchema;

const mongoose = require('mongoose');

const ActivityRecetteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  localId: { type: Number },
  activityId: { type: Number },
  customerId: { type: Number },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  notes: { type: String },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true, versionKey: false });

ActivityRecetteSchema.index({ userId: 1, activityId: 1 });

// Middleware: exclure les documents supprimés
ActivityRecetteSchema.pre(/^find/, function() {
  this.where({ deleted: { $ne: true } });
});

module.exports = ActivityRecetteSchema;

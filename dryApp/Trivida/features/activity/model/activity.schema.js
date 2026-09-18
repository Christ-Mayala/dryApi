const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceId: { type: String },
  localId: { type: Number },
  name: { type: String, required: true },
  type: { type: String, required: true },
  manager: { type: String },
  description: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  aliases: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

ActivitySchema.index({ userId: 1, name: 1 });
ActivitySchema.index({ userId: 1, type: 1 });

ActivitySchema.pre(/^find/, function() {
  // Le pull de sync doit pouvoir inclure les tombstones (soft-deleted)
  // pour propager les suppressions entre appareils.
  if (this.options?.includeDeleted) return;
  this.where({ deleted: { $ne: true } });
});

module.exports = ActivitySchema;

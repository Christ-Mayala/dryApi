const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  localId: { type: Number },
  name: { type: String, required: true },
  type: { type: String, required: true },
  manager: { type: String },
  description: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true, versionKey: false });

ActivitySchema.index({ userId: 1, name: 1 });
ActivitySchema.index({ userId: 1, type: 1 });

ActivitySchema.pre(/^find/, function() {
  this.where({ deleted: { $ne: true } });
});

module.exports = ActivitySchema;

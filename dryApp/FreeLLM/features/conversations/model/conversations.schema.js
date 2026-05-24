const mongoose = require('mongoose');

const ConversationsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  title: { type: String, required: true, trim: true },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true
});

ConversationsSchema.index({ updatedAt: -1 });
ConversationsSchema.index({ createdAt: -1 });
ConversationsSchema.index({ userId: 1 });

module.exports = ConversationsSchema;

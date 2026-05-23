const mongoose = require('mongoose');

const ConversationsSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

ConversationsSchema.index({ updatedAt: -1 });
ConversationsSchema.index({ createdAt: -1 });

module.exports = ConversationsSchema;

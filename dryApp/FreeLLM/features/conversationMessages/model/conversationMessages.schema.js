const mongoose = require('mongoose');

const ConversationMessagesSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Conversations' },
  role: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  toolCalls: { type: String },
  toolCallId: { type: String, trim: true },
  files: { type: String },
  meta: { type: String },
  label: { type: String, trim: true }
}, {
  timestamps: true
});

ConversationMessagesSchema.index({ conversationId: 1 });
ConversationMessagesSchema.index({ createdAt: -1 });

module.exports = ConversationMessagesSchema;

const mongoose = require('mongoose');

const ReadingProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  lastPage: { type: Number, min: 1, required: true },
  progressPercentage: { type: Number, min: 0, max: 100, required: true },
  lastReadAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });
ReadingProgressSchema.index({ userId: 1, bookId: 1 }, { unique: true });
ReadingProgressSchema.index({ userId: 1, lastReadAt: -1 });
module.exports = ReadingProgressSchema;

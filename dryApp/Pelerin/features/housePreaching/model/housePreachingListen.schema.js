const mongoose = require('mongoose');

const HousePreachingListenSchema = new mongoose.Schema(
  {
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'HousePreaching', required: true },
    userId: { type: String, required: true, index: true },
    positionMs: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    lastPlayedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

HousePreachingListenSchema.index({ userId: 1, videoId: 1 }, { unique: true });

module.exports = HousePreachingListenSchema;

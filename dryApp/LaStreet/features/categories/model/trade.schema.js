const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeCategory', required: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

module.exports = TradeSchema;

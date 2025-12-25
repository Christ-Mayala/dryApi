const mongoose = require('mongoose');

const TradeCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

module.exports = TradeCategorySchema;

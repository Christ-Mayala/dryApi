/**
 * Schéma Mongoose — Clé API
 * Stocke uniquement le hash SHA-256 de la clé, jamais la clé en clair.
 * @module dry/models/apiKey/ApiKey.schema
 */
const mongoose = require('mongoose');

const ApiKeySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    keyHash: { type: String, required: true, unique: true, select: false },
    keyPrefix: { type: String, required: true }, // 8 premiers caractères de la clé brute, pour affichage
    permissions: {
      type: [String],
      enum: ['read', 'write', 'admin', 'billing', 'analytics'],
      default: ['read'],
    },
    status: { type: String, enum: ['active', 'revoked'], default: 'active', index: true },
    rateLimitMax: { type: Number, default: 1000, min: 10, max: 100000 },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

ApiKeySchema.index({ userId: 1, status: 1 });

module.exports = ApiKeySchema;

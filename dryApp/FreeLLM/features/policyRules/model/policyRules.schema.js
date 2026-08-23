const mongoose = require('mongoose');

/**
 * Custom Policy Rules — Règles de routage persistées en DB.
 *
 * Chaque règle contient :
 *   - name : nom lisible
 *   - description : description
 *   - enabled : active/désactivée
 *   - trigger : quand activer la règle (condition)
 *   - action : quoi faire (block, deprioritize, prefer, log)
 *   - severity : info, warning, block
 *   - priority : ordre d'évaluation
 */
const PolicyRulesSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  enabled: { type: Boolean, required: true, default: true },
  severity: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'block', 'deprioritize', 'prefer'],
    default: 'warning',
  },
  priority: { type: Number, required: true, default: 100 },

  // Trigger condition
  trigger: {
    // When to evaluate this rule
    provider: { type: String, trim: true },       // specific provider, or '*' for all
    taskType: { type: String, trim: true },        // specific task type, or '*' for all
    errorCategory: { type: String, trim: true },   // specific error category
    minErrorRate: { type: Number },                // trigger if error rate >= this
    minLatencyMs: { type: Number },                // trigger if avg latency >= this
    maxQuotaPercent: { type: Number },             // trigger if quota used >= this %
    timeOfDay: { type: String },                   // cron-like: "9-17" = business hours
  },

  // Action to take
  action: {
    type: { type: String, required: true, enum: ['block', 'deprioritize', 'prefer', 'log', 'redirect'] },
    penalty: { type: Number, default: 0 },         // deprioritize penalty points
    redirectProvider: { type: String },             // redirect to this provider
    message: { type: String },                      // custom message
  },

  // Stats
  lastTriggeredAt: { type: Date },
  triggerCount: { type: Number, default: 0 },

  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
});

PolicyRulesSchema.index({ enabled: 1, priority: 1 });
PolicyRulesSchema.index({ createdAt: -1 });

module.exports = PolicyRulesSchema;

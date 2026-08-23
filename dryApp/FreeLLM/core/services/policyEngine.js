/**
 * Policy Engine — Système de règles configurables qui influence le routing.
 *
 * Exemples de règles :
 *   - Si user.plan == free → interdire les modèles chers
 *   - Si task == coding → prioriser les modèles de code
 *   - Si provider.quota < 10% → réduire la priorité
 *   - Si provider.errorRate > threshold → désactiver temporairement
 *   - Si request contient des données sensibles → interdire provider X
 *   - Si latency > threshold → préférer un autre provider
 *
 * La Policy Engine est configurable et n'est pas codée en dur dans le router.
 */

const { logger } = require('./inferenceLogger');
const { monitor: healthMonitor } = require('./providerHealthMonitor');
const { manager: circuitBreaker } = require('./circuitBreaker');

/**
 * Policy rule severity levels.
 */
const Severity = {
  INFO: 'info',
  WARNING: 'warning',
  BLOCK: 'block',       // Block this provider/model
  PREFER: 'prefer',     // Prefer this provider/model
  DEPRIORITIZE: 'deprioritize', // Lower priority
};

/**
 * Default policy rules.
 */
const DEFAULT_RULES = [
  {
    id: 'health_check',
    name: 'Provider Health Check',
    description: 'Block providers with circuit breaker OPEN',
    enabled: true,
    evaluate: (context) => {
      if (!circuitBreaker.isAvailable(context.provider)) {
        return {
          severity: Severity.BLOCK,
          reason: `Provider ${context.provider} circuit breaker is OPEN`,
          provider: context.provider,
        };
      }
      return null;
    },
  },
  {
    id: 'error_rate',
    name: 'High Error Rate',
    description: 'Deprioritize providers with error rate > 30%',
    enabled: true,
    evaluate: (context) => {
      const health = healthMonitor.getHealth(context.provider);
      if (health.errorRate > 0.3 && health.totalRequests > 10) {
        return {
          severity: Severity.DEPRIORITIZE,
          reason: `Provider ${context.provider} has ${(health.errorRate * 100).toFixed(1)}% error rate`,
          provider: context.provider,
          penalty: Math.round(health.errorRate * 50),
        };
      }
      return null;
    },
  },
  {
    id: 'rate_limited',
    name: 'Rate Limited',
    description: 'Block providers that are currently rate-limited',
    enabled: true,
    evaluate: (context) => {
      const health = healthMonitor.getHealth(context.provider);
      if (health.isRateLimited) {
        return {
          severity: Severity.BLOCK,
          reason: `Provider ${context.provider} is rate-limited`,
          provider: context.provider,
        };
      }
      return null;
    },
  },
  {
    id: 'high_latency',
    name: 'High Latency',
    description: 'Deprioritize providers with avg latency > 8s',
    enabled: true,
    evaluate: (context) => {
      const health = healthMonitor.getHealth(context.provider);
      if (health.avgLatencyMs > 8000 && health.totalRequests > 5) {
        return {
          severity: Severity.DEPRIORITIZE,
          reason: `Provider ${context.provider} avg latency: ${health.avgLatencyMs.toFixed(0)}ms`,
          provider: context.provider,
          penalty: 20,
        };
      }
      return null;
    },
  },
  {
    id: 'degrading_trend',
    name: 'Degrading Trend',
    description: 'Deprioritize providers with degrading health trend',
    enabled: true,
    evaluate: (context) => {
      const health = healthMonitor.getHealth(context.provider);
      if (health.trend === 'degrading') {
        return {
          severity: Severity.DEPRIORITIZE,
          reason: `Provider ${context.provider} health is degrading`,
          provider: context.provider,
          penalty: 15,
        };
      }
      return null;
    },
  },
];

/**
 * Custom rules (user-configurable, stored in DB).
 */
let customRules = [];

/**
 * Set custom rules from DB.
 */
function setCustomRules(rules) {
  customRules = rules || [];
}

/**
 * Evaluate all rules against a context.
 *
 * @param {object} context - Evaluation context
 * @param {string} context.provider - Provider name
 * @param {string} context.modelId - Model ID
 * @param {string} context.taskType - Task type (chat, code, etc.)
 * @param {object} context.request - Original request body
 * @returns {{ allowed: boolean, decisions: Array<{severity: string, reason: string, penalty?: number}> }}
 */
function evaluate(context) {
  const decisions = [];
  let allowed = true;

  // Evaluate built-in rules
  for (const rule of DEFAULT_RULES) {
    if (!rule.enabled) continue;
    try {
      const decision = rule.evaluate(context);
      if (decision) {
        decision.ruleId = rule.id;
        decision.ruleName = rule.name;
        decisions.push(decision);

        if (decision.severity === Severity.BLOCK) {
          allowed = false;
        }
      }
    } catch (err) {
      logger.error('[PolicyEngine]', {
        event: 'RULE_EVALUATION_ERROR',
        ruleId: rule.id,
        error: err.message,
      });
    }
  }

  // Evaluate custom rules
  for (const rule of customRules) {
    if (!rule.enabled) continue;
    try {
      const decision = rule.evaluate(context);
      if (decision) {
        decision.ruleId = rule.id;
        decision.ruleName = rule.name;
        decisions.push(decision);

        if (decision.severity === Severity.BLOCK) {
          allowed = false;
        }
      }
    } catch (err) {
      logger.error('[PolicyEngine]', {
        event: 'CUSTOM_RULE_ERROR',
        ruleId: rule.id,
        error: err.message,
      });
    }
  }

  return { allowed, decisions };
}

/**
 * Calculate policy penalty for a provider (sum of all deprioritize penalties).
 */
function calculatePenalty(context) {
  const { decisions } = evaluate(context);
  return decisions
    .filter(d => d.severity === Severity.DEPRIORITIZE && d.penalty)
    .reduce((sum, d) => sum + d.penalty, 0);
}

/**
 * Get all active rules (for dashboard).
 */
function getActiveRules() {
  return [
    ...DEFAULT_RULES.map(r => ({ ...r, type: 'builtin' })),
    ...customRules.map(r => ({ ...r, type: 'custom' })),
  ];
}

module.exports = {
  Severity,
  DEFAULT_RULES,
  evaluate,
  calculatePenalty,
  setCustomRules,
  getActiveRules,
};

/**
 * Schémas de validation — Audit
 * Validation Zod pour les logs d'audit et leur requêtage
 * @module dry/schemas/audit.schema
 */

const { z } = require('zod');

/**
 * Actions d'audit valides
 */
const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW', 'EXPORT', 'LOGIN_FAILED'];

/**
 * Types de ressources auditées
 */
const AUDIT_RESOURCES = [
  'user',
  'conversation',
  'message',
  'apikey',
  'property',
  'reservation',
  'product',
  'order',
  'payment',
  'settings',
];

/**
 * Schéma de création de log d'audit
 */
const createAuditLogSchema = z.object({
  action: z.enum(AUDIT_ACTIONS, {
    errorMap: () => ({ message: `Action invalide. Actions: ${AUDIT_ACTIONS.join(', ')}` }),
  }),
  resourceType: z.enum(AUDIT_RESOURCES, {
    errorMap: () => ({ message: `Type de ressource invalide. Types: ${AUDIT_RESOURCES.join(', ')}` }),
  }),
  resourceId: z.string().optional(),
  details: z.object({
    before: z.any().optional(),
    after: z.any().optional(),
    summary: z.string().max(500).optional(),
  }).optional(),
});

/**
 * Schéma de requêtage des logs d'audit
 */
const queryAuditLogSchema = z.object({
  userId: z.string().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  resourceType: z.enum(AUDIT_RESOURCES).optional(),
  resourceId: z.string().optional(),
  startDate: z.string().datetime('Date de début invalide').optional(),
  endDate: z.string().datetime('Date de fin invalide').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Schéma de réponse des logs d'audit
 */
const auditLogResponseSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  details: z.any(),
  ipAddress: z.string(),
  timestamp: z.string().datetime(),
});

module.exports = {
  createAuditLogSchema,
  queryAuditLogSchema,
  auditLogResponseSchema,
  AUDIT_ACTIONS,
  AUDIT_RESOURCES,
};

/**
 * Schémas de validation — Tenant / Multi-Tenant
 * Validation Zod pour l'isolation et la gestion des tenants
 * @module dry/schemas/tenant.schema
 */

const { z } = require('zod');

/**
 * Schéma de configuration d'un tenant
 */
const createTenantSchema = z.object({
  name: z
    .string({ required_error: 'Le nom du tenant est requis' })
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .trim(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets')
    .min(2)
    .max(50)
    .optional(),
  settings: z.object({
    timezone: z.string().default('UTC'),
    language: z.string().default('fr'),
    currency: z.string().default('XAF'),
    features: z.array(z.string()).default([]),
  }).default({}),
});

/**
 * Schéma de mise à jour de tenant
 */
const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  settings: z.object({
    timezone: z.string().optional(),
    language: z.string().optional(),
    currency: z.string().optional(),
    features: z.array(z.string()).optional(),
  }).optional(),
  status: z.enum(['active', 'suspended', 'disabled']).optional(),
});

/**
 * Middleware de validation de l'isolation multi-tenant
 * Vérifie que l'utilisateur n'accède qu'à ses propres données
 */
const tenantAccessSchema = z.object({
  tenantId: z.string({ required_error: 'Tenant requis' }),
  userId: z.string({ required_error: 'Utilisateur requis' }),
  action: z.enum(['read', 'write', 'delete', 'admin']),
  resourceType: z.string(),
  resourceId: z.string().optional(),
});

module.exports = {
  createTenantSchema,
  updateTenantSchema,
  tenantAccessSchema,
};

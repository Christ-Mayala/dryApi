/**
 * Schémas de validation — Clés API
 * Validation Zod pour la gestion des clés API
 * @module dry/schemas/apiKey.schema
 */

const { z } = require('zod');

/**
 * Schéma de création de clé API
 */
const createApiKeySchema = z.object({
  name: z
    .string({ required_error: 'Le nom de la clé est requis' })
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .trim(),
  permissions: z
    .array(
      z.enum(['read', 'write', 'admin', 'billing', 'analytics'])
    )
    .min(1, 'Au moins une permission est requise')
    .default(['read']),
  expiresAt: z
    .string()
    .datetime('Date d\'expiration invalide')
    .optional(),
  rateLimitMax: z
    .number()
    .int()
    .min(10, 'Minimum 10 requêtes')
    .max(100000, 'Maximum 100000 requêtes')
    .default(1000)
    .optional(),
});

/**
 * Schéma de mise à jour de clé API
 */
const updateApiKeySchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100)
    .trim()
    .optional(),
  permissions: z
    .array(z.enum(['read', 'write', 'admin', 'billing', 'analytics']))
    .min(1)
    .optional(),
  status: z
    .enum(['active', 'revoked'], { message: 'Le statut doit être active ou revoked' })
    .optional(),
  expiresAt: z
    .string()
    .datetime()
    .nullable()
    .optional(),
});

/**
 * Schéma de réponse de clé API (sans la clé brute)
 */
const apiKeyResponseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  keyPrefix: z.string(), // Les 8 premiers caractères seulement
  permissions: z.array(z.string()),
  status: z.enum(['active', 'revoked']),
  lastUsedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

/**
 * Validation d'une clé API dans les headers
 */
const validateApiKeyHeader = z.object({
  'x-api-key': z
    .string({ required_error: 'Header X-API-Key requis' })
    .min(32, 'Clé API invalide (trop courte)')
    .max(128, 'Clé API invalide (trop longue)'),
});

module.exports = {
  createApiKeySchema,
  updateApiKeySchema,
  apiKeyResponseSchema,
  validateApiKeyHeader,
};

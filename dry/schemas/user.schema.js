/**
 * Schémas de validation — Utilisateur
 * Validation Zod pour les opérations CRUD sur les utilisateurs
 * @module dry/schemas/user.schema
 */

const { z } = require('zod');

/**
 * Schéma de création d'utilisateur
 */
const createUserSchema = z.object({
  name: z
    .string({ required_error: 'Le nom est requis' })
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .trim(),
  email: z
    .string({ required_error: 'L\'email est requis' })
    .email('Email invalide')
    .max(255, 'Email trop long')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'Le mot de passe est requis' })
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
    ),
  role: z
    .enum(['user', 'admin'], { message: 'Le rôle doit être user ou admin' })
    .default('user'),
  phone: z
    .string()
    .max(20, 'Numéro de téléphone trop long')
    .optional(),
});

/**
 * Schéma de mise à jour d'utilisateur (champs optionnels)
 */
const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100)
    .trim()
    .optional(),
  email: z
    .string()
    .email('Email invalide')
    .max(255)
    .trim()
    .toLowerCase()
    .optional(),
  phone: z
    .string()
    .max(20)
    .optional(),
  role: z
    .enum(['user', 'admin'])
    .optional(),
});

/**
 * Schéma de réponse utilisateur (sans données sensibles)
 */
const userResponseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
  phone: z.string().optional(),
  isPremium: z.boolean().default(false),
  premiumUntil: z.string().datetime().nullable().optional(),
  status: z.enum(['active', 'inactive', 'banned', 'deleted']).default('active'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Schéma de connexion
 */
const loginSchema = z.object({
  email: z
    .string({ required_error: 'L\'email est requis' })
    .email('Email invalide'),
  password: z
    .string({ required_error: 'Le mot de passe est requis' })
    .min(1, 'Le mot de passe est requis'),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  userResponseSchema,
  loginSchema,
};

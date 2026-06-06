/**
 * Schémas de validation — Conversation
 * Validation Zod pour les conversations FreeLLM
 * @module dry/schemas/conversation.schema
 */

const { z } = require('zod');

/**
 * Modèles disponibles
 */
const AVAILABLE_MODELS = [
  'gpt-4',
  'gpt-3.5-turbo',
  'claude-3',
  'claude-3-sonnet',
  'gemini-pro',
  'gemini-ultra',
  'mistral-large',
  'llama-3',
  'codestral',
  'deepseek-coder',
];

/**
 * Schéma de création de conversation
 */
const createConversationSchema = z.object({
  title: z
    .string({ required_error: 'Le titre est requis' })
    .min(1, 'Le titre ne peut pas être vide')
    .max(200, 'Le titre ne peut pas dépasser 200 caractères')
    .trim(),
  model: z
    .enum(AVAILABLE_MODELS, {
      errorMap: () => ({ message: `Modèle non supporté. Modèles disponibles: ${AVAILABLE_MODELS.join(', ')}` }),
    })
    .default('gpt-4'),
  description: z
    .string()
    .max(500, 'La description ne peut pas dépasser 500 caractères')
    .optional(),
  temperature: z
    .number()
    .min(0, 'La température doit être entre 0 et 2')
    .max(2, 'La température doit être entre 0 et 2')
    .default(0.7)
    .optional(),
  maxTokens: z
    .number()
    .int('Doit être un entier')
    .min(100, 'Minimum 100 tokens')
    .max(32000, 'Maximum 32000 tokens')
    .default(2048)
    .optional(),
  systemPrompt: z
    .string()
    .max(2000, 'Le prompt système ne peut pas dépasser 2000 caractères')
    .optional(),
});

/**
 * Schéma de mise à jour de conversation
 */
const updateConversationSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .trim()
    .optional(),
  model: z
    .enum(AVAILABLE_MODELS)
    .optional(),
  description: z
    .string()
    .max(500)
    .optional(),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .optional(),
  maxTokens: z
    .number()
    .int()
    .min(100)
    .max(32000)
    .optional(),
});

/**
 * Schéma pour l'envoi de message
 */
const sendMessageSchema = z.object({
  conversationId: z
    .string({ required_error: 'L\'ID de conversation est requis' })
    .regex(/^[a-f0-9]{24}$/, 'ID de conversation invalide'),
  content: z
    .string({ required_error: 'Le contenu du message est requis' })
    .min(1, 'Le message ne peut pas être vide')
    .max(50000, 'Le message ne peut pas dépasser 50000 caractères')
    .trim(),
  role: z
    .enum(['user', 'assistant', 'system'], { message: 'Le rôle doit être user, assistant ou system' })
    .default('user'),
});

module.exports = {
  createConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
  AVAILABLE_MODELS,
};

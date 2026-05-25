const { commonSchemas, validate } = require('../../utils/validation/validation.util');

// Validation pour les routes d'authentification (commun à toutes les applications)
const validateAuth = {
  register: (req, res, next) => {
    const { validateWithZod } = require('../../utils/validation/zod.util');
    const { z } = require('zod');
    const schema = z.object({
      name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
      email: z.string().email('Email invalide'),
      password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
      role: z.enum(['admin', 'user']).default('user')
    });
    const result = validateWithZod(schema, req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    next();
  },

  login: (req, res, next) => {
    const { validateWithZod } = require('../../utils/validation/zod.util');
    const { z } = require('zod');
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1)
    });
    const result = validateWithZod(schema, req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    next();
  }
};

// Validation pour les paramètres de requête communs
const validateQuery = {
  pagination: validate(
    commonSchemas.pagination,
    'query'
  ),

  search: (req, res, next) => {
    const { validateWithZod } = require('../../utils/validation/zod.util');
    const { z } = require('zod');
    const schema = z.object({
      search: z.string().max(100).optional(),
      category: z.string().optional(),
      status: z.enum(['active', 'inactive', 'pending']).optional()
    });
    const result = validateWithZod(schema, req.query);
    if (!result.success) return res.status(400).json({ error: result.error });
    next();
  }
};

module.exports = {
  validateAuth,
  validateQuery,
  validateId: require('../../utils/validation/validation.util').validateId
};

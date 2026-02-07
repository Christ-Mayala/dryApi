const { commonSchemas, validate } = require('../../utils/validation/validation.util');

// Validation pour les routes d'authentification (commun à toutes les applications)
const validateAuth = {
  register: validate(
    require('joi').object({
      name: commonSchemas.name,
      email: commonSchemas.email,
      password: commonSchemas.password,
      role: require('joi').string().valid('admin', 'user').default('user')
    })
  ),

  login: validate(
    require('joi').object({
      email: commonSchemas.email,
      password: require('joi').string().required()
    })
  )
};

// Validation pour les paramètres de requête communs
const validateQuery = {
  pagination: validate(
    commonSchemas.pagination,
    'query'
  ),

  search: validate(
    commonSchemas.pagination.keys({
      search: require('joi').string().max(100).optional(),
      category: require('joi').string().optional(),
      status: commonSchemas.status.optional()
    }),
    'query'
  )
};

module.exports = {
  validateAuth,
  validateQuery,
  validateId: require('../../utils/validation/validation.util').validateId
};

// Importer Zod
const { z } = require('zod');

// Exemple de schéma Zod pour un utilisateur
const userSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

// Fonction pour valider les données avec Zod
const validateWithZod = (schema, data) => {
  try {
    schema.parse(data);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.errors };
  }
};

module.exports = {
  userSchema,
  validateWithZod,
};
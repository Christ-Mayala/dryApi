const { z } = require('zod');
const { validateWithZod } = require('../../../../dry/utils/validation/zod.util');

const conversationSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').trim(),
});

const validateConversation = (req, res, next) => {
  const result = validateWithZod(conversationSchema, req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation échouée', details: result.error });
  }
  next();
};

module.exports = {
  validateConversation
};

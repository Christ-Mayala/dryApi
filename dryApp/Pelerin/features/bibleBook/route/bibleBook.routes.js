const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validatePelerin } = require('../../../validation/middleware');
const BibleBookSchema = require('../model/bibleBook.schema');

// Reference des 66 livres bibliques (donnee statique, seedee une fois via seed.js).
// Lecture publique, ecriture reservee a l'admin.
const router = buildCrudRouter('BibleBook', BibleBookSchema, {
  auth: { create: 'admin', update: 'admin', delete: 'admin' },
  caching: { list: 3600, get: 3600 },
  validation: {
    create: validatePelerin.bibleBook.create,
    update: validatePelerin.bibleBook.update,
  },
});

module.exports = router;

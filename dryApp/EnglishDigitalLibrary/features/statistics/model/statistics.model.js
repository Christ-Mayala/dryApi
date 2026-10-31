const BookSchema = require('../../books/model/book.schema');
const CategorySchema = require('../../categories/model/category.schema');

// Les statistiques utilisent les modèles propriétaires des features concernées.
exports.forTenant = req => ({
  Book: req.getModel('Book', BookSchema),
  Category: req.getModel('Category', CategorySchema),
});

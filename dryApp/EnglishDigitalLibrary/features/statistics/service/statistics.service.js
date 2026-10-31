const statisticsModel = require('../model/statistics.model');
const { publicFilter, card } = require('../../books/service/book.service');

async function home(req) {
  const { Book, Category } = statisticsModel.forTenant(req); const filter = publicFilter(req);
  const [recent, popular, totalBooks, totalCategories] = await Promise.all([
    Book.find(filter).sort({ publishedAt: -1 }).limit(6).populate('categoryId', 'name slug').lean(),
    Book.find(filter).sort({ viewsCount: -1 }).limit(6).populate('categoryId', 'name slug').lean(),
    Book.countDocuments(filter), Category.countDocuments({ status: 'active', parentId: null }),
  ]);
  return { recent: recent.map(card), popular: popular.map(card), totalBooks, totalCategories };
}

/** Les indicateurs sont agrégés à partir des enregistrements de la bibliothèque. */
async function admin(req) {
  const { Book, Category } = statisticsModel.forTenant(req);
  const [books, categories, published, pending, views, downloads] = await Promise.all([
    Book.countDocuments(), Category.countDocuments({ status: 'active' }), Book.countDocuments({ status: 'Published' }),
    Book.countDocuments({ status: 'Pending Validation' }), Book.aggregate([{ $group: { _id: null, n: { $sum: '$viewsCount' } } }]),
    Book.aggregate([{ $group: { _id: null, n: { $sum: '$downloadsCount' } } }]),
  ]);
  return { books, categories, published, pendingValidation: pending, views: views[0]?.n || 0, downloads: downloads[0]?.n || 0 };
}

module.exports = { home, admin };

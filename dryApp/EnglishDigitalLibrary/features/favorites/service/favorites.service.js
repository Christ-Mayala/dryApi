const mongoose = require('mongoose');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const FavoriteSchema = require('../model/favorite.schema');
const BookSchema = require('../../books/model/book.schema');
const CategorySchema = require('../../categories/model/category.schema');
const { publicFilter, card } = require('../../books/service/book.service');

async function list(req) {
  const Favorite = req.getModel('Favorite', FavoriteSchema); req.getModel('Book', BookSchema); req.getModel('Category', CategorySchema);
  const records = await Favorite.find({ userId: req.user._id }).sort({ createdAt: -1 }).populate({ path: 'bookId', match: publicFilter(req), populate: { path: 'categoryId', select: 'name slug' } }).lean();
  return records.map(row => row.bookId).filter(Boolean).map(card);
}

async function add(req, bookId) {
  if (!mongoose.Types.ObjectId.isValid(bookId)) throw httpError('Invalid book id.', 400);
  const Book = req.getModel('Book', BookSchema); const Favorite = req.getModel('Favorite', FavoriteSchema);
  const book = await Book.findOne({ _id: bookId, ...publicFilter(req) });
  if (!book) throw httpError('Book not found.', 404);
  await Favorite.updateOne({ userId: req.user._id, bookId: book._id }, { $setOnInsert: { userId: req.user._id, bookId: book._id } }, { upsert: true });
}

async function remove(req, bookId) {
  if (!mongoose.Types.ObjectId.isValid(bookId)) throw httpError('Invalid book id.', 400);
  const Favorite = req.getModel('Favorite', FavoriteSchema);
  await Favorite.deleteOne({ userId: req.user._id, bookId });
}

module.exports = { list, add, remove };

const mongoose = require('mongoose');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const ReadingProgressSchema = require('../model/readingProgress.schema');
const BookSchema = require('../../books/model/book.schema');
const CategorySchema = require('../../categories/model/category.schema');
const { publicFilter, card } = require('../../books/service/book.service');

async function list(req) {
  const Progress = req.getModel('ReadingProgress', ReadingProgressSchema); req.getModel('Book', BookSchema); req.getModel('Category', CategorySchema);
  const records = await Progress.find({ userId: req.user._id }).sort({ lastReadAt: -1 }).limit(100).populate({ path: 'bookId', match: publicFilter(req), populate: { path: 'categoryId', select: 'name slug' } }).lean();
  return records.filter(row => row.bookId).map(row => ({ book: card(row.bookId), lastPage: row.lastPage, percentage: row.progressPercentage, lastReadAt: row.lastReadAt }));
}

async function save(req, bookId, input) {
  const { lastPage, progressPercentage } = input || {};
  if (!mongoose.Types.ObjectId.isValid(bookId) || !Number.isInteger(lastPage) || lastPage < 1 || !Number.isFinite(progressPercentage) || progressPercentage < 0 || progressPercentage > 100) throw httpError('Invalid reading progress.', 400);
  const Book = req.getModel('Book', BookSchema); const Progress = req.getModel('ReadingProgress', ReadingProgressSchema);
  const book = await Book.findOne({ _id: bookId, ...publicFilter(req) });
  if (!book) throw httpError('Book not found.', 404);
  return Progress.findOneAndUpdate({ userId: req.user._id, bookId: book._id }, { $set: { lastPage, progressPercentage, lastReadAt: new Date() } }, { upsert: true, new: true, runValidators: true });
}

module.exports = { list, save };

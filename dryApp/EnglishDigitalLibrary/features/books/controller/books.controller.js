const mongoose = require('mongoose');
const sendResponse = require('../../../../../dry/utils/http/response');
const BookSchema = require('../model/book.schema');
const CategorySchema = require('../../categories/model/category.schema');
const FavoriteSchema = require('../../favorites/model/favorite.schema');
const ReadingProgressSchema = require('../../reading/model/readingProgress.schema');
const { model, uniqueSlug, publicFilter, card } = require('../service/book.service');
const { categoryPath } = require('../../categories/service/category.service');
const storage = require('../service/storage.service');

const fail = (res, status, message) => sendResponse(res, null, message, false, undefined, status);
const isStaff = user => user && ['admin', 'librarian'].includes(user.role);
const canView = (book, user) => isStaff(user) || (book.status === 'Published' && book.visibility !== 'staff' && (book.visibility !== 'registered' || Boolean(user)));
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** La recherche, les filtres, le tri et la pagination s'exécutent côté API. */
exports.list = async (req, res) => {
  const Book = model(req, 'Book', BookSchema); const Category = model(req, 'Category', CategorySchema);
  const filter = { ...publicFilter(req) };
  const q = String(req.query.q || '').trim().slice(0, 120);
  if (q) {
    const rx = { $regex: escaped(q), $options: 'i' };
    filter.$or = [{ title: rx }, { authors: rx }, { tags: rx }, { description: rx }, { isbn: rx }, { publisher: rx }];
  }
  if (req.query.author) filter.authors = { $regex: escaped(String(req.query.author).slice(0, 80)), $options: 'i' };
  if (req.query.level) filter.readingLevel = String(req.query.level);
  if (req.query.category) {
    const category = await Category.findOne({ slug: String(req.query.category), status: 'active' }).select('_id').lean();
    if (!category) return sendResponse(res, [], 'Books', true, { total: 0, page: 1, limit: 18, pages: 0 });
    filter.categoryPath = category._id;
  }
  const year = {};
  if (Number(req.query.yearFrom)) year.$gte = Number(req.query.yearFrom);
  if (Number(req.query.yearTo)) year.$lte = Number(req.query.yearTo);
  if (Object.keys(year).length) filter.publicationYear = year;
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 18));
  const sorts = { newest: { publishedAt: -1 }, popular: { viewsCount: -1 }, title: { title: 1 }, 'year-desc': { publicationYear: -1 }, 'year-asc': { publicationYear: 1 } };
  const sort = sorts[String(req.query.sort)] || { publishedAt: -1 };
  const [books, count] = await Promise.all([
    Book.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate('categoryId', 'name slug').lean(),
    Book.countDocuments(filter),
  ]);
  sendResponse(res, books.map(card), 'Books', true, { total: count, page, limit, pages: Math.ceil(count / limit) });
};

/** Tableau d'administration : les brouillons restent invisibles aux routes publiques. */
exports.adminList = async (req, res) => {
  const Book = model(req, 'Book', BookSchema); model(req, 'Category', CategorySchema);
  const filter = {};
  if (req.query.status && ['Draft', 'Pending Validation', 'Published', 'Rejected', 'Archived'].includes(String(req.query.status))) filter.status = String(req.query.status);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 25));
  const [books, total] = await Promise.all([Book.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).populate('categoryId', 'name slug').lean(), Book.countDocuments(filter)]);
  sendResponse(res, books.map(book => ({ ...card(book), status: book.status, rightsStatus: book.rightsStatus, languageValidationStatus: book.languageValidationStatus, languageValidationNote: book.languageValidationNote, license: book.license, source: book.source, downloadAllowed: book.downloadAllowed, documentAvailable: Boolean(book.documentPublicId || book.externalReadUrl) })), 'Managed books', true, { total, page, limit, pages: Math.ceil(total / limit) });
};

exports.getBySlug = async (req, res) => {
  const Book = model(req, 'Book', BookSchema); model(req, 'Category', CategorySchema);
  const book = await Book.findOne({ ...publicFilter(req), slug: req.params.slug }).populate('categoryId', 'name slug').lean();
  if (!book) return fail(res, 404, 'Book not found.');
  await Book.updateOne({ _id: book._id }, { $inc: { viewsCount: 1 } });
  sendResponse(res, { ...card(book), description: book.description, publisher: book.publisher, isbn: book.isbn, license: book.license, source: book.source, visibility: book.visibility, downloadAllowed: book.downloadAllowed, languageValidationStatus: book.languageValidationStatus, languageValidationNote: book.languageValidationNote }, 'Book details');
};

exports.create = async (req, res) => {
  const data = req.body || {};
  if (typeof data.title !== 'string' || data.title.trim().length < 2 || !Array.isArray(data.authors) || !data.authors.length || !mongoose.Types.ObjectId.isValid(data.categoryId)) return fail(res, 400, 'Title, at least one author, and a valid category are required.');
  const Book = model(req, 'Book', BookSchema); const path = await categoryPath(req, data.categoryId);
  // Les champs de stockage et de publication ne sont jamais acceptés depuis le formulaire.
  const input = {
    title: data.title.trim(), authors: data.authors, description: data.description || '', categoryId: data.categoryId,
    tags: Array.isArray(data.tags) ? data.tags : [], publisher: data.publisher || '', publicationYear: data.publicationYear,
    isbn: data.isbn || '', pageCount: data.pageCount, readingLevel: data.readingLevel || '', externalReadUrl: data.externalReadUrl || '',
    visibility: data.visibility || 'public', downloadAllowed: data.downloadAllowed === true,
    license: data.license || '', source: data.source || '',
  };
  const book = await Book.create({ ...input, slug: await uniqueSlug(req, data.title), language: 'English', categoryPath: path, status: 'Draft', languageValidationStatus: 'Pending', rightsStatus: 'pending', createdBy: req.user._id, updatedBy: req.user._id });
  sendResponse(res, book, 'Book created as a draft', true, undefined, 201);
};

exports.update = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, 'Invalid book id.');
  const Book = model(req, 'Book', BookSchema); const book = await Book.findById(req.params.id);
  if (!book) return fail(res, 404, 'Book not found.');
  const editable = ['title', 'authors', 'description', 'tags', 'publisher', 'publicationYear', 'isbn', 'pageCount', 'readingLevel', 'visibility', 'downloadAllowed', 'license', 'source', 'externalReadUrl'];
  for (const key of editable) if (req.body?.[key] !== undefined) book[key] = req.body[key];
  if (req.body?.categoryId !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(req.body.categoryId)) return fail(res, 400, 'Invalid category.');
    book.categoryId = req.body.categoryId; book.categoryPath = await categoryPath(req, req.body.categoryId);
  }
  if (req.body?.status === 'Published') {
    if (req.user.role !== 'admin') return fail(res, 403, 'Only an administrator can publish books.');
    if (book.languageValidationStatus !== 'Valid' || book.rightsStatus !== 'approved' || (!book.documentPublicId && !book.externalReadUrl)) return fail(res, 409, 'English review, distribution rights approval, and a PDF or approved reading source are required before publication.');
    book.status = 'Published'; book.publishedAt = new Date();
  } else if (req.body?.status === 'Archived' && req.user.role === 'admin') book.status = 'Archived';
  else if (req.body?.status !== undefined) return fail(res, 400, 'Use the review route to change validation status.');
  book.updatedBy = req.user._id; await book.save();
  sendResponse(res, book, 'Book updated');
};

exports.review = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, 'Invalid book id.');
  const Book = model(req, 'Book', BookSchema); const book = await Book.findById(req.params.id);
  if (!book) return fail(res, 404, 'Book not found.');
  const { languageStatus, rightsStatus, note = '' } = req.body || {};
  if (languageStatus !== undefined) {
    if (req.user.role !== 'admin') return fail(res, 403, 'Only an administrator can approve language validation.');
    if (!['Valid', 'Invalid', 'Manual Review'].includes(languageStatus)) return fail(res, 400, 'Invalid language review status.');
    book.languageValidationStatus = languageStatus;
  }
  if (rightsStatus !== undefined) {
    if (req.user.role !== 'admin') return fail(res, 403, 'Only an administrator can approve distribution rights.');
    if (!['approved', 'rejected', 'pending'].includes(rightsStatus)) return fail(res, 400, 'Invalid rights review status.');
    if (rightsStatus === 'approved' && (!book.license?.trim() || !book.source?.trim())) return fail(res, 409, 'Add the document license and source before approving distribution rights.');
    book.rightsStatus = rightsStatus;
  }
  book.languageValidationNote = String(note).slice(0, 1000);
  if (book.languageValidationStatus === 'Invalid' || book.rightsStatus === 'rejected') book.status = 'Rejected';
  else if (book.status === 'Draft' && (book.documentPublicId || book.externalReadUrl)) book.status = 'Pending Validation';
  await book.save();
  sendResponse(res, book, 'Review saved');
};

exports.remove = async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, 'Only an administrator can delete books.');
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, 'Invalid book id.');
  const Book = model(req, 'Book', BookSchema); const book = await Book.findById(req.params.id);
  if (!book) return fail(res, 404, 'Book not found.');
  await Promise.all([storage.remove(book.documentPublicId, 'raw', book.documentStorageProvider || 'cloudinary'), storage.remove(book.coverPublicId, 'image')]);
  const Favorite = model(req, 'Favorite', FavoriteSchema); const Progress = model(req, 'ReadingProgress', ReadingProgressSchema);
  await Promise.all([Favorite.deleteMany({ bookId: book._id }), Progress.deleteMany({ bookId: book._id })]);
  await book.deleteOne();
  sendResponse(res, { id: req.params.id }, 'Book deleted');
};

/** Les PDF restent privés; l'administrateur doit les valider avant publication. */
exports.uploadDocument = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, 'Invalid book id.');
  const file = req.file;
  if (!file || file.mimetype !== 'application/pdf' || file.buffer.subarray(0, 5).toString() !== '%PDF-') return fail(res, 400, 'Upload a valid PDF document up to 80 MB.');
  const Book = model(req, 'Book', BookSchema); const book = await Book.findById(req.params.id);
  if (!book) return fail(res, 404, 'Book not found.');
  const uploaded = await storage.uploadDocument(file.buffer, { folder: 'english_digital_library/documents', public_id: `${String(book._id)}-${Date.now()}` });
  const previous = book.documentPublicId; const previousProvider = book.documentStorageProvider || 'cloudinary';
  book.documentPublicId = uploaded.public_id; book.documentUrl = uploaded.secure_url; book.documentStorageProvider = uploaded.storage_provider; book.documentBytes = file.size; book.externalReadUrl = '';
  // Publication automatique après téléversement par un administrateur.
  book.languageValidationStatus = 'Valid';
  book.languageValidationNote = '';
  book.rightsStatus = 'approved';
  book.status = 'Published'; book.publishedAt = new Date(); book.updatedBy = req.user._id;
  await book.save();
  if (previous) await storage.remove(previous, 'raw', previousProvider);
  sendResponse(res, { id: String(book._id), languageValidationStatus: book.languageValidationStatus, languageValidationNote: book.languageValidationNote, status: book.status }, 'PDF stored privately; manual review required', true, undefined, 201);
};

exports.uploadCover = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, 'Invalid book id.');
  const file = req.file; const bytes = file?.buffer;
  const jpeg = bytes && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = bytes && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!file || file.size > 5 * 1024 * 1024 || !(jpeg || png || webp)) return fail(res, 400, 'Upload a valid JPEG, PNG, or WebP cover up to 5 MB.');
  const Book = model(req, 'Book', BookSchema); const book = await Book.findById(req.params.id);
  if (!book) return fail(res, 404, 'Book not found.');
  const uploaded = await storage.upload(bytes, { folder: 'english_digital_library/covers', resource_type: 'image', format: 'webp', public_id: `${String(book._id)}-${Date.now()}`, overwrite: false });
  const previous = book.coverPublicId; book.coverPublicId = uploaded.public_id; book.coverUrl = uploaded.secure_url; book.updatedBy = req.user._id;
  await book.save(); if (previous) await storage.remove(previous, 'image');
  sendResponse(res, { coverUrl: book.coverUrl }, 'Cover uploaded', true, undefined, 201);
};

exports.readDocument = async (req, res) => {
  const Book = model(req, 'Book', BookSchema); const book = await Book.findOne({ slug: req.params.slug }).lean();
  if (!book || !canView(book, req.user)) return fail(res, 404, 'Book not found.');
  if (book.externalReadUrl) {
    return fail(res, 409, 'Open this title in the on-site text reader.');
  }
  if (!book.documentPublicId) return fail(res, 404, 'Document is not available.');
  res.set('Cache-Control', 'private, no-store'); res.redirect(302, await storage.privatePdfUrl(book.documentPublicId, false, book.documentStorageProvider || 'cloudinary'));
};

exports.downloadDocument = async (req, res) => {
  const Book = model(req, 'Book', BookSchema); const book = await Book.findOne({ slug: req.params.slug }).lean();
  if (!book || !canView(book, req.user)) return fail(res, 404, 'Book not found.');
  if (!book.downloadAllowed || !book.documentPublicId) return fail(res, 403, 'Downloads are not permitted for this book.');
  await Book.updateOne({ _id: book._id }, { $inc: { downloadsCount: 1 } });
  res.set('Cache-Control', 'private, no-store'); res.redirect(302, await storage.privatePdfUrl(book.documentPublicId, true, book.documentStorageProvider || 'cloudinary'));
};

const slugify = require('slugify');

const slugFor = value => slugify(value, { lower: true, strict: true, trim: true }) || 'book';
const model = (req, name, schema) => req.getModel(name, schema);

async function uniqueSlug(req, title, excludeId) {
  const Book = model(req, 'Book', require('../model/book.schema'));
  const base = slugFor(title);
  let candidate = base;
  for (let suffix = 2; await Book.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); suffix += 1) candidate = `${base}-${suffix}`;
  return candidate;
}

function publicFilter(req) {
  const user = req.user;
  return {
    status: 'Published',
    ...(user ? { visibility: { $in: ['public', 'registered'] } } : { visibility: 'public' }),
  };
}

function card(book) {
  return {
    id: String(book._id), slug: book.slug, title: book.title, authors: book.authors || [],
    description: book.description || '', coverUrl: book.coverUrl || '', category: book.categoryId || null,
    externalReadUrl: book.externalReadUrl || '',
    categoryPath: book.categoryPath || [], categoryName: book.categoryId?.name || '',
    categorySlug: book.categoryId?.slug || '', publicationYear: book.publicationYear || null,
    pageCount: book.pageCount || null, readingLevel: book.readingLevel || '', tags: book.tags || [],
    status: book.status, viewsCount: book.viewsCount || 0,
  };
}

module.exports = { slugFor, model, uniqueSlug, publicFilter, card };

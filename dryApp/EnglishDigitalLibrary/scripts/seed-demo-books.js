require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const { connectCluster } = require('../../../dry/config/connection/dbConnection');
const getModel = require('../../../dry/core/factories/modelFactory');
const BookSchema = require('../features/books/model/book.schema');
const CategorySchema = require('../features/categories/model/category.schema');
const slugify = require('slugify');

// Small public-domain starter collection. Full texts stay with the official Project Gutenberg source.
const books = [
  {
    slug: 'pride-and-prejudice', title: 'Pride and Prejudice', authors: ['Jane Austen'], publicationYear: 1813,
    pageCount: 432, readingLevel: 'Intermediate', categoryPath: ['Literature', 'Classic Literature'],
    description: 'Elizabeth Bennet and Fitzwilliam Darcy challenge each other’s first impressions in Jane Austen’s sharp, much-loved portrait of family, class and love.',
    tags: ['Classic', 'Romance', 'English literature'], gutenbergId: 1342, viewsCount: 126,
  },
  {
    slug: 'frankenstein', title: 'Frankenstein; or, The Modern Prometheus', authors: ['Mary Wollstonecraft Shelley'], publicationYear: 1818,
    pageCount: 280, readingLevel: 'Advanced', categoryPath: ['Literature', 'Fiction', 'Gothic Fiction'],
    description: 'Victor Frankenstein’s experiment gives life to a being who asks what it means to be human. Shelley’s landmark novel blends Gothic fiction with early science fiction.',
    tags: ['Gothic', 'Science fiction', 'Classic'], gutenbergId: 84, viewsCount: 98,
  },
  {
    slug: 'alice-adventures-in-wonderland', title: "Alice's Adventures in Wonderland", authors: ['Lewis Carroll'], publicationYear: 1865,
    pageCount: 192, readingLevel: 'Beginner', categoryPath: ['Literature', "Children's Literature"],
    description: 'Follow Alice down the rabbit hole into a playful world of riddles, curious creatures and wonderfully upside-down logic.',
    tags: ['Fantasy', 'Children’s classic', 'Adventure'], gutenbergId: 11, viewsCount: 115,
  },
  {
    slug: 'adventures-of-sherlock-holmes', title: 'The Adventures of Sherlock Holmes', authors: ['Arthur Conan Doyle'], publicationYear: 1892,
    pageCount: 307, readingLevel: 'Intermediate', categoryPath: ['Literature', 'Fiction', 'Mystery and Detective Fiction'],
    description: 'Twelve classic cases pair Sherlock Holmes’s careful reasoning with Dr. Watson’s vivid account of life in Victorian London.',
    tags: ['Mystery', 'Detective fiction', 'Short stories'], gutenbergId: 1661, viewsCount: 108,
  },
  {
    slug: 'the-time-machine', title: 'The Time Machine', authors: ['H. G. Wells'], publicationYear: 1895,
    pageCount: 84, readingLevel: 'Intermediate', categoryPath: ['Literature', 'Fiction', 'Science Fiction'],
    description: 'A Victorian inventor travels far into the future and finds a divided humanity in this concise, influential science-fiction novel.',
    tags: ['Science fiction', 'Time travel', 'Classic'], gutenbergId: 35, viewsCount: 88,
  },
  {
    slug: 'the-wonderful-wizard-of-oz', title: 'The Wonderful Wizard of Oz', authors: ['L. Frank Baum'], publicationYear: 1900,
    pageCount: 154, readingLevel: 'Beginner', categoryPath: ['Literature', "Children's Literature"],
    description: 'Dorothy, Toto and three unforgettable companions follow the yellow brick road in search of home, courage, a heart and wisdom.',
    tags: ['Fantasy', 'Adventure', 'Children’s classic'], gutenbergId: 55, viewsCount: 93,
  },
];

async function main() {
  await connectCluster();
  const Category = getModel('EnglishDigitalLibrary', 'Category', CategorySchema);
  const Book = getModel('EnglishDigitalLibrary', 'Book', BookSchema);

  for (const item of books) {
    const path = [];
    for (const name of item.categoryPath) {
      const slug = `${path.length ? `${path[path.length - 1].slug}-` : ''}${slugify(name, { lower: true, strict: true, trim: true })}`;
      const category = await Category.findOne({ slug, status: 'active' }).select('_id slug').lean();
      if (!category) throw new Error(`Category "${name}" is missing. Run seed:library-categories first.`);
      path.push(category);
    }
    const externalReadUrl = `https://www.gutenberg.org/ebooks/${item.gutenbergId}`;
    const coverUrl = `https://www.gutenberg.org/cache/epub/${item.gutenbergId}/pg${item.gutenbergId}.cover.medium.jpg`;
    const existingBook = await Book.findOne({ slug: item.slug });
    if (existingBook) {
      // Add an official cover to demo books created before cover images were configured.
      if (!existingBook.coverUrl) {
        existingBook.coverUrl = coverUrl;
        await existingBook.save();
      }
      continue;
    }
    await Book.create({
      title: item.title, slug: item.slug, authors: item.authors, description: item.description, coverUrl,
      language: 'English', categoryId: path[path.length - 1]._id, categoryPath: path.map(node => node._id),
      tags: item.tags, publisher: 'Project Gutenberg', publicationYear: item.publicationYear,
      pageCount: item.pageCount, readingLevel: item.readingLevel, externalReadUrl,
      languageValidationStatus: 'Valid', languageValidationNote: 'English-language edition confirmed at the linked source.',
      visibility: 'public', downloadAllowed: false,
      license: 'Project Gutenberg License; public domain in the United States. Check local copyright rules.',
      rightsStatus: 'approved', source: externalReadUrl, status: 'Published',
      viewsCount: item.viewsCount, publishedAt: new Date(),
    });
  }
  console.log(`Demo collection is ready (${books.length} public-domain titles; existing titles were left unchanged).`);
}

main().then(() => mongoose.disconnect()).catch(async error => {
  console.error('Demo book seed failed:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});

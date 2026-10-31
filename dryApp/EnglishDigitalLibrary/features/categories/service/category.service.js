const mongoose = require('mongoose');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const CategorySchema = require('../model/category.schema');
const BookSchema = require('../../books/model/book.schema');
const { slugFor, publicFilter } = require('../../books/service/book.service');
const imageStorage = require('../../../../../dry/services/storage/r2ObjectStorage.service');
const mediaStorage = require('../../books/service/storage.service');

function categoryModel(req) { return req.getModel('Category', CategorySchema); }

async function categoryWithImage(category) {
  const { imageData = '', imageContentType = '', ...fields } = category;
  let imageUrl = imageData && imageContentType ? `data:${imageContentType};base64,${imageData}` : '';
  if (category.imageStorageProvider === 'r2' && category.imageStorageKey) {
    imageUrl = await imageStorage.signedReadUrl(category.imageStorageKey, { expiresIn: 3600 });
  } else if (category.imageStorageProvider === 'cloudinary') imageUrl = category.imageStorageUrl || '';
  return {
    ...fields,
    imageUrl,
    imageAlt: category.imageAlt || category.name,
    imageAttribution: category.imageAttribution || '',
    imageLicense: category.imageLicense || '',
    imageLicenseUrl: category.imageLicenseUrl || '',
    imageSourceUrl: category.imageSourceUrl || '',
  };
}

async function removeStoredImage(provider, key) {
  if (!key) return;
  try {
    if (provider === 'r2') await imageStorage.remove(key);
    else if (provider === 'cloudinary') await mediaStorage.remove(key, 'image');
  } catch (error) { console.error('Category image cleanup failed:', error.message); }
}

async function setCategoryImage(category, dataUrl) {
  if (typeof dataUrl !== 'string') throw httpError('Category image must be an image data URL.', 400);
  const previous = { provider: category.imageStorageProvider, key: category.imageStorageKey };
  if (!dataUrl) {
    category.imageStorageKey = '';
    category.imageStorageProvider = '';
    category.imageStorageUrl = '';
    category.imageAttribution = '';
    category.imageLicense = '';
    category.imageLicenseUrl = '';
    category.imageSourceUrl = '';
    category.imageData = '';
    category.imageContentType = '';
    category.imageAlt = '';
    return previous;
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw httpError('Use a JPEG, PNG, or WebP category image.', 400);
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 500 * 1024) throw httpError('Category images must be 500 KB or smaller.', 400);
  const isJpeg = match[1] === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = match[1] === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = match[1] === 'image/webp' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!(isJpeg || isPng || isWebp)) throw httpError('The uploaded category image is not a valid image file.', 400);
  if (!mediaStorage.configured) throw httpError('Cloudinary is not configured for category images.', 503);
  const uploaded = await mediaStorage.upload(bytes, {
    folder: 'english_digital_library/categories', resource_type: 'image', format: 'webp',
    public_id: `${category.slug || category._id || Date.now()}-${require('crypto').randomUUID()}`, overwrite: false,
  });
  category.imageStorageKey = uploaded.public_id;
  category.imageStorageProvider = 'cloudinary';
  category.imageStorageUrl = uploaded.secure_url;
  category.imageData = '';
  category.imageContentType = '';
  category.imageAttribution = '';
  category.imageLicense = '';
  category.imageLicenseUrl = '';
  category.imageSourceUrl = '';
  return previous;
}

async function uniqueCategorySlug(req, name, parentId, excludeId) {
  const Category = categoryModel(req);
  const parent = parentId ? await Category.findById(parentId).select('slug').lean() : null;
  const base = [parent?.slug, slugFor(name)].filter(Boolean).join('-');
  let slug = base;
  for (let suffix = 2; await Category.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); suffix += 1) slug = `${base}-${suffix}`;
  return slug;
}

async function refreshBookPaths(req, rootId) {
  const Category = categoryModel(req); const Book = req.getModel('Book', BookSchema);
  const all = await Category.find({}).select('_id parentId').lean(); const children = new Map();
  for (const item of all) if (item.parentId) children.set(String(item.parentId), [...(children.get(String(item.parentId)) || []), String(item._id)]);
  const affected = [String(rootId)]; const stack = [...(children.get(String(rootId)) || [])];
  while (stack.length) { const id = stack.pop(); affected.push(id); stack.push(...(children.get(id) || [])); }
  for (const id of affected) {
    const path = await categoryPath(req, id, false);
    await Book.updateMany({ categoryId: id }, { $set: { categoryPath: path } });
  }
}

/** Retourne les identifiants du parent jusqu'à la catégorie demandée. */
async function categoryPath(req, categoryId, requireActive = true) {
  const Category = categoryModel(req); const path = []; const visited = new Set(); let current = categoryId;
  while (current) {
    const id = String(current);
    if (visited.has(id) || path.length >= 20) throw httpError('Category hierarchy contains a cycle.', 400);
    visited.add(id);
    const node = await Category.findById(current).select('_id parentId status').lean();
    if (!node || (requireActive && node.status !== 'active')) throw httpError('Choose an active category.', 400);
    path.unshift(node._id); current = node.parentId;
  }
  return path;
}

async function list(req) {
  const Category = categoryModel(req); const Book = req.getModel('Book', BookSchema);
  const [categories, counts] = await Promise.all([
    Category.find({ status: 'active' }).sort({ order: 1, name: 1 }).lean(),
    Book.aggregate([{ $match: publicFilter(req) }, { $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map(row => [String(row._id), row.count]));
  const categoryById = new Map(categories.map(category => [String(category._id), category]));
  const nodes = new Map(categories.map(category => [String(category._id), {
    id: String(category._id), name: category.name, slug: category.slug, description: category.description || '',
    imageUrl: '',
    imageAlt: category.imageAlt || category.name,
    imageAttribution: category.imageAttribution || '', imageLicense: category.imageLicense || '', imageLicenseUrl: category.imageLicenseUrl || '', imageSourceUrl: category.imageSourceUrl || '',
    parentId: category.parentId ? String(category.parentId) : null, order: category.order || 0,
    bookCount: countMap.get(String(category._id)) || 0, totalBookCount: 0, children: [],
  }]));
  const roots = [];
  for (const node of nodes.values()) { const parent = node.parentId && nodes.get(node.parentId); if (parent) parent.children.push(node); else roots.push(node); }
  const countDescendants = node => { node.totalBookCount = node.bookCount + node.children.reduce((sum, child) => sum + countDescendants(child), 0); return node.totalBookCount; };
  roots.forEach(countDescendants);
  const attachUrls = async node => {
    const category = categoryById.get(node.id);
    if (category?.imageStorageProvider === 'r2' && category.imageStorageKey) node.imageUrl = await imageStorage.signedReadUrl(category.imageStorageKey, { expiresIn: 3600 });
    else if (category?.imageStorageProvider === 'cloudinary') node.imageUrl = category.imageStorageUrl || '';
    else if (category?.imageData && category.imageContentType) node.imageUrl = `data:${category.imageContentType};base64,${category.imageData}`;
    await Promise.all(node.children.map(attachUrls));
  };
  await Promise.all(roots.map(attachUrls));
  return roots;
}

async function listForManagement(req) {
  const Category = categoryModel(req);
  return Promise.all((await Category.find({}).sort({ order: 1, name: 1 }).lean()).map(categoryWithImage));
}

async function create(req, input) {
  const { name, description = '', parentId = null, order = 0, imageData, imageAlt = '' } = input || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) throw httpError('Category name must be 2–100 characters.', 400);
  if (parentId && !mongoose.Types.ObjectId.isValid(parentId)) throw httpError('Invalid parent category.', 400);
  if (parentId) await categoryPath(req, parentId);
  const slug = await uniqueCategorySlug(req, name, parentId);
  const category = new (categoryModel(req))({ name: name.trim(), slug, description: String(description).slice(0, 3000), parentId, order: Number(order) || 0, createdBy: req.user._id, imageAlt: String(imageAlt).slice(0, 160) });
  const previousImage = imageData !== undefined ? await setCategoryImage(category, imageData) : null;
  await category.save();
  if (previousImage) await removeStoredImage(previousImage.provider, previousImage.key);
  return categoryWithImage(category.toObject());
}

async function update(req, id, input) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw httpError('Invalid category id.', 400);
  const Category = categoryModel(req); const category = await Category.findById(id);
  if (!category) throw httpError('Category not found.', 404);
  const { name, description, parentId, order, status, imageData, imageAlt } = input || {};
  let moved = false;
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) throw httpError('Category name must be 2–100 characters.', 400);
    category.name = name.trim();
  }
  if (description !== undefined) category.description = String(description).slice(0, 3000);
  const previousImage = imageData !== undefined ? await setCategoryImage(category, imageData) : null;
  if (imageAlt !== undefined) category.imageAlt = String(imageAlt).slice(0, 160);
  if (order !== undefined) category.order = Number(order) || 0;
  if (status !== undefined && ['active', 'archived'].includes(status)) category.status = status;
  if (parentId !== undefined) {
    if (parentId && (!mongoose.Types.ObjectId.isValid(parentId) || String(parentId) === String(category._id))) throw httpError('Invalid parent category.', 400);
    if (parentId) {
      // Un parent ne peut pas être un descendant : cela créerait un cycle dans l'arborescence.
      const all = await Category.find({}).select('_id parentId').lean(); const children = new Map();
      for (const item of all) if (item.parentId) children.set(String(item.parentId), [...(children.get(String(item.parentId)) || []), String(item._id)]);
      const seen = new Set(); const stack = [...(children.get(String(category._id)) || [])];
      while (stack.length) { const current = stack.pop(); if (current === String(parentId)) throw httpError('Moving this category would create a cycle.', 400); if (!seen.has(current)) { seen.add(current); stack.push(...(children.get(current) || [])); } }
      await categoryPath(req, parentId);
    }
    category.parentId = parentId || null;
    moved = true;
  }
  if (name !== undefined || moved) category.slug = await uniqueCategorySlug(req, category.name, category.parentId, category._id);
  await category.save();
  if (previousImage) await removeStoredImage(previousImage.provider, previousImage.key);
  if (moved) await refreshBookPaths(req, category._id);
  return categoryWithImage(category.toObject());
}

async function remove(req, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw httpError('Invalid category id.', 400);
  const Category = categoryModel(req); const Book = req.getModel('Book', BookSchema); const objectId = new mongoose.Types.ObjectId(id);
  const [category, children, books] = await Promise.all([Category.findById(objectId).lean(), Category.exists({ parentId: objectId }), Book.exists({ $or: [{ categoryPath: objectId }, { categoryId: objectId }] })]);
  if (children || books) throw httpError('Archive or move dependent books and subcategories before deleting this category.', 409);
  const result = await Category.deleteOne({ _id: objectId });
  if (!result.deletedCount) throw httpError('Category not found.', 404);
  if (category) await removeStoredImage(category.imageStorageProvider, category.imageStorageKey);
}

module.exports = { categoryPath, list, listForManagement, create, update, remove, refreshBookPaths };

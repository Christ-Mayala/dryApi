const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const { connectCluster } = require('../../../dry/config/connection/dbConnection');
const getModel = require('../../../dry/core/factories/modelFactory');
const CategorySchema = require('../features/categories/model/category.schema');
const mediaStorage = require('../features/books/service/storage.service');

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'EnglishDigitalLibrary/1.0 (category image import; contact: library-admin@edl.local)';
const MAX_IMAGE_BYTES = 500 * 1024;
const ROOT_ASSETS = {
  'english-language-learning': 'category-english.jpg',
  literature: 'category-literature.jpg',
  'science-and-technology': 'category-science.jpg',
  'business-and-economics': 'category-business.jpg',
  'personal-development': 'category-development.jpg',
  'history-and-geography': 'category-history.jpg',
  'law-and-philosophy': 'category-law.jpg',
  'health-and-life-sciences': 'category-health.jpg',
  'education-and-research': 'category-education.jpg',
};

function plainText(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&#039;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function validImage(bytes, mime) {
  if (!bytes?.length || bytes.length > MAX_IMAGE_BYTES) return false;
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return false;
}

function localRootImage(slug) {
  const file = ROOT_ASSETS[slug];
  if (!file) return null;
  const fullPath = path.join(__dirname, 'assets', 'category-images', file);
  if (!fs.existsSync(fullPath)) return null;
  const bytes = fs.readFileSync(fullPath);
  const mime = file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return validImage(bytes, mime) ? { bytes, mime, attribution: '', license: '', licenseUrl: '', sourceUrl: '' } : null;
}

async function commonsImage(searchTerm) {
  const url = new URL(COMMONS_API);
  for (const [key, value] of Object.entries({
    action: 'query', generator: 'search', gsrsearch: searchTerm, gsrnamespace: '6', gsrlimit: '8',
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '640', format: 'json',
  })) url.searchParams.set(key, value);

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Wikimedia Commons returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.error) throw new Error(`Wikimedia Commons: ${payload.error.code || payload.error.info || 'search failed'}.`);
  const candidates = Object.values(payload.query?.pages || {});

  for (const page of candidates) {
    const info = page.imageinfo?.[0];
    const imageUrl = info?.thumburl || info?.url;
    if (!imageUrl) continue;
    const imageResponse = await fetch(imageUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!imageResponse.ok) continue;
    const mime = (imageResponse.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) continue;
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (!validImage(bytes, mime)) continue;
    const metadata = info.extmetadata || {};
    return {
      bytes, mime,
      attribution: plainText(metadata.Attribution?.value || metadata.Artist?.value || page.title),
      license: plainText(metadata.LicenseShortName?.value || 'Wikimedia Commons'),
      licenseUrl: metadata.LicenseUrl?.value || 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia',
      sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    };
  }
  return null;
}

async function commonsImageWithRetry(searchTerm, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const image = await commonsImage(searchTerm);
      if (image) return image;
      lastError = new Error('No valid image was returned.');
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 750));
  }
  throw lastError || new Error('Wikimedia Commons search failed.');
}

async function main() {
  if (!mediaStorage.configured) throw new Error('Configure Cloudinary before importing category images.');
  await connectCluster();
  const Category = getModel('EnglishDigitalLibrary', 'Category', CategorySchema);
  const rows = await Category.find({}).sort({ order: 1, name: 1 }).lean();
  const byId = new Map(rows.map(row => [String(row._id), row]));
  const rootById = new Map();
  for (const row of rows) {
    let current = row;
    while (current.parentId && byId.has(String(current.parentId))) current = byId.get(String(current.parentId));
    rootById.set(String(row._id), current);
  }

  const rootImages = new Map();
  for (const row of rows.filter(item => !item.parentId)) {
    const image = localRootImage(row.slug);
    if (image) rootImages.set(String(row._id), image);
  }

  let uploaded = 0;
  let commonsImages = 0;
  let fallbackImages = 0;
  const failures = [];
  const pending = rows.filter(category => !(category.imageStorageProvider === 'cloudinary' && category.imageStorageUrl));
  const skipped = rows.length - pending.length;

  async function uploadCategoryImage(category, image) {
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[image.mime] || 'jpg';
    const publicId = `${category.slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await mediaStorage.upload(image.bytes, {
      folder: 'english_digital_library/categories',
      resource_type: 'image',
      public_id: publicId,
      format: extension === 'jpg' ? undefined : extension,
      overwrite: false,
    });
    const update = {
      imageStorageKey: result.public_id,
      imageStorageProvider: 'cloudinary',
      imageStorageUrl: result.secure_url,
      imageData: '',
      imageContentType: '',
      imageAlt: `${category.name} books and learning`,
    };
    if (image.attribution) update.imageAttribution = image.attribution;
    if (image.license) update.imageLicense = image.license;
    if (image.licenseUrl) update.imageLicenseUrl = image.licenseUrl;
    if (image.sourceUrl) update.imageSourceUrl = image.sourceUrl;
    await Category.updateOne({ _id: category._id }, { $set: update });
    return result;
  }

  async function processCategory(category) {
    try {
      let image = null;
      if (category.imageData && category.imageContentType) {
        image = {
          bytes: Buffer.from(category.imageData, 'base64'),
          mime: category.imageContentType,
          attribution: category.imageAttribution || '',
          license: category.imageLicense || '',
          licenseUrl: category.imageLicenseUrl || '',
          sourceUrl: category.imageSourceUrl || '',
        };
      }
      if (!image) {
        try {
          image = await commonsImageWithRetry(category.name);
          if (image) commonsImages += 1;
        } catch {
          image = null;
        }
      }
      if (!image) {
        const rootId = String(rootById.get(String(category._id))?._id || category._id);
        image = rootImages.get(rootId) || null;
        if (image) fallbackImages += 1;
      }
      if (!validImage(image?.bytes, image?.mime)) throw new Error('No valid category image was found.');
      await uploadCategoryImage(category, image);
      uploaded += 1;
      if (uploaded % 10 === 0) console.log(`Attached ${uploaded + skipped}/${rows.length} category images to Cloudinary...`);
    } catch (error) {
      failures.push({ slug: category.slug, message: error.message });
    }
  }

  // Upload top-level categories first so their local files are available as fallbacks.
  const ordered = [...pending].sort((left, right) => Number(Boolean(left.parentId)) - Number(Boolean(right.parentId)));
  let nextIndex = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (nextIndex < ordered.length) {
      const category = ordered[nextIndex++];
      await processCategory(category);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  });
  await Promise.all(workers);

  console.log(JSON.stringify({
    total: rows.length, uploaded, commonsImages, fallbackImages, skipped,
    failed: failures.length, failures,
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch(error => { console.error(`Category image import failed: ${error.message}`); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });

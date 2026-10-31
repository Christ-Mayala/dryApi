const express = require('express');
const multer = require('multer');
const asyncHandler = require('express-async-handler');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const optionalAuth = require('../../../middlewares/optional-auth.middleware');
const controller = require('../controller/books.controller');

const router = express.Router();
const staff = [protect, authorize('admin', 'librarian')];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 80 * 1024 * 1024 } });

router.get('/', optionalAuth, asyncHandler(controller.list));
router.get('/admin', ...staff, asyncHandler(controller.adminList));
router.post('/', ...staff, withAudit('LIBRARY_BOOK_CREATE'), asyncHandler(controller.create));
router.patch('/:id', ...staff, withAudit('LIBRARY_BOOK_UPDATE'), asyncHandler(controller.update));
router.post('/:id/review', ...staff, withAudit('LIBRARY_BOOK_REVIEW'), asyncHandler(controller.review));
router.post('/:id/document', ...staff, withAudit('LIBRARY_BOOK_PDF_UPLOAD'), upload.single('file'), asyncHandler(controller.uploadDocument));
router.post('/:id/cover', ...staff, withAudit('LIBRARY_BOOK_COVER_UPLOAD'), upload.single('file'), asyncHandler(controller.uploadCover));
router.delete('/:id', ...staff, withAudit('LIBRARY_BOOK_DELETE'), asyncHandler(controller.remove));
router.get('/:slug/document', optionalAuth, asyncHandler(controller.readDocument));
router.get('/:slug/download', optionalAuth, asyncHandler(controller.downloadDocument));
router.get('/:slug', optionalAuth, asyncHandler(controller.getBySlug));

module.exports = router;

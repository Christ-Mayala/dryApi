const sendResponse = require('../../../../../dry/utils/http/response');
const service = require('../service/category.service');

// Le contrôleur ne fait que traduire les requêtes HTTP en appels métier.
exports.list = async (req, res) => sendResponse(res, await service.list(req), 'Library categories');
exports.listForManagement = async (req, res) => sendResponse(res, await service.listForManagement(req), 'Managed categories');
exports.create = async (req, res) => sendResponse(res, await service.create(req, req.body), 'Category created', true, undefined, 201);
exports.update = async (req, res) => sendResponse(res, await service.update(req, req.params.id, req.body), 'Category updated');
exports.remove = async (req, res) => { await service.remove(req, req.params.id); sendResponse(res, { id: req.params.id }, 'Category deleted'); };

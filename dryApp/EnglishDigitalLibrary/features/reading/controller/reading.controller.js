const sendResponse = require('../../../../../dry/utils/http/response');
const service = require('../service/reading.service');

// Le contrôleur expose seulement les réponses HTTP; les règles et écritures restent dans le service.
exports.list = async (req, res) => sendResponse(res, await service.list(req), 'Reading history');
exports.save = async (req, res) => sendResponse(res, await service.save(req, req.params.bookId, req.body), 'Reading progress saved');

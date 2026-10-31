const sendResponse = require('../../../../../dry/utils/http/response');
const service = require('../service/statistics.service');

exports.home = async (req, res) => sendResponse(res, await service.home(req), 'Library home');
exports.admin = async (req, res) => sendResponse(res, await service.admin(req), 'Library statistics');

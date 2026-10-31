const sendResponse = require('../../../../../dry/utils/http/response');
const service = require('../service/users.service');

exports.list = async (req, res) => {
  const result = await service.list(req);
  sendResponse(res, result.users, 'Library users', true, result.pagination);
};
exports.updateRole = async (req, res) => sendResponse(res, await service.updateRole(req, req.params.id, req.body?.role), 'User role updated');

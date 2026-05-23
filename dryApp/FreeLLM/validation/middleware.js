const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../dry/utils/http/response');

const validateFreeLLM = {
  // Add validation schemas here
};

const ensureLabel = (resourceName) => asyncHandler(async (req, res, next) => {
  if (!req.body.label && req.body.name) {
    req.body.label = req.body.name;
  }
  next();
});

module.exports = {
  validateFreeLLM,
  ensureLabel
};

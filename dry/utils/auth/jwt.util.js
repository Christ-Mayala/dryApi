const jwt = require('jsonwebtoken');
const config = require('../../../config/database');

const signToken = (id) => {
  return jwt.sign({ id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRE });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    const previous = config.JWT_SECRET_PREVIOUS || '';
    if (!previous) throw error;
    return jwt.verify(token, previous);
  }
};

module.exports = { signToken, verifyToken };

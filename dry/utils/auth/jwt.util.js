const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../../config/database');

const signAccessToken = (id) => {
  return jwt.sign({ id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRE || '1h' });
};

const signRefreshToken = (id) => {
  const secret = config.JWT_REFRESH_SECRET || config.JWT_SECRET;
  return jwt.sign({ id, type: 'refresh' }, secret, { expiresIn: '30d' });
};

const hashToken = (token) => {
  if (!token) return null;
  return crypto.createHash('sha256').update(String(token)).digest('hex');
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

const verifyRefreshToken = (token) => {
  const secret = config.JWT_REFRESH_SECRET || config.JWT_SECRET;
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    // Fallback : anciens tokens signés avec JWT_SECRET (avant migration)
    if (secret !== config.JWT_SECRET) {
      return jwt.verify(token, config.JWT_SECRET);
    }
    throw err;
  }
};

module.exports = { signAccessToken, signRefreshToken, verifyToken, verifyRefreshToken, hashToken };

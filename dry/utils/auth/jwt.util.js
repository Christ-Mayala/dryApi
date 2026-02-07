const jwt = require('jsonwebtoken');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    const previous = process.env.JWT_SECRET_PREVIOUS || '';
    if (!previous) throw error;
    return jwt.verify(token, previous);
  }
};

module.exports = { signToken, verifyToken };

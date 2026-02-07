const jwt = require('jsonwebtoken');

const signAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

const signRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
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

module.exports = { signAccessToken, signRefreshToken, verifyToken };

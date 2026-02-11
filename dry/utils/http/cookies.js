const config = require('../../../config/database');

const refreshCookieOptions = () => ({
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
});

module.exports = { refreshCookieOptions };

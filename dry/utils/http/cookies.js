const config = require('../../../config/database');

const refreshCookieOptions = () => ({
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
});

const accessTokenCookieOptions = () => ({
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (or match your JWT expiry)
});

module.exports = { refreshCookieOptions, accessTokenCookieOptions };

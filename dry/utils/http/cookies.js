const config = require('../../../config/database');

const refreshCookieOptions = () => ({
    httpOnly: true,
    // Toujours secure en prod, recommandé par le user
    secure: config.NODE_ENV === 'production',
    // 'lax' est un bon compromis sécurité/UX. 
    // Si le front et l'api sont sur des domaines totalement différents, 
    // 'none' serait requis (avec secure: true).
    sameSite: config.NODE_ENV === 'production' ? 'lax' : 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
});

const accessTokenCookieOptions = () => ({
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: config.NODE_ENV === 'production' ? 'lax' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
});

module.exports = { refreshCookieOptions, accessTokenCookieOptions };

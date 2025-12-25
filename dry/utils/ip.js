const crypto = require('crypto');

const getClientIp = (req) => {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        const ip = String(xff).split(',')[0].trim();
        if (ip) return ip;
    }
    return req.ip;
};

const hashIp = (ip) => {
    const salt = process.env.VIEW_IP_SALT || 'dry';
    return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
};

module.exports = { getClientIp, hashIp };

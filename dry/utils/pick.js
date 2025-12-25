const pickDefined = (obj, keys) => {
    const out = {};
    if (!obj) return out;
    keys.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
            out[k] = obj[k];
        }
    });
    return out;
};

module.exports = { pickDefined };

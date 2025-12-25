const getPagination = (query, { defaultLimit = 10, maxLimit = 100 } = {}) => {
    const page = Math.max(parseInt(query?.page || '1', 10), 1);
    const rawLimit = parseInt(query?.limit || String(defaultLimit), 10);
    const limit = Math.min(Math.max(rawLimit || defaultLimit, 1), maxLimit);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

module.exports = { getPagination };

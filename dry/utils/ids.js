const mongoose = require('mongoose');

const isObjectId = (value) => {
    if (!value) return false;
    return mongoose.Types.ObjectId.isValid(String(value));
};

const isValidObjectId = isObjectId;

module.exports = { isObjectId, isValidObjectId };

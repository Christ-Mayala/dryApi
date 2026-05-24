const mongoose = require('mongoose');

const SystemSettingsSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, index: true },
        value: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true, versionKey: false },
);

module.exports = SystemSettingsSchema;

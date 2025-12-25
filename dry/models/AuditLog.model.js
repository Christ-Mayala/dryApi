const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        default: null 
    },
    action: { type: String, required: true },
    method: { type: String },
    route: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    origin: { type: String },
    details: { type: Object },
    status: { type: String, enum: ['success', 'failed'], default: 'success' }
}, { timestamps: true, versionKey: false });

// On force le nom de collection pour ne pas polluer les autres
module.exports = mongoose.model('AuditLog', AuditLogSchema);
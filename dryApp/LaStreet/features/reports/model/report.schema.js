const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetProfessional: { type: mongoose.Schema.Types.ObjectId, ref: 'Professional', default: null, index: true },

    reason: {
      type: String,
      enum: ['FAUX_PROFIL', 'ARNAQUE', 'COMPORTEMENT_DEPLACE', 'INFORMATION_INCORRECTE', 'AUTRE'],
      required: true,
      index: true,
    },
    message: { type: String, trim: true, maxlength: 500, default: '' },

    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    decision: { type: String, enum: ['keep', 'delete'], default: null },
    decisionNote: { type: String, trim: true, maxlength: 500, default: '' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

module.exports = ReportSchema;

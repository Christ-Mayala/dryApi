const mongoose = require('mongoose');

const ProfessionalSchema = new mongoose.Schema(
  {
    nom: { type: String, trim: true },
    prenom: { type: String, trim: true },
    name: { type: String, required: true, trim: true },

    telephone: { type: String, required: true, trim: true, index: true },
    whatsapp: { type: Boolean, default: false },

    pays: { type: String, default: 'République du Congo', trim: true },
    ville: { type: String, required: true, trim: true, index: true },
    quartier: { type: String, trim: true, index: true },

    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeCategory', required: true, index: true },
    tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', required: true, index: true },

    experienceRange: { type: String, enum: ['0-1', '2-5', '5+'], default: '0-1' },
    description: { type: String, trim: true, maxlength: 300 },

    daysAvailable: { type: [String], default: [] },
    hoursAvailable: { type: String, trim: true },
    preferredContact: { type: String, enum: ['call', 'whatsapp', 'both'], default: 'both' },

    profileImage: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    images: [
      {
        url: String,
        public_id: String,
      },
    ],

    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },

    availabilityStatus: {
      type: String,
      enum: ['available', 'busy', 'temporarily_unavailable'],
      default: 'available',
      index: true,
    },

    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

module.exports = ProfessionalSchema;

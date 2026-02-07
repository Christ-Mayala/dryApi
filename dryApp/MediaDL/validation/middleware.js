const { validate } = require('../../../dry/utils/validation/validation.util');
const { mediaDLSchemas } = require('./schemas');

const labelCandidates = {
  downloads: ["label", "name", "nom", "title", "titre", "subject", "email", "url", "platform", "mediaType", "filename", "jobStatus", "sizeBytes", "error", "requestedBy", "startedAt", "finishedAt", "path", "presetId", "batchId"],
  batches: ["label", "name", "nom", "title", "titre", "subject", "email", "sourceType", "total", "completed", "failed", "status", "createdBy", "startedAt", "finishedAt"],
  presets: ["label", "name", "nom", "title", "titre", "subject", "email", "qualityMode", "preferAudioOnly", "maxHeight", "downloadDir", "concurrent"]
};

const ensureLabel = (featureKey) => (req, res, next) => {
  try {
    if (req.body && !req.body.label) {
      const keys = labelCandidates[featureKey] || [];
      for (const key of keys) {
        const val = req.body[key];
        if (typeof val === 'string' && val.trim()) {
          req.body.label = val.trim();
          break;
        }
      }
    }
    next();
  } catch (e) {
    next();
  }
};

const validateMediaDL = {
  downloads: {
    create: validate(mediaDLSchemas.Downloads.create),
    update: validate(mediaDLSchemas.Downloads.update)
  },
  batches: {
    create: validate(mediaDLSchemas.Batches.create),
    update: validate(mediaDLSchemas.Batches.update)
  },
  presets: {
    create: validate(mediaDLSchemas.Presets.create),
    update: validate(mediaDLSchemas.Presets.update)
  }
};

module.exports = { validateMediaDL, ensureLabel };

const mongoose = require('mongoose');

/**
 * Cle d'idempotence — permet de rejouer une requete critique (reception,
 * sortie, inventaire) sans dupliquer les mouvements de stock en cas de
 * coupure reseau ou de retry client.
 *
 * Unicite garantie par l'index compose (pharmacyId, key) : une meme cle reste
 * valable pour deux etablissements distincts d'une meme organisation.
 */
const IdempotencyKeySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true },
    key: { type: String, required: true },
    endpoint: { type: String },
    responseRef: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
  },
  { timestamps: false, versionKey: false, collection: 'idempotencyKeys' }
);

IdempotencyKeySchema.index({ pharmacyId: 1, key: 1 }, { unique: true });

/**
 * Recupere l'enregistrement d'idempotence pour (pharmacie, cle).
 * @returns {Promise<object|null>}
 */
const findExisting = async (req) => {
  const key = req.headers['idempotency-key'];
  if (!key) return null;
  const Model = req.getModel('IdempotencyKey', IdempotencyKeySchema);
  return Model.findOne({ pharmacyId: req.pharmacyId || null, key: String(key) });
};

/**
 * Enregistre la reponse associee a une cle d'idempotence.
 * En cas de collision (retry concurrent), on ignore : la reponse deja
 * enregistree fait foi.
 */
const remember = async (req, responseRef) => {
  const key = req.headers['idempotency-key'];
  if (!key) return;
  const Model = req.getModel('IdempotencyKey', IdempotencyKeySchema);
  try {
    await Model.create({
      tenantId: req.tenantId || null,
      pharmacyId: req.pharmacyId || null,
      key: String(key),
      endpoint: req.originalUrl,
      responseRef,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
};

module.exports = { IdempotencyKeySchema, findExisting, remember };

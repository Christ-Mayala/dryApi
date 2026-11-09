const StockMovementsSchema = require('../../movements/model/stockMovements.schema');
const StockBalancesSchema = require('../../movements/model/stockBalances.schema');
const InventoriesSchema = require('../model/inventories.schema');
const { postMovement, toObjectId } = require('../../../lib/stock.service');
const { runAtomic } = require('../../../lib/atomic');
const { badRequest, notFound } = require('../../../lib/errors');
const { tenantFilter } = require('../../../lib/tenant');

/**
 * Validation d'un inventaire.
 *
 * Strategie face aux mouvements concurrents (« approche 2 ») : les mouvements
 * ne sont PAS bloques pendant l'inventaire. A la validation, l'ecart reel est
 * recalcule en integrant les mouvements intervenus APRES le snapshot :
 *
 *   theorique a la validation = theorique fige + Σ mouvements posterieurs
 *   ecart reel                = quantite comptee - theorique a la validation
 *
 * L'ajustement applique au solde aligne celui-ci sur la quantite comptee
 * (`compte - solde courant`), ce qui equivaut a l'ecart reel des lors que le
 * solde reste rapproche du journal (`Stock = Σ mouvements`).
 *
 * Les ecarts non justifies sont refuses. L'operation est atomique : soit tous
 * les ajustements passent, soit aucun.
 *
 * @param {import('express').Request} req
 * @returns {Promise<object>} l'inventaire valide
 */
const validateInventory = async (req) => {
  const Inventory = req.getModel('Inventory', InventoriesSchema);
  const Movement = req.getModel('StockMovement', StockMovementsSchema);
  const Balance = req.getModel('StockBalance', StockBalancesSchema);

  const inventory = await Inventory.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!inventory) throw notFound('Inventaire introuvable');
  if (inventory.status === 'validated') return inventory;
  if (inventory.status === 'cancelled') throw badRequest('Un inventaire annule ne peut pas etre valide');
  if (!inventory.lines.length) throw badRequest('Aucune ligne dans cet inventaire');

  const counted = inventory.lines.filter((l) => l.countedQuantity !== null && l.countedQuantity !== undefined);
  if (!counted.length) throw badRequest('Aucun comptage saisi pour cet inventaire');

  const snapshotAt = inventory.snapshotAt || inventory.createdAt || new Date(0);

  return runAtomic(Inventory.db, async (session) => {
    for (const line of inventory.lines) {
      if (line.countedQuantity === null || line.countedQuantity === undefined) continue;

      const balanceQuery = {
        pharmacyId: inventory.pharmacyId,
        productId: line.productId,
        lotId: toObjectId(line.lotId),
      };
      const current = await Balance.findOne(balanceQuery).session(session);
      const currentQty = current ? current.quantityOnHand : 0;

      // Mouvements enregistres APRES le snapshot (cle sur createdAt : insensible
      // a une date d'operation antidatee saisie par l'utilisateur).
      const movementsSince = await Movement.find({
        pharmacyId: inventory.pharmacyId,
        productId: line.productId,
        lotId: toObjectId(line.lotId),
        status: { $ne: 'deleted' },
        createdAt: { $gt: snapshotAt },
      }).select('signedQuantity').session(session);
      const delta = movementsSince.reduce((sum, m) => sum + (m.signedQuantity || 0), 0);

      const theoreticalAtValidation = (line.theoreticalQuantity || 0) + delta;
      line.movementsSinceSnapshot = delta;
      line.theoreticalAtValidation = theoreticalAtValidation;
      line.difference = line.countedQuantity - theoreticalAtValidation;

      const adjustment = line.countedQuantity - currentQty;

      if (adjustment === 0) continue;
      if (!line.justification) {
        throw badRequest('Tout ecart d\'inventaire doit etre justifie avant validation');
      }

      await postMovement({
        Movement,
        Balance,
        pharmacyId: inventory.pharmacyId,
        tenantId: inventory.tenantId,
        productId: line.productId,
        lotId: line.lotId,
        type: 'adjustment',
        quantity: Math.abs(adjustment),
        sign: adjustment > 0 ? 1 : -1,
        reasonCode: 'inventory',
        reason: line.justification,
        sourceType: 'inventory',
        sourceId: inventory._id,
        actorId: req.user._id,
        occurredAt: new Date(),
        allowNegative: false,
        session,
      });
    }

    inventory.status = 'validated';
    inventory.validatedAt = new Date();
    inventory.validatedBy = req.user._id;
    inventory.updatedBy = req.user._id;
    inventory.markModified('lines');
    await inventory.save({ session });
    return inventory;
  });
};

module.exports = { validateInventory };

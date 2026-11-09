const StockMovementsSchema = require('../../movements/model/stockMovements.schema');
const StockBalancesSchema = require('../../movements/model/stockBalances.schema');
const LotsSchema = require('../../lots/model/lots.schema');
const ReceiptsSchema = require('../model/receipts.schema');
const { postMovement } = require('../../../lib/stock.service');
const { runAtomic } = require('../../../lib/atomic');
const { badRequest, notFound } = require('../../../lib/errors');
const { tenantFilter } = require('../../../lib/tenant');

/**
 * Validation d'une reception (coeur metier du Lot 4).
 *
 * Pour chaque ligne :
 *  1. le lot est retrouve (tenantId + produit + numero de lot) ou cree ;
 *  2. un mouvement d'entree est ecrit dans le journal ;
 *  3. le solde (produit, lot) est mis a jour.
 *
 * L'ensemble s'execute dans une transaction MongoDB : aucune ecriture
 * partielle n'est possible si une ligne echoue. Une reception deja validee
 * est renvoyee telle quelle (idempotence metier).
 *
 * @param {import('express').Request} req
 * @returns {Promise<object>} la reception validee
 */
const validateReceipt = async (req) => {
  const Receipt = req.getModel('Receipt', ReceiptsSchema);
  const Lot = req.getModel('Lot', LotsSchema);
  const Movement = req.getModel('StockMovement', StockMovementsSchema);
  const Balance = req.getModel('StockBalance', StockBalancesSchema);

  const receipt = await Receipt.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!receipt) throw notFound('Reception introuvable');
  if (receipt.status === 'validated') return receipt;
  if (receipt.status !== 'draft') throw badRequest('Seule une reception en brouillon peut etre validee');
  if (!receipt.lines.length) throw badRequest('Aucune ligne a receptionner');

  return runAtomic(Receipt.db, async (session) => {
    for (const line of receipt.lines) {
      let lot = await Lot.findOne({
        pharmacyId: receipt.pharmacyId,
        productId: line.productId,
        lotNumber: line.lotNumber,
      }).session(session);

      if (!lot) {
        lot = new Lot({
          tenantId: receipt.tenantId,
          pharmacyId: receipt.pharmacyId,
          productId: line.productId,
          supplierId: receipt.supplierId,
          lotNumber: line.lotNumber,
          expiryDate: line.expiryDate,
          receivedAt: receipt.receivedAt,
          quantityReceived: 0,
          createdBy: req.user._id,
          updatedBy: req.user._id,
        });
      } else {
        // Le lot existe deja : on aligne la peremption sur celle du bon de livraison.
        lot.expiryDate = line.expiryDate;
        lot.supplierId = receipt.supplierId;
        lot.updatedBy = req.user._id;
      }
      lot.quantityReceived = (lot.quantityReceived || 0) + line.quantityReceived;
      await lot.save({ session });

      line.lotId = lot._id;

      await postMovement({
        Movement,
        Balance,
        pharmacyId: receipt.pharmacyId,
        tenantId: receipt.tenantId,
        productId: line.productId,
        lotId: lot._id,
        type: 'in',
        quantity: line.quantityReceived,
        reasonCode: 'receipt',
        reason: `Reception ${receipt.reference || receipt._id}`,
        sourceType: 'receipt',
        sourceId: receipt._id,
        actorId: req.user._id,
        occurredAt: receipt.receivedAt,
        session,
      });
    }

    receipt.status = 'validated';
    receipt.validatedAt = new Date();
    receipt.validatedBy = req.user._id;
    receipt.updatedBy = req.user._id;
    receipt.markModified('lines');
    await receipt.save({ session });
    return receipt;
  });
};

module.exports = { validateReceipt };

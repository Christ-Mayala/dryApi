/**
 * Les champs que la SYNC doit conserver.
 *
 * Le handler de push n'applique aucun filtre de champs : il étale le payload
 * client dans un `$set` et laisse Mongoose décider ce qui est écrit
 * (`sync.controller.js`, `{ $set: dataWithUser }`). Or les deux schémas sont
 * en `strict: true` (défaut Mongoose) : un champ absent du schéma est
 * SUPPRIMÉ en silence, et le client reçoit quand même `status: 'created'`.
 *
 * Concrètement, sans les champs déclarés ici, une facture créée sur un
 * téléphone perdait silencieusement son activité et sa TVA sur tous les
 * autres appareils — et sur un reinstall, définitivement.
 */

const mongoose = require('mongoose');
const InvoiceSchema = require('../../../dryApp/Trivida/features/invoice/model/invoice.schema');
const ActivityRecetteSchema = require('../../../dryApp/Trivida/features/activityRecette/model/activityRecette.schema');

const Invoice = mongoose.model('TestInvoice', InvoiceSchema);
const ActivityRecette = mongoose.model('TestActivityRecette', ActivityRecetteSchema);

const baseInvoice = {
  invoiceNumber: 'FAC-2026-0001',
  customerId: 7,
  amount: 11890,
  status: 'payé',
  date: new Date('2026-01-10'),
};

describe('Schéma invoice — conservation des champs de la migration 17', () => {
  it('conserve activityId, amountHt, taxRate et taxAmount', () => {
    const doc = new Invoice({
      ...baseInvoice,
      activityId: 2,
      amountHt: 10000,
      taxRate: 18.9,
      taxAmount: 1890,
    }).toObject();

    expect(doc.activityId).toBe(2);
    expect(doc.amountHt).toBe(10000);
    expect(doc.taxRate).toBe(18.9);
    expect(doc.taxAmount).toBe(1890);
  });

  it('accepte une facture SANS TVA (champs absents, pas à zéro)', () => {
    // Une facture antérieure à la TVA ne doit pas se retrouver avec un taux de
    // 0 % : « pas de TVA saisie » et « TVA de 0 % » ne sont pas la même chose.
    const doc = new Invoice({ ...baseInvoice }).toObject();
    expect(doc.amountHt).toBeUndefined();
    expect(doc.taxRate).toBeUndefined();
    expect(doc.taxAmount).toBeUndefined();
  });

  it('garde amount comme TTC et ne le déduit pas du HT', () => {
    const doc = new Invoice({ ...baseInvoice, amount: 11890, amountHt: 10000, taxRate: 18.9 }).toObject();
    expect(doc.amount).toBe(11890);
  });

  it('accepte une facture sans activité (client non rattaché)', () => {
    const doc = new Invoice({ ...baseInvoice }).toObject();
    expect(doc.activityId).toBeUndefined();
  });

  it('continue de rejeter les champs truly inconnus (strict)', () => {
    // Garde-fou : si quelqu'un passe le schéma en strict:false pour « simplifier »,
    // ce test doit le signaler.
    const doc = new Invoice({ ...baseInvoice, champInconnu: 42 }).toObject();
    expect('champInconnu' in doc).toBe(false);
  });
});

describe('Schéma activity_recette — conservation du lien facture', () => {
  it('conserve invoiceId', () => {
    const doc = new ActivityRecette({
      activityId: 2,
      customerId: 7,
      amount: 11890,
      date: new Date('2026-01-10'),
      invoiceId: 42,
      notes: 'Paiement Facture FAC-2026-0001',
    }).toObject();

    expect(doc.invoiceId).toBe(42);
  });

  it('accepte une recette saisie à la main (sans facture)', () => {
    const doc = new ActivityRecette({
      activityId: 1,
      amount: 3000,
      date: new Date('2026-01-10'),
      notes: 'Vente comptoir mardi',
    }).toObject();

    expect(doc.invoiceId).toBeUndefined();
  });
});
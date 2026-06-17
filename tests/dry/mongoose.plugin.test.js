/**
 * Tests unitaires — Plugin DRY Mongoose (mongoose.plugin)
 *
 * Verifie que le hook pre('find') n'ecrase PAS les filtres status existants
 * (regression corrigee : this.where() → this.and())
 *
 * @module tests/dry/mongoose.plugin.test
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Plugin DRY a tester
const dryPlugin = require('../../dry/core/plugins/mongoose.plugin');

let mongoServer;

// Schema de test simple (simule un modele avec son propre champ status)
const testSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deleted', 'banned', 'en_attente', 'confirmee', 'annulee'],
    default: 'active',
  },
  isDeleted: { type: Boolean, default: false },
});

// Appliquer le plugin DRY (comme dans l'application reelle)
testSchema.plugin(dryPlugin);

const TestModel = mongoose.model('DryPluginTest', testSchema);

describe('Plugin DRY — pre("find") hook', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Inserer des documents de test
    await TestModel.create([
      { name: 'Alpha', email: 'alpha@test.com', status: 'active' },
      { name: 'Beta', email: 'beta@test.com', status: 'inactive' },
      { name: 'Gamma', email: 'gamma@test.com', status: 'deleted' },
      { name: 'Delta', email: 'delta@test.com', status: 'banned' },
      { name: 'Epsilon', email: 'epsilon@test.com', status: 'active' },
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('ne doit PAS ecraser le filtre status=inactive avec le soft-delete', async () => {
    const results = await TestModel.find({ status: 'inactive' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Beta');
    expect(results[0].status).toBe('inactive');
  });

  it('doit toujours exclure les documents avec status="deleted" (soft-delete)', async () => {
    const results = await TestModel.find({});
    expect(results).toHaveLength(4);
    const deletedDoc = results.find((r) => r.status === 'deleted');
    expect(deletedDoc).toBeUndefined();
  });

  it('doit retourner les supprimes quand includeDeleted=true', async () => {
    const results = await TestModel.find({ includeDeleted: true });
    expect(results).toHaveLength(5);
    const deletedDoc = results.find((r) => r.status === 'deleted');
    expect(deletedDoc).toBeDefined();
    expect(deletedDoc.name).toBe('Gamma');
  });

  it('doit retourner les supprimes quand on cherche status=deleted', async () => {
    const results = await TestModel.find({ status: 'deleted' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Gamma');
  });

  it('doit combiner status=active avec le soft-delete', async () => {
    const results = await TestModel.find({ status: 'active' });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.name).sort()).toEqual(['Alpha', 'Epsilon']);
  });

  it('doit avoir $and dans les conditions de la requete (this.and vs this.where)', async () => {
    const query = TestModel.find({ status: 'active' });
    const conditionsBefore = query.getQuery();
    expect(conditionsBefore.status).toBe('active');

    await query;

    const conditionsAfter = query.getQuery();
    expect(conditionsAfter.status).toBe('active');
    expect(conditionsAfter.$and).toBeDefined();
    expect(conditionsAfter.$and).toEqual(
      expect.arrayContaining([{ status: { $ne: 'deleted' } }])
    );
  });

  it('ne doit pas ecraser status=annulee ou status=en_attente', async () => {
    await TestModel.create([
      { name: 'Reserv1', email: 'res1@test.com', status: 'en_attente' },
      { name: 'Reserv2', email: 'res2@test.com', status: 'confirmee' },
    ]);

    const enAttente = await TestModel.find({ status: 'en_attente' });
    expect(enAttente).toHaveLength(1);
    expect(enAttente[0].name).toBe('Reserv1');

    const confirmee = await TestModel.find({ status: 'confirmee' });
    expect(confirmee).toHaveLength(1);
    expect(confirmee[0].name).toBe('Reserv2');
  });

  it('doit appliquer uniquement le soft-delete quand aucun filtre status', async () => {
    const results = await TestModel.find({});
    expect(results).toHaveLength(6);
    results.forEach((r) => {
      expect(r.status).not.toBe('deleted');
    });
  });
});

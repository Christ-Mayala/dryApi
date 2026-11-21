const crypto = require('crypto');

describe('migration 004 — chiffrement des connexions historiques', () => {
  let migration;
  let service;

  beforeEach(() => {
    jest.resetModules();
    process.env.NOVA_CONNECTION_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    service = require('../../../dryApp/Nova/services/crypto.service');
    migration = require('../../../migrations/004-nova-encrypt-connection-secrets');
  });

  afterEach(() => console.log.mockRestore());

  it('chiffre les secrets en clair sans toucher aux autres champs', async () => {
    const dejaChiffree = service.chiffrer('https://hooks.slack.com/ancien');
    const documents = [
      { _id: 'c1', config: { nom: 'Slack', webhook: 'https://hooks.slack.com/nouveau' } },
      { _id: 'c2', config: { nom: 'Slack bis', webhook: dejaChiffree } },
    ];
    const updateOne = jest.fn(async () => {});
    let index = 0;
    const curseur = {
      hasNext: async () => index < documents.length,
      next: async () => documents[index++],
    };
    const collection = { find: jest.fn(() => curseur), updateOne };
    const bases = {
      dryapi_test: { databaseName: 'dryapi_test', collection: jest.fn(() => collection) },
      NovaDB: { databaseName: 'NovaDB', collection: jest.fn(() => collection) },
    };
    const client = { db: jest.fn((nom) => bases[nom] || bases.dryapi_test) };

    await migration.up(client);

    expect(updateOne).toHaveBeenCalledTimes(1);
    const ecrit = updateOne.mock.calls[0][1].$set.config;
    expect(ecrit.nom).toBe('Slack');
    expect(ecrit.webhook).not.toBe('https://hooks.slack.com/nouveau');
    expect(service.dechiffrer(ecrit.webhook)).toBe('https://hooks.slack.com/nouveau');
  });
});

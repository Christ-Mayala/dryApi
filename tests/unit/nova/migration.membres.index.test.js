/**
 * Migration 006 — retrait de l'index e-mail global de `NovaDB.membres`.
 *
 * Deux régressions sont verrouillées ici :
 *   1. une base qui n'a pas de collection `membres` (la base DRY `dryapi`) doit
 *      être ignorée : `listIndexes` y renvoie NamespaceNotFound ;
 *   2. l'index unique `email_1` doit être supprimé, sans toucher aux documents,
 *      et les index composites workspace-scoped (re)créés.
 */

const migration = require('../../../migrations/006-nova-drop-global-member-email-index');

const dbFactice = ({ nom, collectionPresente = true, indexes = [] } = {}) => {
  const collection = {
    indexes: jest.fn(async () => indexes),
    dropIndex: jest.fn(async () => {}),
    createIndex: jest.fn(async () => {}),
  };
  return {
    nom,
    collection,
    base: {
      databaseName: nom,
      listCollections: jest.fn(() => ({
        toArray: async () => (collectionPresente ? [{ name: 'membres' }] : []),
      })),
      collection: jest.fn(() => collection),
    },
  };
};

describe('Migration 006 — index des appartenances NOVA', () => {
  let journal;

  beforeEach(() => {
    journal = jest.spyOn(console, 'log').mockImplementation(() => {});
    delete process.env.NOVA_MIGRATION_DRY_RUN;
  });

  afterEach(() => {
    journal.mockRestore();
    delete process.env.NOVA_MIGRATION_DRY_RUN;
  });

  it('ignore une base sans collection membres au lieu de planter sur listIndexes', async () => {
    const vide = dbFactice({ nom: 'dryapi', collectionPresente: false });
    const nova = dbFactice({ nom: 'NovaDB', collectionPresente: false });
    const client = { db: jest.fn((nom) => (nom === 'NovaDB' ? nova.base : vide.base)) };

    await migration.up(client);

    expect(vide.base.collection).not.toHaveBeenCalled();
    expect(nova.base.collection).not.toHaveBeenCalled();
    expect(journal).toHaveBeenCalledWith(expect.stringContaining('collection membres absente'));
  });

  it('supprime uniquement email_1 et recrée les index composites sur NovaDB', async () => {
    const collection = {
      indexes: jest.fn(async () => [
        { name: '_id_', key: { _id: 1 } },
        { name: 'email_1', key: { email: 1 }, unique: true },
      ]),
      dropIndex: jest.fn(async () => {}),
      createIndex: jest.fn(async () => {}),
    };
    const nova = {
      databaseName: 'NovaDB',
      listCollections: jest.fn(() => ({ toArray: async () => [{ name: 'membres' }] })),
      collection: jest.fn(() => collection),
    };
    const vide = dbFactice({ nom: 'dryapi', collectionPresente: false });
    const client = { db: jest.fn((nom) => (nom === 'NovaDB' ? nova : vide.base)) };

    await migration.up(client);

    expect(collection.dropIndex).toHaveBeenCalledTimes(1);
    expect(collection.dropIndex).toHaveBeenCalledWith('email_1');
    expect(collection.createIndex).toHaveBeenCalledWith(
      { workspaceId: 1, email: 1 },
      { unique: true }
    );
    expect(collection.createIndex).toHaveBeenCalledWith({ workspaceId: 1, utilisateurId: 1 });
    expect(collection.createIndex).toHaveBeenCalledWith({ workspaceId: 1, role: 1 });
    expect(journal).toHaveBeenCalledWith(expect.stringContaining('index email_1 supprimé'));
  });

  it('ne écrit rien en simulation', async () => {
    process.env.NOVA_MIGRATION_DRY_RUN = '1';
    const cible = dbFactice({
      nom: 'NovaDB',
      indexes: [{ name: 'email_1', key: { email: 1 }, unique: true }],
    });
    const vide = dbFactice({ nom: 'dryapi', collectionPresente: false });
    const client = { db: jest.fn((nom) => (nom === 'NovaDB' ? cible.base : vide.base)) };

    await migration.up(client);

    expect(cible.collection.dropIndex).not.toHaveBeenCalled();
    expect(cible.collection.createIndex).not.toHaveBeenCalled();
    expect(journal).toHaveBeenCalledWith(expect.stringContaining('Simulation'));
  });
});

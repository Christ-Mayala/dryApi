/**
 * Tests unitaires — Sync Controller (multi-appareils)
 *
 * Couvre :
 *   1. INSERT idempotent (ré-écriture du même enregistrement)
 *   2. INSERT collision cross-device (contenu différent → split)
 *   3. INSERT nouveau document
 *   4. UPDATE via localId canonique
 *   5. UPDATE via aliases (après split)
 *   6. UPDATE introuvable → erreur
 *   7. DELETE via localId canonique
 *   8. DELETE via aliases (après split)
 *   9. DELETE introuvable → erreur
 *  10. Invoice INSERT collision → numéro renommé
 *  11. Pull → fallback localId pour doc sans localId
 *  12. Pull → deduplication invoiceNumber
 *  13. Stats → retours corrects
 *  14. Push opération non supportée → erreur dans errors[]
 */

jest.mock('express-async-handler', () => (fn) => fn);
jest.mock('../../../dry/utils/http/response');

const sendResponse = require('../../../dry/utils/http/response');
const syncController = require('../../../dryApp/Trivida/features/sync/controller/sync.controller');

describe('Sync Controller (multi-appareils)', () => {
    let mockTransactionModel;
    let mockInvoiceModel;
    let mockUserModel;
    let req;
    let res;

    const USER_ID = 'USER123';

    const makeDoc = (overrides = {}) => ({
        _id: 'DOC_' + Math.random().toString(36).slice(2, 8),
        userId: USER_ID,
        localId: 1,
        type: 'depense',
        category: 'Transport',
        amount: 1500,
        date: new Date('2026-01-15'),
        description: 'Essence voiture',
        deleted: false,
        updatedAt: new Date(),
        createdAt: new Date(),
        ...overrides,
    });

    const makeInvoice = (overrides = {}) => ({
        _id: 'INV_' + Math.random().toString(36).slice(2, 8),
        userId: USER_ID,
        localId: 5,
        invoiceNumber: 'FAC-001',
        amount: 25000,
        date: new Date('2026-01-10'),
        status: 'impayée',
        deleted: false,
        updatedAt: new Date(),
        createdAt: new Date(),
        ...overrides,
    });

    const makeResponse = () => {
        const r = { locals: {} };
        r.status = jest.fn().mockReturnValue(r);
        r.json = jest.fn().mockReturnValue(r);
        r.send = jest.fn().mockReturnValue(r);
        return r;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockTransactionModel = {
            findOne: jest.fn(),
            find: jest.fn(),
            findOneAndUpdate: jest.fn(),
            updateOne: jest.fn(),
            countDocuments: jest.fn().mockResolvedValue(0),
            exists: jest.fn().mockResolvedValue(null),
        };

        mockInvoiceModel = {
            findOne: jest.fn(),
            find: jest.fn(),
            findOneAndUpdate: jest.fn(),
            updateOne: jest.fn(),
            countDocuments: jest.fn().mockResolvedValue(0),
            exists: jest.fn().mockResolvedValue(null),
        };

        mockUserModel = {
            findByIdAndUpdate: jest.fn().mockResolvedValue({ _id: USER_ID }),
        };

        req = {
            body: { operations: [] },
            query: {},
            user: { _id: USER_ID, lastSyncAt: null },
            getModel: jest.fn((name) => {
                if (name === 'User') return mockUserModel;
                if (name === 'TrividaInvoice') return mockInvoiceModel;
                if (name === 'TrividaTransaction') return mockTransactionModel;
                return mockTransactionModel;
            }),
        };

        res = makeResponse();
        sendResponse.mockImplementation((_res, _data, _msg) => { _res.json({ success: true }); return _res; });
    });

    // ─── helpers ──────────────────────────────────────────────────────────────

    /** Configure les mocks pour que Model.find({userId,$or}) renvoie `docs` */
    function mockFindForVariants(model, docs) {
        model.find.mockImplementation(() => ({
            lean: jest.fn().mockResolvedValue(docs),
        }));
    }

    /** Configure le chaînage mongoose Model.find().sort().limit().lean() pour pull */
    function mockFindForPull(model, docs, count = docs.length) {
        model.find.mockReturnValue({
            sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(docs),
                }),
            }),
        });
        model.countDocuments.mockResolvedValue(count);
    }

    /** Modèle vide (pull) pour toutes les autres entités */
    function makeEmptyPullModel() {
        return {
            find: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
                }),
            }),
            countDocuments: jest.fn().mockResolvedValue(0),
            updateOne: jest.fn().mockResolvedValue(),
        };
    }

    /** Configurer req.getModel pour le pull complet (transaction + invoice) */
    function mockPullGetModel(extra) {
        req.getModel.mockImplementation((name) => {
            if (name === 'User') return mockUserModel;
            if (name === 'TrividaTransaction') return mockTransactionModel;
            if (name === 'TrividaInvoice') return mockInvoiceModel;
            return makeEmptyPullModel();
        });
        if (extra) extra();
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    describe('push — INSERT', () => {
        it('1. INSERT idempotent → met à jour le doc existant même contenu', async () => {
            const existing = makeDoc({ localId: 1, amount: 1500 });
            const incoming = { ...existing, amount: 1500, id: 1 };

            mockFindForVariants(mockTransactionModel, [existing]);
            mockTransactionModel.findOneAndUpdate.mockResolvedValue({ ...existing, amount: 1500 });

            req.body.operations = [{
                entity: 'transaction',
                localId: '1',
                operation: 'INSERT',
                payload: incoming,
            }];

            await syncController.push(req, res, jest.fn());

            expect(mockTransactionModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
            const firstCall = mockTransactionModel.findOneAndUpdate.mock.calls[0][0];
            expect(firstCall).toEqual({ _id: existing._id });

            const payload = sendResponse.mock.calls[0][1];
            expect(payload.results).toHaveLength(1);
            expect(payload.results[0].status).toBe('created');
            expect(payload.results[0].localId).toBe('1');
            expect(payload.errors).toHaveLength(0);
        });

        it('2. INSERT collision cross-device → crée un doc split avec localId dérivé', async () => {
            // Appareil A : localId=1 amount=5000 (déjà stocké)
            const existingA = makeDoc({ localId: 1, amount: 5000, description: 'Taxi' });
            // Appareil B pousse localId=1 amount=1500 Ession (contenu différent)
            const incoming = { localId: 1, amount: 1500, type: 'depense', category: 'Transport', date: new Date(), description: 'Essence', id: 1 };

            mockFindForVariants(mockTransactionModel, [existingA]);
            // allocateUniqueLocalId : aucun candidat occupé (chaînable)
            mockTransactionModel.findOne.mockImplementation(() => ({
                select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
            }));
            // Le upsert crée le doc split
            const splitDoc = makeDoc({ localId: 7777, amount: 1500, aliases: ['1'], deviceId: 'DEV_B' });
            mockTransactionModel.findOneAndUpdate.mockResolvedValue(splitDoc);

            req.body.operations = [{
                entity: 'transaction',
                localId: '1',
                operation: 'INSERT',
                payload: incoming,
            }];

            await syncController.push(req, res, jest.fn());

            expect(mockTransactionModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
            const upsertCall = mockTransactionModel.findOneAndUpdate.mock.calls[0];
            expect(upsertCall[1].$addToSet).toEqual({ aliases: '1' });
            expect(upsertCall[1].$set.localId).toBeGreaterThanOrEqual(1);

            const payload = sendResponse.mock.calls[0][1];
            expect(payload.results).toHaveLength(1);
            expect(payload.results[0].localId).toBe('1'); // echo original pour confirmation
            expect(payload.results[0].status).toBe('created');
        });

        it('3. INSERT nouveau document (aucun conflit) → upsert classique', async () => {
            const incoming = { localId: 3, amount: 2000, type: 'revenu', category: 'Salaire', date: new Date(), id: 3 };

            mockFindForVariants(mockTransactionModel, []);
            const newDoc = makeDoc({ localId: 3, amount: 2000 });
            mockTransactionModel.findOneAndUpdate.mockResolvedValue(newDoc);

            req.body.operations = [{
                entity: 'transaction',
                localId: '3',
                operation: 'INSERT',
                payload: incoming,
            }];

            await syncController.push(req, res, jest.fn());

            expect(mockTransactionModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
            expect(mockTransactionModel.findOneAndUpdate.mock.calls[0][0]).toEqual({
                localId: '3', userId: USER_ID, deviceId: null,
            });

            const payload = sendResponse.mock.calls[0][1];
            expect(payload.results).toHaveLength(1);
            expect(payload.results[0].serverId).toBe(newDoc._id);
        });
    });

    describe('push — UPDATE', () => {
        it('4. UPDATE trouvé par localId canonique → mis à jour', async () => {
            const existing = makeDoc({ localId: 2, amount: 3000 });
            const incoming = { ...existing, amount: 3500, id: 2 };

            mockFindForVariants(mockTransactionModel, [existing]);
            mockTransactionModel.findOne.mockResolvedValue(existing);
            mockTransactionModel.findOneAndUpdate.mockResolvedValue({ ...existing, amount: 3500 });

            req.body.operations = [{
                entity: 'transaction',
                localId: '2',
                operation: 'UPDATE',
                payload: incoming,
            }];

            await syncController.push(req, res, jest.fn());

            expect(mockTransactionModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
            expect(mockTransactionModel.findOneAndUpdate.mock.calls[0][1].$set.amount).toBe(3500);
            expect(sendResponse.mock.calls[0][1].results[0].status).toBe('updated');
        });

        it('5. UPDATE trouvé via aliases (post-split) → met à jour le bon doc', async () => {
            const splitDoc = makeDoc({ localId: 8888, amount: 1500, aliases: ['1'] });
            const incoming = { ...splitDoc, amount: 1600, id: '1' };

            mockFindForVariants(mockTransactionModel, [splitDoc]);
            mockTransactionModel.findOne.mockResolvedValue(splitDoc);
            mockTransactionModel.findOneAndUpdate.mockResolvedValue({ ...splitDoc, amount: 1600 });

            req.body.operations = [{
                entity: 'transaction',
                localId: '1',
                operation: 'UPDATE',
                payload: incoming,
            }];

            await syncController.push(req, res, jest.fn());

            expect(mockTransactionModel.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: splitDoc._id });
            expect(sendResponse.mock.calls[0][1].results[0].status).toBe('updated');
        });

        it('6. UPDATE introuvable → erreur dans errors[]', async () => {
            mockFindForVariants(mockTransactionModel, []);
            mockTransactionModel.findOne.mockResolvedValue(null);

            req.body.operations = [{
                entity: 'transaction',
                localId: '999',
                operation: 'UPDATE',
                payload: { localId: '999', id: 999, amount: 100 },
            }];

            await syncController.push(req, res, jest.fn());

            expect(sendResponse.mock.calls[0][1].errors).toHaveLength(1);
            expect(sendResponse.mock.calls[0][1].errors[0].error).toMatch(/introuvable/);
        });
    });

    describe('push — DELETE', () => {
        it('7. DELETE trouvé par localId canonique → soft-delete', async () => {
            const existing = makeDoc({ localId: 4 });
            mockFindForVariants(mockTransactionModel, [existing]);
            mockTransactionModel.findOne.mockResolvedValue(existing);
            mockTransactionModel.findOneAndUpdate.mockResolvedValue(existing);

            req.body.operations = [{
                entity: 'transaction',
                localId: '4',
                operation: 'DELETE',
                payload: { id: '4' },
            }];

            await syncController.push(req, res, jest.fn());

            expect(mockTransactionModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
            expect(mockTransactionModel.findOneAndUpdate.mock.calls[0][1].$set.deleted).toBe(true);
            expect(sendResponse.mock.calls[0][1].results[0].status).toBe('deleted');
        });

        it('8. DELETE via aliases (après split) → soft-delete le doc split', async () => {
            const splitDoc = makeDoc({ localId: 6666, aliases: ['1'], amount: 1500 });
            mockFindForVariants(mockTransactionModel, [splitDoc]);
            mockTransactionModel.findOne.mockResolvedValue(splitDoc);
            mockTransactionModel.findOneAndUpdate.mockResolvedValue(splitDoc);

            req.body.operations = [{
                entity: 'transaction',
                localId: '1',
                operation: 'DELETE',
                payload: { id: '1' },
            }];

            await syncController.push(req, res, jest.fn());

            expect(mockTransactionModel.findOneAndUpdate.mock.calls[0][1].$set.deleted).toBe(true);
            expect(sendResponse.mock.calls[0][1].results[0].status).toBe('deleted');
        });

        it('9. DELETE introuvable → erreur', async () => {
            mockFindForVariants(mockTransactionModel, []);
            mockTransactionModel.findOne.mockResolvedValue(null);

            req.body.operations = [{
                entity: 'transaction',
                localId: '404',
                operation: 'DELETE',
                payload: { id: '404' },
            }];

            await syncController.push(req, res, jest.fn());

            expect(sendResponse.mock.calls[0][1].errors).toHaveLength(1);
            expect(sendResponse.mock.calls[0][1].errors[0].error).toMatch(/introuvable/);
        });
    });

    describe('push — invoice number uniqueness', () => {
        it('10. INSERT invoice collision → numéro renommé pour éviter le conflit', async () => {
            const existingInvoice = makeInvoice({ localId: 5, invoiceNumber: 'FAC-001', amount: 10000 });
            const incoming = { ...existingInvoice, amount: 10000, id: 5 };

            // Même contenu → update; nextFreeInvoiceNumber constate que
            // FAC-001 est pris par une AUTRE facture → renomme en FAC-001-2.
            mockFindForVariants(mockInvoiceModel, [existingInvoice]);
            mockInvoiceModel.findOneAndUpdate.mockResolvedValue(existingInvoice);
            // findOne chaînable : FAC-001 est pris par une AUTRE facture en DB
            mockInvoiceModel.findOne.mockImplementation((filter) => ({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(filter.invoiceNumber === 'FAC-001' ? { _id: 'OTHER_INVOICE' } : null),
                }),
            }));
            mockInvoiceModel.updateOne.mockResolvedValue();

            req.body.operations = [{
                entity: 'invoice',
                localId: '5',
                operation: 'INSERT',
                payload: incoming,
            }];

            req.getModel.mockImplementation((name) => {
                if (name === 'User') return mockUserModel;
                if (name === 'TrividaInvoice') return mockInvoiceModel;
                return mockTransactionModel;
            });

            await syncController.push(req, res, jest.fn());

            expect(mockInvoiceModel.updateOne).toHaveBeenCalled();
            const updateArgs = mockInvoiceModel.updateOne.mock.calls[0][1].$set;
            expect(updateArgs.invoiceNumber).toBe('FAC-001-2');

            const payload = sendResponse.mock.calls[0][1];
            expect(payload.results).toHaveLength(1);
            expect(payload.results[0].status).toBe('created');
        });
    });

    describe('pull', () => {
        it('11. Retourne un localId fallback pour les docs sans localId', async () => {
            const docWithoutLocalId = makeDoc({ localId: undefined, amount: 100 });

            mockFindForPull(mockTransactionModel, [docWithoutLocalId]);
            mockFindForPull(mockInvoiceModel, []);
            mockPullGetModel();

            req.query = {};  // pull complet

            await syncController.pull(req, res, jest.fn());

            const payload = sendResponse.mock.calls[0][1];
            const txChanges = payload.changes.filter(c => c.entity === 'transaction');
            expect(txChanges).toHaveLength(1);
            expect(typeof txChanges[0].data.localId).toBe('number');
            expect(txChanges[0].data.localId).toBeGreaterThan(0);
        });

        it('12. Invoice deduplication: deux factures même numéro → renommage dans la réponse', async () => {
            const inv1 = makeInvoice({ _id: 'I1', localId: 10, invoiceNumber: 'FAC-100' });
            const inv2 = makeInvoice({ _id: 'I2', localId: 11, invoiceNumber: 'FAC-100' });

            mockFindForPull(mockInvoiceModel, [inv1, inv2]);
            mockFindForPull(mockTransactionModel, []);
            // nextFreeInvoiceNumber : FAC-100 pris par I1 (real DB) → renomme
            mockInvoiceModel.findOne.mockImplementation((filter) => ({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(filter.invoiceNumber === 'FAC-100' ? { _id: 'I1' } : null),
                }),
            }));
            mockInvoiceModel.updateOne.mockResolvedValue();
            mockPullGetModel();

            req.query = {};

            await syncController.pull(req, res, jest.fn());

            const payload = sendResponse.mock.calls[0][1];
            const invoiceChanges = payload.changes.filter(c => c.entity === 'invoice');
            expect(invoiceChanges).toHaveLength(2);
            const numbers = invoiceChanges.map(c => c.data.invoiceNumber);
            expect(numbers[0]).toBe('FAC-100');
            expect(numbers[1]).toBe('FAC-100-2');
            expect(new Set(numbers).size).toBe(2); // 2 uniques
        });
    });

    describe('stats', () => {
        it('13. Retourne les comptes et lastSyncAt', async () => {
            mockTransactionModel.countDocuments.mockResolvedValue(42);
            mockInvoiceModel.countDocuments.mockResolvedValue(7);

            req.getModel.mockImplementation((name) => {
                if (name === 'User') return mockUserModel;
                if (name === 'TrividaTransaction') return mockTransactionModel;
                if (name === 'TrividaInvoice') return mockInvoiceModel;
                return mockTransactionModel;
            });

            req.user.lastSyncAt = new Date('2026-09-01');
            await syncController.stats(req, res, jest.fn());

            const payload = sendResponse.mock.calls[0][1];
            expect(payload.lastSync).toBeInstanceOf(Date);
            expect(payload.transaction).toBe(42);
            expect(payload.invoice).toBe(7);
        });
    });

    describe('push — erreurs', () => {
        it('14. Opération sur entité inconnue → erreur dans errors[]', async () => {
            req.body.operations = [{
                entity: 'unknown_entity',
                localId: '1',
                operation: 'INSERT',
                payload: { id: 1 },
            }];

            await syncController.push(req, res, jest.fn());

            expect(sendResponse.mock.calls[0][1].errors).toHaveLength(1);
            expect(sendResponse.mock.calls[0][1].errors[0].error).toMatch(/supportée/);
            expect(sendResponse.mock.calls[0][1].results).toHaveLength(0);
        });
    });
});

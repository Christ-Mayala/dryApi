/**
 * Tests unitaires — Programme de parrainage Trivida (referral.controller)
 *
 * Couvre les exigences d'audit sécurité (12 cas) :
 *   1.  Code de parrainage requis (REFERRAL_CODE_REQUIRED)
 *   2.  Code invalide (REFERRAL_CODE_INVALID)
 *   3.  Code inactif (REFERRAL_CODE_INACTIVE)
 *   4.  Non authentifié (protect → aucun req.user → service refuse)
 *   5.  Auto-parrainage (REFERRAL_SELF_REFERRAL)
 *   6.  Première réclamation → succès + bonus
 *   7.  Re-réclamation du même code → REFERRAL_ALREADY_CLAIMED
 *   8.  Retry idempotent (même code, même user, déjà claimé) → déjàClaimed sans double bonus
 *   9.  Deux requêtes simultanées → un seul crédit (race, index unique)
 *  10.  Manipulation du montant dans le corps → ignoré (montant du serveur)
 *  11.  Stats : aucun email exposé (privacy)
 *  12.  Récompense parrain : idempotente (pas de double $inc), accès limité au parrain
 */

jest.mock('express-async-handler', () => (fn) => fn);
jest.mock('../../../dry/utils/http/response');

const sendResponse = require('../../../dry/utils/http/response');
const config = require('../../../config/database');
const referralController = require('../../../dryApp/Trivida/features/referral/controller/referral.controller');

describe('Referral Controller (audit sécurité)', () => {
  let mockReferral;
  let mockUser;
  let req;

  const makeResponse = () => {
    const res = { locals: {} };
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.type = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  };

  const buildReferral = (overrides = {}) => ({
    _id: 'ref123',
    referrerId: 'PARRAIN_ID',
    referrerEmail: 'parrain@test.com',
    referralCode: 'TRIABC',
    referredUserId: null,
    referredEmail: null,
    status: 'pending',
    active: true,
    referrerReward: 0,
    referredReward: 0,
    rewardType: null,
    referrerRewardGranted: false,
    referredRewardGranted: false,
    invitedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockReferral = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
    };

    mockUser = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    req = {
      body: {},
      query: {},
      user: { _id: 'FILLEUL_ID', email: 'filleul@test.com', name: 'Filleul' },
      getModel: jest.fn((name) => {
        if (name === 'User') return mockUser;
        return mockReferral;
      }),
      headers: { accept: 'application/json' },
    };

    sendResponse.mockImplementation((res) => {
      res.json({ success: true });
      return res;
    });
  });

  describe('claimReferral (POST /claim)', () => {
    it('1. REFERRAL_CODE_REQUIRED quand le code est absent du body', async () => {
      const res = makeResponse();
      await expect(referralController.claimReferral(req, res, jest.fn())).rejects.toThrow(
        'Le code de parrainage est requis.'
      );
      expect(mockReferral.findOne).not.toHaveBeenCalled();
    });

    it('2. REFERRAL_CODE_INVALID quand le code nexiste pas', async () => {
      req.body.code = 'ZZZZZZ';
      mockReferral.findOne.mockResolvedValue(null);
      const res = makeResponse();
      await expect(referralController.claimReferral(req, res, jest.fn())).rejects.toThrow(
        'Code de parrainage introuvable.'
      );
      expect(mockReferral.findOne).toHaveBeenCalledWith({
        referralCode: 'ZZZZZZ',
        deleted: { $ne: true },
      });
    });

    it('3. REFERRAL_CODE_INACTIVE quand le code est désactivé', async () => {
      req.body.code = 'TRIABC';
      mockReferral.findOne.mockResolvedValue(buildReferral({ active: false }));
      const res = makeResponse();
      await expect(referralController.claimReferral(req, res, jest.fn())).rejects.toThrow(
        'Code de parrainage inactif.'
      );
    });

    it('4. Service refuse sans utilisateur authentifié (protect ne fournit pas req.user)', async () => {
      req.body.code = 'TRIABC';
      delete req.user;
      const res = makeResponse();
      await expect(referralController.claimReferral(req, res, jest.fn())).rejects.toThrow();
    });

    it('5. REFERRAL_SELF_REFERRAL quand on utilise son propre code', async () => {
      req.body.code = 'TRIABC';
      req.user = { _id: 'PARRAIN_ID', email: 'parrain@test.com' };
      mockReferral.findOne.mockResolvedValue(buildReferral());
      const res = makeResponse();
      await expect(referralController.claimReferral(req, res, jest.fn())).rejects.toThrow(
        'Vous ne pouvez pas utiliser votre propre code.'
      );
    });

    it('6. Première réclamation → bonus filleul accordé une seule fois', async () => {
      req.body.code = 'TRIABC';
      mockReferral.findOne.mockImplementation((filter = {}) => {
        if (filter.referralCode) return Promise.resolve(buildReferral());
        if (filter.referredUserId) return Promise.resolve(null); // pas encore parrainé
        return Promise.resolve(buildReferral());
      });
      mockReferral.findOneAndUpdate.mockResolvedValue(
        buildReferral({ referredUserId: 'FILLEUL_ID', referredEmail: 'filleul@test.com', status: 'completed' })
      );
      mockUser.findByIdAndUpdate.mockResolvedValue({ _id: 'FILLEUL_ID', aiBonusRequests: 1 });

      const res = makeResponse();
      await referralController.claimReferral(req, res, jest.fn());

      expect(mockReferral.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'ref123',
          referredUserId: null,
          status: 'pending',
        }),
        expect.objectContaining({ $set: expect.objectContaining({ referredUserId: 'FILLEUL_ID', status: 'completed' }) }),
        { new: true }
      );
      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledWith(
        'FILLEUL_ID',
        { $inc: { aiBonusRequests: config.REFERRAL.rewardNewUser } },
        { new: true }
      );
      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    });

    it("7. Re-réclamation d'un code déjà utilisé par un AUTRE → REFERRAL_ALREADY_CLAIMED", async () => {
      req.body.code = 'TRIABC';
      mockReferral.findOne.mockResolvedValue(
        buildReferral({ referredUserId: 'AUTRE_USER', referredEmail: 'autre@test.com', status: 'completed' })
      );
      const res = makeResponse();
      await expect(referralController.claimReferral(req, res, jest.fn())).rejects.toThrow(
        'Ce code de parrainage a déjà été utilisé.'
      );
      expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('8. Retry réseau idempotent → déjàClaimed sans double crédit', async () => {
      req.body.code = 'TRIABC';
      mockReferral.findOne.mockResolvedValue(
        buildReferral({ referredUserId: 'FILLEUL_ID', referredEmail: 'filleul@test.com', status: 'completed' })
      );
      const res = makeResponse();
      await referralController.claimReferral(req, res, jest.fn());
      expect(sendResponse).toHaveBeenCalled();
      const payload = sendResponse.mock.calls[0][1];
      expect(payload.alreadyClaimed).toBe(true);
      expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('9. Course simultanée perdante → REFERRAL_ALREADY_CLAIMED sans double crédit', async () => {
      req.body.code = 'TRIABC';
      // Premier findOne : code trouvé ; second findOne (check déjà parrainé) : aucun.
      mockReferral.findOne.mockImplementation((filter = {}) => {
        if (filter.referralCode) return Promise.resolve(buildReferral());
        return Promise.resolve(null);
      });
      // La première requête a gagné le findOneAndUpdate ; la seconde reçoit null.
      mockReferral.findOneAndUpdate.mockResolvedValue(null);
      mockReferral.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(
          buildReferral({ referredUserId: 'AUTRE_USER', status: 'completed' })
        ),
      });

      const res = makeResponse();
      await expect(referralController.claimReferral(req, res, jest.fn())).rejects.toThrow(
        'Ce code de parrainage a déjà été utilisé.'
      );
      expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('10. Montant manipulé dans le body → ignoré (montant serveur uniquement)', async () => {
      req.body.code = 'TRIABC';
      req.body.reward = 99999;
      req.body.referredUserId = 'FAKE_ID'; // doit être ignoré
      mockReferral.findOne.mockImplementation((filter = {}) => {
        if (filter.referralCode) return Promise.resolve(buildReferral());
        return Promise.resolve(null);
      });
      mockReferral.findOneAndUpdate.mockResolvedValue(buildReferral({ referredUserId: 'FILLEUL_ID' }));

      const res = makeResponse();
      await referralController.claimReferral(req, res, jest.fn());

      // L'identité vient du token (req.user._id), pas du body.
      expect(mockReferral.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'ref123', referredUserId: null }),
        expect.objectContaining({ $set: expect.objectContaining({ referredUserId: 'FILLEUL_ID' }) }),
        { new: true }
      );
      // Montant serveur (config), pas le 99999 du body.
      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledWith(
        'FILLEUL_ID',
        { $inc: { aiBonusRequests: config.REFERRAL.rewardNewUser } },
        { new: true }
      );
    });
  });

  describe('validateCode (POST /validate — alias idempotent)', () => {
    it('11. Se comporte comme /claim : code requis', async () => {
      const res = makeResponse();
      await expect(referralController.validateCode(req, res, jest.fn())).rejects.toThrow(
        'Le code de parrainage est requis.'
      );
    });

    it('11bis. Se comporte comme /claim : claim réussi via le même chemin', async () => {
      req.body.code = 'TRIABC';
      mockReferral.findOne.mockImplementation((filter = {}) => {
        if (filter.referralCode) return Promise.resolve(buildReferral());
        return Promise.resolve(null);
      });
      mockReferral.findOneAndUpdate.mockResolvedValue(buildReferral({ referredUserId: 'FILLEUL_ID' }));
      const res = makeResponse();
      await referralController.validateCode(req, res, jest.fn());
      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats (privacy)', () => {
    it('12. Ne renvoie AUCUN email de filleul ou parrain', async () => {
      const records = [
        buildReferral({ status: 'completed', referredEmail: 'secreat@test.com' }),
        buildReferral({ status: 'pending' }),
        buildReferral({ status: 'rewarded', referredEmail: 'autre@test.com', referrerReward: 1, referrerRewardGranted: true }),
      ];
      mockReferral.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(records),
        }),
      });
      const res = makeResponse();
      await referralController.getStats(req, res, jest.fn());

      const payload = sendResponse.mock.calls[0][1];
      const json = JSON.stringify(payload);
      expect(json).not.toContain('@test.com');
      expect(payload.referrals).toBeDefined();
      expect(payload.referrals.every((r) => !('email' in r))).toBe(true);
      expect(payload.aiRequestsEarned).toBe(1 * config.REFERRAL.rewardReferrer);
    });
  });

  describe('activateReward (POST /reward — idempotent)', () => {
    it("13. Ne récompense pas un filleul qui n'est PAS son propre filleul (accès limite au parrain)", async () => {
      const res = makeResponse();
      req.body.referredUserId = 'FILLEUL_ID';
      // Le referral appartient à un AUTRE parrain → sans findOne, provenance non autorisée
      mockReferral.findOne.mockResolvedValue(null);
      await referralController.activateReward(req, res, jest.fn());
      expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalled();
    });

    it('14. Récompense idempotente : double appel → UN seul $inc', async () => {
      req.body.referredUserId = 'FILLEUL_ID';
      req.user = { _id: 'PARRAIN_ID' };
      const referral = buildReferral({ status: 'completed', referrerId: 'PARRAIN_ID' });
      mockReferral.findOne.mockResolvedValue(referral);
      mockReferral.findOneAndUpdate.mockResolvedValue(
        buildReferral({ status: 'rewarded', referrerId: 'PARRAIN_ID', referrerReward: 1, referrerRewardGranted: true })
      );
      mockUser.findByIdAndUpdate.mockResolvedValue({ _id: 'PARRAIN_ID', aiBonusRequests: 1 });

      // Transactions du filleul → seuil atteint
      const mockTx = { countDocuments: jest.fn().mockResolvedValue(5) };
      req.getModel.mockImplementation((name) => {
        if (name === 'User') return mockUser;
        if (name === 'TrividaTransaction') return mockTx;
        return mockReferral;
      });

      const res = makeResponse();
      // Premier appel : succès
      await referralController.activateReward(req, res, jest.fn());
      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledWith(
        'PARRAIN_ID',
        { $inc: { aiBonusRequests: config.REFERRAL.rewardReferrer } },
        { new: true }
      );
      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledTimes(1);

      // Deuxième appel : le findOne (referrerRewardGranted:false) ne matche plus
      mockReferral.findOne.mockReset();
      mockReferral.findOne.mockResolvedValue(null);
      await referralController.activateReward(req, res, jest.fn());
      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledTimes(1); // toujours 1
    });
  });
});
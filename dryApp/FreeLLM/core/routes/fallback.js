const express = require('express');
const { getAllPenalties } = require('../services/router');
const protect = require('../../../../dry/middlewares/protection/auth.middleware').protect;

function parseBudget(s) {
  const m = s.match(/~?([\d.]+)(?:-([\d.]+))?([MK])?/);
  if (!m) return 0;
  const high = parseFloat(m[2] ?? m[1]);
  const unit = m[3] === 'M' ? 1000000 : m[3] === 'K' ? 1000 : 1;
  return high * unit;
}

async function applyFallbackChain(FallbackConfigModel, entries) {
  const normalized = entries.map((entry, index) => ({
    modelDbId: entry.modelDbId,
    enabled: entry.enabled !== false,
    label: entry.label || '',
    priority: index + 1,
  }));

  if (normalized.length === 0) {
    await FallbackConfigModel.updateMany(
      {},
      { $set: { enabled: false, deletedAt: null, status: 'active' } }
    );
    return;
  }

  const ops = normalized.map((entry) => {
    const setPayload = {
      enabled: entry.enabled,
      priority: entry.priority,
      deletedAt: null,
      status: 'active',
    };
    if (entry.label) {
      setPayload.label = entry.label;
    }

    return {
      updateOne: {
        filter: { modelDbId: entry.modelDbId },
        update: {
          $set: setPayload,
          $setOnInsert: { modelDbId: entry.modelDbId },
        },
        upsert: true,
      },
    };
  });

  await FallbackConfigModel.bulkWrite(ops, { ordered: true });

  const keepIds = normalized.map((entry) => entry.modelDbId);
  await FallbackConfigModel.updateMany(
    { modelDbId: { $nin: keepIds } },
    { $set: { enabled: false, deletedAt: null, status: 'active' } }
  );
}

function createFallbackRouter(ModelsModel, FallbackConfigModel, ApiKeysModel, RequestsModel) {
  const router = express.Router();
  router.use(protect);
  router.get('/', async (req, res) => {
    const items = await FallbackConfigModel.find({ deletedAt: null })
      .sort({ priority: 1 })
      .populate({ path: 'modelDbId', strictPopulate: false })
      .lean();

    const keyCounts = await ApiKeysModel.aggregate([
      { $match: { enabled: true, deletedAt: null } },
      { $group: { _id: '$platform', count: { $sum: 1 } } }
    ]);
    const keyCountMap = new Map(keyCounts.map(k => [k._id, k.count]));

    const penalties = getAllPenalties();
    const penaltyMap = new Map(penalties.map(p => [p.modelDbId.toString(), p]));

    const chain = items.map(it => {
      const model = it.modelDbId;
      const penalty = penaltyMap.get(it.modelDbId.toString());
      return {
        modelDbId: it.modelDbId._id,
        priority: it.priority,
        effectivePriority: it.priority + (penalty?.penalty || 0),
        penalty: penalty?.penalty || 0,
        rateLimitHits: penalty?.count || 0,
        enabled: it.enabled,
        platform: model?.platform || '',
        modelId: model?.modelId || '',
        displayName: model?.displayName || '',
        intelligenceRank: model?.intelligenceRank || 0,
        speedRank: model?.speedRank || 0,
        sizeLabel: model?.sizeLabel || '',
        rpmLimit: model?.rpmLimit || null,
        rpdLimit: model?.rpdLimit || null,
        monthlyTokenBudget: model?.monthlyTokenBudget || '0',
        keyCount: keyCountMap.get(model?.platform) || 0,
      };
    });

    res.json(chain);
  });

  router.put('/', async (req, res) => {
    try {
      const newChain = Array.isArray(req.body) ? req.body : [];
      const seen = new Set();

      for (const item of newChain) {
        const id = String(item.modelDbId || '');
        if (!id) {
          return res.status(400).json({ error: { message: 'modelDbId is required' } });
        }
        if (seen.has(id)) {
          return res.status(400).json({ error: { message: 'Duplicate modelDbId in chain: ' + id } });
        }
        seen.add(id);
        const model = await ModelsModel.findById(id).lean();
        if (!model) {
          return res.status(400).json({
            error: { message: 'Model ' + id + ' not found' },
          });
        }
      }

      await applyFallbackChain(FallbackConfigModel, newChain);
      res.json({ success: true });
    } catch (error) {
      console.error('[fallback.put] failed:', error.message);
      res.status(500).json({ error: { message: 'Failed to update fallback chain' } });
    }
  });

  const SORT_PRESETS = {
    intelligence: { intelligenceRank: 1 },
    speed: { speedRank: 1 },
    budget: {}
  };

  router.post('/sort/:preset', async (req, res) => {
    try {
      const preset = req.params.preset;
      const sort = SORT_PRESETS[preset];
      if (!sort) {
        return res.status(400).json({ error: { message: 'Unknown preset: ' + preset + '. Use: intelligence, speed, budget' } });
      }

      let models;
      if (preset === 'budget') {
        models = await ModelsModel.find({ deletedAt: null, enabled: true }).sort({ intelligenceRank: 1 }).lean();
        const budgetOrder = [
          { label: '~120M', value: 120000000 },
          { label: '~50-100M', value: 75000000 },
          { label: '~30M', value: 30000000 },
          { label: '~18-45M', value: 31500000 },
          { label: '~18M', value: 18000000 },
          { label: '~15M', value: 15000000 },
          { label: '~12M', value: 12000000 },
          { label: '~6M', value: 6000000 },
          { label: '~5-10M', value: 7500000 },
          { label: '~4M', value: 4000000 },
        ];

        const getBudgetNumericValue = (budgetString) => {
          const match = budgetString.match(/([\d.]+)([MK])?/);
          if (!match) return Infinity; // Mettre les budgets non reconnus à la fin
          const value = parseFloat(match[1]);
          const unit = match[2] ? (match[2] === 'M' ? 1000000 : 1000) : 1;
          return value * unit;
        };

        models.sort((a, b) => {
          const valA = getBudgetNumericValue(a.monthlyTokenBudget);
          const valB = getBudgetNumericValue(b.monthlyTokenBudget);
          return valA - valB;
        });
      } else {
        models = await ModelsModel.find({ deletedAt: null, enabled: true }).sort(sort).lean();
      }

      const chain = models.map((model) => ({
        modelDbId: model._id,
        enabled: true,
        label: model.displayName,
      }));

      await applyFallbackChain(FallbackConfigModel, chain);
      res.json({ success: true, preset });
    } catch (error) {
      console.error('[fallback.sort] failed:', error.message);
      res.status(500).json({ error: { message: 'Failed to sort fallback chain' } });
    }
  });

  router.get('/token-usage', async (req, res) => {
    const platforms = await ApiKeysModel.distinct('platform', { enabled: true, deletedAt: null });
    const platformSet = new Set(platforms);

    const models = await ModelsModel.find({ enabled: true, deletedAt: null }).sort({ intelligenceRank: 1 }).lean();

    const modelBudgets = models
      .filter(m => platformSet.has(m.platform))
      .map(m => ({
        displayName: m.displayName,
        platform: m.platform,
        budget: parseBudget(m.monthlyTokenBudget)
      }));

    const totalBudget = modelBudgets.reduce((s, m) => s + m.budget, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const requests = await RequestsModel.find({ createdAt: { $gte: startOfMonth } }).lean();
    let totalUsed = 0;
    for (const r of requests) {
      totalUsed += (r.inputTokens || 0) + (r.outputTokens || 0);
    }

    res.json({
      totalBudget,
      totalUsed,
      models: modelBudgets
    });
  });

  return router;
}

module.exports = { createFallbackRouter };

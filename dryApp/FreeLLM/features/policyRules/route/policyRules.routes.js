const express = require('express');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');

function createPolicyRulesRouter(PolicyRulesModel) {
  const router = express.Router();
  router.use(protect);

  // GET /api/policies — List all rules
  router.get('/', async (req, res) => {
    try {
      const rules = await PolicyRulesModel.find({ deletedAt: null })
        .sort({ priority: 1 })
        .lean();
      res.json(rules);
    } catch (err) {
      res.status(500).json({ error: { message: 'Failed to fetch policy rules' } });
    }
  });

  // POST /api/policies — Create a rule
  router.post('/', async (req, res) => {
    try {
      const { name, description, severity, priority, trigger, action, enabled } = req.body;

      if (!name) {
        return res.status(400).json({ error: { message: 'name is required' } });
      }
      if (!action?.type) {
        return res.status(400).json({ error: { message: 'action.type is required' } });
      }

      const rule = new PolicyRulesModel({
        name,
        description: description || '',
        severity: severity || 'warning',
        priority: priority ?? 100,
        trigger: trigger || {},
        action,
        enabled: enabled !== false,
        createdBy: req.user._id,
      });

      await rule.save();
      res.status(201).json(rule);
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  // PATCH /api/policies/:id — Update a rule
  router.patch('/:id', async (req, res) => {
    try {
      const { name, description, severity, priority, trigger, action, enabled } = req.body;
      const update = {};
      if (name !== undefined) update.name = name;
      if (description !== undefined) update.description = description;
      if (severity !== undefined) update.severity = severity;
      if (priority !== undefined) update.priority = priority;
      if (trigger !== undefined) update.trigger = trigger;
      if (action !== undefined) update.action = action;
      if (enabled !== undefined) update.enabled = enabled;

      const rule = await PolicyRulesModel.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true }
      );

      if (!rule) {
        return res.status(404).json({ error: { message: 'Rule not found' } });
      }
      res.json(rule);
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  // DELETE /api/policies/:id — Soft delete
  router.delete('/:id', async (req, res) => {
    try {
      const rule = await PolicyRulesModel.findByIdAndUpdate(
        req.params.id,
        { $set: { deletedAt: new Date() } },
        { new: true }
      );
      if (!rule) {
        return res.status(404).json({ error: { message: 'Rule not found' } });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  // POST /api/policies/:id/toggle — Toggle enabled/disabled
  router.post('/:id/toggle', async (req, res) => {
    try {
      const rule = await PolicyRulesModel.findById(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: { message: 'Rule not found' } });
      }
      rule.enabled = !rule.enabled;
      await rule.save();
      res.json({ id: rule._id, enabled: rule.enabled });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  // POST /api/policies/seed — Seed default rules
  router.post('/seed', async (req, res) => {
    try {
      const count = await PolicyRulesModel.countDocuments({ deletedAt: null });
      if (count > 0) {
        return res.json({ message: 'Rules already seeded', count });
      }

      const defaults = [
        {
          name: 'Block high error rate providers',
          description: 'Automatically block providers with > 50% error rate',
          severity: 'block',
          priority: 10,
          trigger: { minErrorRate: 0.5 },
          action: { type: 'block', message: 'Provider error rate too high' },
        },
        {
          name: 'Deprioritize slow providers',
          description: 'Lower priority for providers with > 5s avg latency',
          severity: 'deprioritize',
          priority: 20,
          trigger: { minLatencyMs: 5000 },
          action: { type: 'deprioritize', penalty: 30 },
        },
        {
          name: 'Prefer fast providers for IDE mode',
          description: 'Boost Groq and Cerebras when in IDE mode',
          severity: 'prefer',
          priority: 30,
          trigger: { taskType: 'code' },
          action: { type: 'prefer', message: 'IDE mode: prefer fast providers' },
        },
        {
          name: 'Log quota warnings',
          description: 'Log when any provider quota exceeds 80%',
          severity: 'info',
          priority: 50,
          trigger: { maxQuotaPercent: 80 },
          action: { type: 'log', message: 'Provider quota above 80%' },
        },
      ];

      const docs = defaults.map(d => ({
        ...d,
        createdBy: req.user._id,
      }));

      await PolicyRulesModel.insertMany(docs);
      res.status(201).json({ success: true, count: docs.length });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  return router;
}

module.exports = { createPolicyRulesRouter };

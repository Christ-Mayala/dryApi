const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const PolicyRulesSchema = require('../model/policyRules.schema');

// ─── Setup model via middleware ────────────────────────────────
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('PolicyRules', PolicyRulesSchema);
  next();
};

// ─── GET / — List all rules ───────────────────────────────────
router.get('/', protect, setupModel, async (req, res) => {
  try {
    const rules = await req.targetModel.find({ deletedAt: null })
      .sort({ priority: 1 })
      .lean();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: { message: 'Failed to fetch policy rules' } });
  }
});

// ─── GET /:id — Get one rule ──────────────────────────────────
router.get('/:id', protect, setupModel, async (req, res) => {
  try {
    const rule = await req.targetModel.findById(req.params.id).lean();
    if (!rule) return res.status(404).json({ error: { message: 'Rule not found' } });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── POST / — Create a rule ───────────────────────────────────
router.post('/', protect, setupModel, async (req, res) => {
  try {
    const { name, description, condition, action, priority, enabled } = req.body;
    if (!name) return res.status(400).json({ error: { message: 'name is required' } });

    const rule = await req.targetModel.create({
      name,
      description: description || '',
      condition: condition || {},
      action: action || {},
      priority: priority || 5,
      enabled: enabled !== false,
      createdBy: req.user._id,
    });

    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── PUT /:id — Update a rule ─────────────────────────────────
router.put('/:id', protect, setupModel, async (req, res) => {
  try {
    const rule = await req.targetModel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    ).lean();
    if (!rule) return res.status(404).json({ error: { message: 'Rule not found' } });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── DELETE /:id — Soft delete ────────────────────────────────
router.delete('/:id', protect, setupModel, async (req, res) => {
  try {
    const rule = await req.targetModel.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true }
    );
    if (!rule) return res.status(404).json({ error: { message: 'Rule not found' } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── POST /seed — Seed demo rules ─────────────────────────────
router.post('/seed', protect, setupModel, async (req, res) => {
  try {
    const existing = await req.targetModel.countDocuments({ deletedAt: null });
    if (existing > 0) {
      return res.json({ message: 'Rules already seeded', count: existing });
    }

    const demoRules = [
      { name: 'Block expensive models for free users', condition: { plan: 'free', maxCost: 0.01 }, action: { fallback: true }, priority: 1 },
      { name: 'Prioritize coding models for code tasks', condition: { taskType: 'code' }, action: { preferCapabilities: ['coding'] }, priority: 2 },
      { name: 'Disable rate-limited providers', condition: { providerErrorRate: 0.5 }, action: { disable: true }, priority: 3 },
    ];

    await req.targetModel.insertMany(demoRules.map(r => ({
      ...r, enabled: true, createdBy: req.user._id,
    })));

    res.status(201).json({ success: true, count: demoRules.length });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;

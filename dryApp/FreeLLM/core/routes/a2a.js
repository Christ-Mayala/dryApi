/**
 * A2A Routes — API endpoints pour agent-to-agent routing.
 *
 * GET    /api/a2a/status         — Statut global A2A
 * POST   /api/a2a/agents         — Enregistrer un agent
 * DELETE /api/a2a/agents/:id     — Supprimer un agent
 * GET    /api/a2a/agents         — Liste des agents
 * GET    /api/a2a/agents/:id     — Détail d'un agent
 * PATCH  /api/a2a/agents/:id     — Mettre à jour un agent
 * POST   /api/a2a/route          — Router un message
 * POST   /api/a2a/delegate       — Déléguer une tâche
 * POST   /api/a2a/notify         — Envoyer une notification
 * GET    /api/a2a/messages       — Historique des messages
 * POST   /api/a2a/policies       — Ajouter une policy
 * GET    /api/a2a/policies       — Liste des policies
 */

const express = require('express');
const { a2aRouter, RoutingStrategy } = require('../services/a2aRouter.js');

function createA2ARoutes() {
  const router = express.Router();

  // ─── GET /a2a/status ────────────────────────────────────
  router.get('/status', (req, res) => {
    res.json(a2aRouter.getStatus());
  });

  // ─── GET /a2a/agents ────────────────────────────────────
  router.get('/agents', (req, res) => {
    res.json({ object: 'list', data: a2aRouter.getAgents() });
  });

  // ─── GET /a2a/agents/:id ────────────────────────────────
  router.get('/agents/:id', (req, res) => {
    const agent = a2aRouter.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: { message: 'Agent not found', type: 'not_found' } });
    res.json(agent);
  });

  // ─── POST /a2a/agents ───────────────────────────────────
  router.post('/agents', (req, res) => {
    const { name, description, capabilities, priority, maxConcurrent, endpoint, metadata } = req.body;
    if (!name) return res.status(400).json({ error: { message: "'name' is required", type: 'invalid_request_error' } });

    const agent = a2aRouter.registerAgent({
      name, description, capabilities, priority, maxConcurrent, endpoint, metadata,
    });
    res.status(201).json(agent.toJSON());
  });

  // ─── DELETE /a2a/agents/:id ─────────────────────────────
  router.delete('/agents/:id', (req, res) => {
    const removed = a2aRouter.unregisterAgent(req.params.id);
    if (!removed) return res.status(404).json({ error: { message: 'Agent not found', type: 'not_found' } });
    res.json({ success: true });
  });

  // ─── PATCH /a2a/agents/:id ──────────────────────────────
  router.patch('/agents/:id', (req, res) => {
    const { status, capabilities, priority, maxConcurrent } = req.body;
    const agent = a2aRouter.agents.get(req.params.id);
    if (!agent) return res.status(404).json({ error: { message: 'Agent not found', type: 'not_found' } });

    if (status) agent.status = status;
    if (capabilities) agent.capabilities = capabilities;
    if (priority !== undefined) agent.priority = priority;
    if (maxConcurrent !== undefined) agent.maxConcurrent = maxConcurrent;

    res.json(agent.toJSON());
  });

  // ─── POST /a2a/route ────────────────────────────────────
  router.post('/route', (req, res) => {
    const { message, strategy, targetAgentId } = req.body;
    if (!message) return res.status(400).json({ error: { message: "'message' is required", type: 'invalid_request_error' } });

    const result = a2aRouter.route(message, { strategy, targetAgentId });
    res.json(result);
  });

  // ─── POST /a2a/delegate ─────────────────────────────────
  router.post('/delegate', async (req, res) => {
    const { fromAgentId, task, requiredCapabilities, strategy, targetAgentId, priority } = req.body;
    if (!fromAgentId || !task) {
      return res.status(400).json({ error: { message: "'fromAgentId' and 'task' are required", type: 'invalid_request_error' } });
    }

    const result = await a2aRouter.delegate(fromAgentId, task, {
      requiredCapabilities, strategy, targetAgentId, priority,
    });
    res.json(result);
  });

  // ─── POST /a2a/notify ───────────────────────────────────
  router.post('/notify', (req, res) => {
    const { fromAgentId, toAgentId, payload } = req.body;
    if (!fromAgentId || !toAgentId) {
      return res.status(400).json({ error: { message: "'fromAgentId' and 'toAgentId' are required", type: 'invalid_request_error' } });
    }
    const result = a2aRouter.notify(fromAgentId, toAgentId, payload);
    res.json(result);
  });

  // ─── GET /a2a/messages ──────────────────────────────────
  router.get('/messages', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ object: 'list', data: a2aRouter.getMessages(limit) });
  });

  // ─── POST /a2a/policies ─────────────────────────────────
  router.post('/policies', (req, res) => {
    const { name, condition, action, enabled, priority } = req.body;
    if (!name) return res.status(400).json({ error: { message: "'name' is required", type: 'invalid_request_error' } });

    // condition and action should be function names or expressions
    // In production, these would be validated and sandboxed
    a2aRouter.addPolicy({
      name, condition: condition || null, action: action || null, enabled, priority,
    });
    res.status(201).json({ success: true, policyCount: a2aRouter.policies.length });
  });

  // ─── GET /a2a/policies ──────────────────────────────────
  router.get('/policies', (req, res) => {
    res.json({ object: 'list', data: a2aRouter.getActivePolicies() });
  });

  return router;
}

module.exports = { createA2ARoutes };

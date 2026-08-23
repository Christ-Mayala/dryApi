/**
 * MCP Routes — API endpoints pour gérer les serveurs MCP.
 *
 * GET    /mcp/servers          — Liste des serveurs
 * POST   /mcp/servers          — Ajouter un serveur
 * DELETE /mcp/servers/:id      — Supprimer un serveur
 * POST   /mcp/servers/:id/connect  — Connecter un serveur
 * POST   /mcp/servers/:id/disconnect — Déconnecter
 * POST   /mcp/servers/:id/tools    — Enregistrer des outils
 * GET    /mcp/tools            — Tous les outils MCP disponibles
 * POST   /mcp/tools/:name/call — Appeler un outil MCP
 * GET    /mcp/audit            — Audit log
 * GET    /mcp/status           — Statut global
 */

const express = require('express');
const { mcpClient } = require('../services/mcpClient.js');
const { addTool, isToolAvailable } = require('../services/toolRuntime.js');

function createMCPRoutes() {
  const router = express.Router();

  // ─── GET /mcp/status ────────────────────────────────────
  router.get('/status', (req, res) => {
    res.json(mcpClient.getStatus());
  });

  // ─── GET /mcp/servers ───────────────────────────────────
  router.get('/servers', (req, res) => {
    const servers = Array.from(mcpClient.servers.values()).map(s => s.toJSON());
    res.json({ object: 'list', data: servers });
  });

  // ─── POST /mcp/servers ──────────────────────────────────
  router.post('/servers', (req, res) => {
    const { name, transport, url, command, args, env, timeout, toolPermissions, defaultPermission, requestsPerMinute } = req.body;

    if (!name) {
      return res.status(400).json({ error: { message: "'name' is required", type: 'invalid_request_error' } });
    }

    try {
      const server = mcpClient.addServer({
        name, transport, url, command, args, env, timeout,
        toolPermissions, defaultPermission, requestsPerMinute,
      });
      res.status(201).json(server.toJSON());
    } catch (err) {
      res.status(500).json({ error: { message: err.message, type: 'server_error' } });
    }
  });

  // ─── DELETE /mcp/servers/:id ────────────────────────────
  router.delete('/servers/:id', (req, res) => {
    const removed = mcpClient.removeServer(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: { message: 'Server not found', type: 'not_found' } });
    }
    res.json({ success: true });
  });

  // ─── POST /mcp/servers/:id/connect ──────────────────────
  router.post('/servers/:id/connect', async (req, res) => {
    try {
      const result = await mcpClient.connectServer(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: { message: err.message, type: 'server_error' } });
    }
  });

  // ─── POST /mcp/servers/:id/disconnect ───────────────────
  router.post('/servers/:id/disconnect', (req, res) => {
    mcpClient.disconnectServer(req.params.id);
    res.json({ success: true });
  });

  // ─── POST /mcp/servers/:id/tools ────────────────────────
  router.post('/servers/:id/tools', (req, res) => {
    const { tools } = req.body;
    if (!Array.isArray(tools)) {
      return res.status(400).json({ error: { message: "'tools' must be an array", type: 'invalid_request_error' } });
    }
    try {
      mcpClient.registerTools(req.params.id, tools);

      // Also register in Tool Runtime for global availability
      for (const tool of tools) {
        if (!isToolAvailable(tool.name)) {
          addTool(tool.name);
        }
      }

      res.json({ success: true, registered: tools.length });
    } catch (err) {
      res.status(500).json({ error: { message: err.message, type: 'server_error' } });
    }
  });

  // ─── GET /mcp/tools ─────────────────────────────────────
  router.get('/tools', (req, res) => {
    const tools = mcpClient.getToolsAsOpenAIFormat();
    res.json({ object: 'list', data: tools, total: tools.length });
  });

  // ─── POST /mcp/tools/:name/call ─────────────────────────
  router.post('/tools/:name/call', async (req, res) => {
    const { args, timeout } = req.body;
    const startTime = Date.now();

    const result = await mcpClient.callTool(req.params.name, args || {}, { timeout });

    res.json({
      ...result,
      tool: req.params.name,
      latencyMs: Date.now() - startTime,
    });
  });

  // ─── GET /mcp/audit ─────────────────────────────────────
  router.get('/audit', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const audit = mcpClient.getAuditLog(limit);
    res.json({ object: 'list', data: audit, total: audit.length });
  });

  return router;
}

module.exports = { createMCPRoutes };

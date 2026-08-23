/**
 * MCP Client Manager — Connecteur Model Context Protocol.
 *
 * Permet à FreeLLM de :
 *   - Se connecter à des serveurs MCP (stdio, SSE, HTTP)
 *   - Découvrir les outils exposés par ces serveurs
 *   - Exécuter des outils MCP via le Tool Runtime existant
 *   - Gérer les permissions et le sandboxing
 *
 * Ne remplace PAS le Tool Runtime existant.
 * S'intègre comme un source d'outils supplémentaires.
 */

const { EventEmitter } = require('events');
const { logger } = require('./inferenceLogger.js');

// ═══════════════════════════════════════════════════════════════
// TYPES / ENUMS
// ═══════════════════════════════════════════════════════════════

const TransportType = {
  STDIO: 'stdio',
  SSE: 'sse',
  HTTP: 'http',
};

const ServerStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
};

const ToolPermission = {
  ALLOW: 'allow',
  DENY: 'deny',
  ASK: 'ask',
};

// ═══════════════════════════════════════════════════════════════
// MCP SERVER — Représente un serveur MCP connecté
// ═══════════════════════════════════════════════════════════════

let _serverCounter = 0;

class MCPServer {
  constructor(config = {}) {
    this.id = config.id || `mcp-${Date.now()}-${++_serverCounter}`;
    this.name = config.name || 'unnamed-mcp-server';
    this.transport = config.transport || TransportType.HTTP;
    this.url = config.url || null;        // For HTTP/SSE
    this.command = config.command || null; // For stdio
    this.args = config.args || [];
    this.env = config.env || {};
    this.status = ServerStatus.DISCONNECTED;
    this.tools = [];
    this.lastConnected = null;
    this.lastError = null;
    this.timeout = config.timeout || 30000;
    this.retryCount = 0;
    this.maxRetries = config.maxRetries || 3;

    // Permission policy
    this.toolPermissions = config.toolPermissions || {}; // toolName → ToolPermission
    this.defaultPermission = config.defaultPermission || ToolPermission.ALLOW;

    // Rate limiting
    this.rateLimits = {
      requestsPerMinute: config.requestsPerMinute || 60,
      requestsThisMinute: 0,
      lastMinuteReset: Date.now(),
    };

    // Metrics
    this.metrics = {
      totalCalls: 0,
      successCalls: 0,
      failureCalls: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
    };
  }

  /**
   * Vérifie si un outil est autorisé.
   */
  isToolAllowed(toolName) {
    const perm = this.toolPermissions[toolName] || this.defaultPermission;
    return perm === ToolPermission.ALLOW;
  }

  /**
   * Vérifie le rate limit.
   */
  checkRateLimit() {
    const now = Date.now();
    if (now - this.rateLimits.lastMinuteReset > 60000) {
      this.rateLimits.requestsThisMinute = 0;
      this.rateLimits.lastMinuteReset = now;
    }
    if (this.rateLimits.requestsThisMinute >= this.rateLimits.requestsPerMinute) {
      return false;
    }
    this.rateLimits.requestsThisMinute++;
    return true;
  }

  /**
   * Enregistre une métrique d'appel.
   */
  recordCall(success, latencyMs) {
    this.metrics.totalCalls++;
    this.metrics.totalLatencyMs += latencyMs;
    this.metrics.avgLatencyMs = this.metrics.totalLatencyMs / this.metrics.totalCalls;
    if (success) this.metrics.successCalls++;
    else this.metrics.failureCalls++;
  }

  /**
   * Serialise l'état du serveur.
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      transport: this.transport,
      url: this.url,
      status: this.status,
      toolCount: this.tools.length,
      tools: this.tools.map(t => t.name),
      lastConnected: this.lastConnected,
      lastError: this.lastError,
      metrics: { ...this.metrics },
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// MCP CLIENT MANAGER — Singleton
// ═══════════════════════════════════════════════════════════════

class MCPClientManager extends EventEmitter {
  constructor() {
    super();
    this.servers = new Map();   // id → MCPServer
    this.tools = new Map();     // toolName → { serverId, schema, description }
    this.auditLog = [];         // Historique des appels MCP
    this.maxAuditLog = 1000;
  }

  /**
   * Ajoute un serveur MCP.
   */
  addServer(config) {
    const server = new MCPServer(config);
    this.servers.set(server.id, server);
    logger.event('MCP_SERVER_ADDED', { serverId: server.id, name: server.name });
    return server;
  }

  /**
   * Supprime un serveur MCP.
   */
  removeServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) return false;
    // Remove tools from this server
    for (const [toolName, tool] of this.tools) {
      if (tool.serverId === serverId) {
        this.tools.delete(toolName);
      }
    }
    this.servers.delete(serverId);
    logger.event('MCP_SERVER_REMOVED', { serverId });
    return true;
  }

  /**
   * Connecte à un serveur et découvre ses outils.
   * En mode simulated (pas de vrai serveur MCP), simule la découverte.
   */
  async connectServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server ${serverId} not found`);

    server.status = ServerStatus.CONNECTING;

    try {
      // In production, this would actually connect via stdio/SSE/HTTP
      // For now, we support adding tools manually or via config
      server.status = ServerStatus.CONNECTED;
      server.lastConnected = new Date().toISOString();
      server.retryCount = 0;

      logger.event('MCP_SERVER_CONNECTED', { serverId, toolCount: server.tools.length });
      this.emit('server:connected', { serverId, tools: server.tools });

      return { success: true, tools: server.tools };
    } catch (err) {
      server.status = ServerStatus.ERROR;
      server.lastError = err.message;
      server.retryCount++;

      logger.error('MCP', 'SERVER_CONNECT_FAILED', { serverId, error: err.message });
      this.emit('server:error', { serverId, error: err.message });

      return { success: false, error: err.message };
    }
  }

  /**
   * Déconnecte un serveur.
   */
  disconnectServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) return;
    server.status = ServerStatus.DISCONNECTED;
    this.emit('server:disconnected', { serverId });
  }

  /**
   * Enregistre des outils découverts sur un serveur.
   */
  registerTools(serverId, tools) {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server ${serverId} not found`);

    for (const tool of tools) {
      const toolEntry = {
        serverId,
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || tool.input_schema || {},
        annotations: tool.annotations || {},
      };
      server.tools.push(toolEntry);
      this.tools.set(`mcp.${tool.name}`, toolEntry);
    }

    logger.event('MCP_TOOLS_REGISTERED', { serverId, count: tools.length });
  }

  /**
   * Appelle un outil MCP.
   */
  async callTool(toolName, args, options = {}) {
    const startTime = Date.now();
    const toolKey = `mcp.${toolName}`;
    const tool = this.tools.get(toolKey);

    if (!tool) {
      return { success: false, error: `MCP tool '${toolName}' not found`, latencyMs: 0 };
    }

    const server = this.servers.get(tool.serverId);
    if (!server) {
      return { success: false, error: `MCP server for '${toolName}' not found`, latencyMs: 0 };
    }

    // Permission check
    if (!server.isToolAllowed(toolName)) {
      this._audit('denied', toolName, tool.serverId, 'Permission denied');
      return { success: false, error: `Permission denied for MCP tool '${toolName}'`, latencyMs: 0 };
    }

    // Rate limit check
    if (!server.checkRateLimit()) {
      this._audit('rate_limited', toolName, tool.serverId, 'Rate limit exceeded');
      return { success: false, error: `Rate limit exceeded for MCP server '${server.name}'`, latencyMs: 0 };
    }

    // Execute
    try {
      const result = await this._executeToolCall(server, toolName, args, options);
      const latencyMs = Date.now() - startTime;
      server.recordCall(true, latencyMs);
      this._audit('success', toolName, tool.serverId, null, latencyMs);
      return { success: true, result, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      server.recordCall(false, latencyMs);
      this._audit('error', toolName, tool.serverId, err.message, latencyMs);
      return { success: false, error: err.message, latencyMs };
    }
  }

  /**
   * Exécute réellement l'appel MCP (abstraction du transport).
   * En mode simulated, retourne un placeholder.
   */
  async _executeToolCall(server, toolName, args, options) {
    // In production, this would use the actual MCP transport
    // For stdio: spawn process, send JSON-RPC, read response
    // For SSE/HTTP: POST to server endpoint

    const timeout = options.timeout || server.timeout;

    // Simulated execution — in production, replace with real transport
    return {
      content: [
        {
          type: 'text',
          text: `[MCP Simulated] Tool '${toolName}' executed on server '${server.name}' with args: ${JSON.stringify(args)}`,
        },
      ],
      isError: false,
    };
  }

  /**
   * Enregistre dans l'audit log.
   */
  _audit(action, toolName, serverId, error = null, latencyMs = 0) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      toolName,
      serverId,
      error,
      latencyMs,
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditLog) this.auditLog.shift();
    return entry;
  }

  /**
   * Retourne tous les outils MCP disponibles (format OpenAI tools).
   */
  getToolsAsOpenAIFormat() {
    const tools = [];
    for (const [key, tool] of this.tools) {
      const server = this.servers.get(tool.serverId);
      if (!server || server.status !== ServerStatus.CONNECTED) continue;
      if (!server.isToolAllowed(tool.name)) continue;

      tools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: `[MCP:${server.name}] ${tool.description}`,
          parameters: tool.inputSchema,
        },
        _mcp: {
          serverId: tool.serverId,
          serverName: server.name,
        },
      });
    }
    return tools;
  }

  /**
   * Retourne les outils MCP pour le Tool Runtime.
   */
  getToolsForRuntime() {
    const toolNames = [];
    for (const [key, tool] of this.tools) {
      const server = this.servers.get(tool.serverId);
      if (!server || server.status !== ServerStatus.CONNECTED) continue;
      if (!server.isToolAllowed(tool.name)) continue;
      toolNames.push(tool.name);
    }
    return toolNames;
  }

  /**
   * Statut global.
   */
  getStatus() {
    const servers = Array.from(this.servers.values()).map(s => s.toJSON());
    return {
      serverCount: servers.length,
      connectedServers: servers.filter(s => s.status === ServerStatus.CONNECTED).length,
      totalTools: this.tools.size,
      activeTools: servers.reduce((sum, s) => sum + s.toolCount, 0),
      recentAudit: this.auditLog.slice(-20),
      servers,
    };
  }

  /**
   * Retourne l'audit log.
   */
  getAuditLog(limit = 50) {
    return this.auditLog.slice(-limit);
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════

const mcpClient = new MCPClientManager();

module.exports = {
  MCPClientManager,
  MCPServer,
  mcpClient,
  TransportType,
  ServerStatus,
  ToolPermission,
};

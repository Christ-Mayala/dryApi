/**
 * A2A Agent Router — Agent-to-Agent communication layer.
 *
 * Permet aux agents FreeLLM de :
 *   - S'identifier et s'enregistrer
 *   - Découvrir d'autres agents
 *   - Envoyer des requêtes inter-agents
 *   - Définir des policies de communication
 *   - Tracer les interactions A2A
 *
 * Architecture :
 *   Agent A → A2A Router → Agent Router → Agent B
 *
 * Ne remplace PAS le Tool Runtime.
 * S'ajoute comme couche d'orchestration entre agents.
 */

const { EventEmitter } = require('events');
const { logger } = require('./inferenceLogger.js');

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

const AgentStatus = {
  OFFLINE: 'offline',
  IDLE: 'idle',
  BUSY: 'busy',
  ERROR: 'error',
};

const MessageType = {
  REQUEST: 'request',
  RESPONSE: 'response',
  DELEGATION: 'delegation',
  NOTIFICATION: 'notification',
  HEARTBEAT: 'heartbeat',
};

const RoutingStrategy = {
  DIRECT: 'direct',           // Send to specific agent
  LOAD_BALANCE: 'load_balance', // Round-robin across capable agents
  CAPABILITY: 'capability',   // Route based on required capabilities
  LEAST_BUSY: 'least_busy',   // Route to least loaded agent
  PRIORITY: 'priority',       // Route by agent priority
};

// ═══════════════════════════════════════════════════════════════
// AGENT — Represents a registered agent
// ═══════════════════════════════════════════════════════════════

class Agent {
  constructor(config = {}) {
    this.id = config.id || `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.name = config.name || 'unnamed-agent';
    this.description = config.description || '';
    this.capabilities = config.capabilities || []; // e.g. ['coding', 'research', 'planning']
    this.status = AgentStatus.IDLE;
    this.priority = config.priority || 5; // 1 = highest, 10 = lowest
    this.maxConcurrent = config.maxConcurrent || 1;
    this.activeRequests = 0;
    this.totalRequests = 0;
    this.successRequests = 0;
    this.failureRequests = 0;
    this.totalLatencyMs = 0;
    this.avgLatencyMs = 0;
    this.lastHeartbeat = null;
    this.lastActivity = null;
    this.endpoint = config.endpoint || null; // URL or function reference
    this.metadata = config.metadata || {};
  }

  isAvailable() {
    return this.status !== AgentStatus.OFFLINE &&
           this.status !== AgentStatus.ERROR &&
           this.activeRequests < this.maxConcurrent;
  }

  hasCapability(cap) {
    return this.capabilities.includes(cap);
  }

  startRequest() {
    this.activeRequests++;
    this.totalRequests++;
    this.status = AgentStatus.BUSY;
    this.lastActivity = new Date().toISOString();
  }

  endRequest(success, latencyMs) {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (success) this.successRequests++;
    else this.failureRequests++;
    this.totalLatencyMs += latencyMs;
    this.avgLatencyMs = this.totalLatencyMs / this.totalRequests;
    this.status = this.activeRequests > 0 ? AgentStatus.IDLE : AgentStatus.IDLE;
    this.lastActivity = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      capabilities: this.capabilities,
      status: this.status,
      priority: this.priority,
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent,
      totalRequests: this.totalRequests,
      successRate: this.totalRequests > 0
        ? ((this.successRequests / this.totalRequests) * 100).toFixed(1) + '%'
        : 'N/A',
      avgLatencyMs: Math.round(this.avgLatencyMs),
      lastActivity: this.lastActivity,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// A2A ROUTER — Central routing between agents
// ═══════════════════════════════════════════════════════════════

class A2ARouter extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();       // id → Agent
    this.messages = [];            // Message history
    this.maxMessages = 1000;
    this.policies = [];            // Routing policies
    this.metrics = {
      totalRouted: 0,
      totalDelegated: 0,
      totalNotifications: 0,
      avgRoutingTimeMs: 0,
      routingTimeTotal: 0,
    };
  }

  /**
   * Register an agent.
   */
  registerAgent(config) {
    const agent = new Agent(config);
    this.agents.set(agent.id, agent);
    logger.event('A2A_AGENT_REGISTERED', { agentId: agent.id, name: agent.name, capabilities: agent.capabilities });
    this.emit('agent:registered', { agentId: agent.id });
    return agent;
  }

  /**
   * Unregister an agent.
   */
  unregisterAgent(agentId) {
    const removed = this.agents.delete(agentId);
    if (removed) {
      logger.event('A2A_AGENT_UNREGISTERED', { agentId });
      this.emit('agent:unregistered', { agentId });
    }
    return removed;
  }

  /**
   * Update agent status.
   */
  updateAgentStatus(agentId, status) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.status = status;
    agent.lastHeartbeat = new Date().toISOString();
    return true;
  }

  /**
   * Find agents with required capabilities.
   */
  findCapableAgents(requiredCapabilities, options = {}) {
    const candidates = [];
    for (const [, agent] of this.agents) {
      if (!agent.isAvailable()) continue;
      if (!options.includeOffline && agent.status === AgentStatus.OFFLINE) continue;

      const hasAllCaps = requiredCapabilities.every(cap => agent.hasCapability(cap));
      if (hasAllCaps) candidates.push(agent);
    }

    // Sort by priority (lower = better) then by load
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.activeRequests - b.activeRequests;
    });

    return candidates;
  }

  /**
   * Route a message to the best agent.
   */
  route(message, options = {}) {
    const startTime = Date.now();
    const strategy = options.strategy || RoutingStrategy.CAPABILITY;
    const targetAgentId = options.targetAgentId;

    // Direct routing
    if (strategy === RoutingStrategy.DIRECT || targetAgentId) {
      const agentId = targetAgentId || message.to;
      const agent = this.agents.get(agentId);
      if (!agent) {
        return { success: false, error: `Agent '${agentId}' not found`, routedTo: null };
      }
      if (!agent.isAvailable()) {
        return { success: false, error: `Agent '${agentId}' is not available (status: ${agent.status})`, routedTo: null };
      }
      this._recordMessage(message, agent.id);
      return { success: true, agent: agent.toJSON(), routedTo: agent.id, strategy: 'direct' };
    }

    // Capability-based routing
    if (strategy === RoutingStrategy.CAPABILITY) {
      const requiredCaps = message.requiredCapabilities || [];
      const candidates = this.findCapableAgents(requiredCaps);
      if (candidates.length === 0) {
        return { success: false, error: `No agents available with capabilities: ${requiredCaps.join(', ')}`, routedTo: null };
      }
      const selected = candidates[0];
      this._recordMessage(message, selected.id);
      return { success: true, agent: selected.toJSON(), routedTo: selected.id, strategy: 'capability', alternatives: candidates.length - 1 };
    }

    // Load balance
    if (strategy === RoutingStrategy.LOAD_BALANCE) {
      const available = Array.from(this.agents.values()).filter(a => a.isAvailable());
      if (available.length === 0) {
        return { success: false, error: 'No agents available', routedTo: null };
      }
      // Round-robin by lowest total requests
      available.sort((a, b) => a.totalRequests - b.totalRequests);
      const selected = available[0];
      this._recordMessage(message, selected.id);
      return { success: true, agent: selected.toJSON(), routedTo: selected.id, strategy: 'load_balance' };
    }

    // Least busy
    if (strategy === RoutingStrategy.LEAST_BUSY) {
      const available = Array.from(this.agents.values()).filter(a => a.isAvailable());
      if (available.length === 0) {
        return { success: false, error: 'No agents available', routedTo: null };
      }
      available.sort((a, b) => a.activeRequests - b.activeRequests);
      const selected = available[0];
      this._recordMessage(message, selected.id);
      return { success: true, agent: selected.toJSON(), routedTo: selected.id, strategy: 'least_busy' };
    }

    return { success: false, error: `Unknown strategy: ${strategy}`, routedTo: null };
  }

  /**
   * Execute a delegation: Agent A delegates work to Agent B.
   */
  async delegate(fromAgentId, task, options = {}) {
    const startTime = Date.now();
    const fromAgent = this.agents.get(fromAgentId);

    const message = {
      type: MessageType.DELEGATION,
      from: fromAgentId,
      task,
      requiredCapabilities: options.requiredCapabilities || [],
      priority: options.priority || 5,
      timestamp: new Date().toISOString(),
    };

    const routing = this.route(message, {
      strategy: options.strategy || RoutingStrategy.CAPABILITY,
      targetAgentId: options.targetAgentId,
    });

    if (!routing.success) {
      return { success: false, error: routing.error, latencyMs: Date.now() - startTime };
    }

    const toAgent = this.agents.get(routing.routedTo);
    toAgent.startRequest();

    try {
      // In production, this would send the task to the agent's endpoint
      // For now, simulate execution
      const result = {
        content: `[A2A Delegation] Agent '${toAgent.name}' received task: ${typeof task === 'string' ? task : JSON.stringify(task).slice(0, 200)}`,
        agentId: toAgent.id,
        agentName: toAgent.name,
      };

      const latencyMs = Date.now() - startTime;
      toAgent.endRequest(true, latencyMs);
      if (fromAgent) fromAgent.endRequest(true, latencyMs);

      this.metrics.totalDelegated++;
      this._recordMessage(message, routing.routedTo, 'success', latencyMs);

      logger.event('A2A_DELEGATION_COMPLETE', {
        from: fromAgentId, to: routing.routedTo, latencyMs,
      });

      return { success: true, result, routedTo: routing.routedTo, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      toAgent.endRequest(false, latencyMs);
      if (fromAgent) fromAgent.endRequest(false, latencyMs);

      this._recordMessage(message, routing.routedTo, 'error', latencyMs);
      return { success: false, error: err.message, latencyMs };
    }
  }

  /**
   * Send a notification (fire-and-forget).
   */
  notify(fromAgentId, toAgentId, payload) {
    const agent = this.agents.get(toAgentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const message = {
      type: MessageType.NOTIFICATION,
      from: fromAgentId,
      to: toAgentId,
      payload,
      timestamp: new Date().toISOString(),
    };

    this._recordMessage(message, toAgentId);
    this.metrics.totalNotifications++;
    this.emit('notification', { from: fromAgentId, to: toAgentId, payload });
    return { success: true };
  }

  /**
   * Add a routing policy.
   */
  addPolicy(policy) {
    this.policies.push({
      id: `policy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: policy.name || 'unnamed',
      condition: policy.condition, // function(agent, message) → boolean
      action: policy.action,       // function(agent, message) → modified message
      enabled: policy.enabled !== false,
      priority: policy.priority || 5,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Record a message in history.
   */
  _recordMessage(message, routedTo, status = 'routed', latencyMs = 0) {
    const entry = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...message,
      routedTo,
      status,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
    this.messages.push(entry);
    if (this.messages.length > this.maxMessages) this.messages.shift();

    const routingTime = Date.now() - Date.parse(message.timestamp);
    this.metrics.totalRouted++;
    this.metrics.routingTimeTotal += routingTime;
    this.metrics.avgRoutingTimeMs = this.metrics.routingTimeTotal / this.metrics.totalRouted;
  }

  /**
   * Get all agents.
   */
  getAgents() {
    return Array.from(this.agents.values()).map(a => a.toJSON());
  }

  /**
   * Get agent by ID.
   */
  getAgent(agentId) {
    const agent = this.agents.get(agentId);
    return agent ? agent.toJSON() : null;
  }

  /**
   * Get message history.
   */
  getMessages(limit = 50) {
    return this.messages.slice(-limit);
  }

  /**
   * Get active policies.
   */
  getActivePolicies() {
    return this.policies.filter(p => p.enabled);
  }

  /**
   * Get global status.
   */
  getStatus() {
    const agents = this.getAgents();
    return {
      agentCount: agents.length,
      availableAgents: agents.filter(a => a.status !== 'offline' && a.status !== 'error').length,
      totalCapacity: agents.reduce((s, a) => s + a.maxConcurrent, 0),
      activeLoad: agents.reduce((s, a) => s + a.activeRequests, 0),
      metrics: { ...this.metrics },
      agents,
      policies: this.getActivePolicies().length,
      messageHistory: this.messages.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════

const a2aRouter = new A2ARouter();

module.exports = {
  A2ARouter,
  Agent,
  a2aRouter,
  AgentStatus,
  MessageType,
  RoutingStrategy,
};

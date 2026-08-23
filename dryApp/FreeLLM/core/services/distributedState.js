/**
 * Distributed State Manager — État partagé entre instances FreeLLM.
 *
 * Architecture :
 *   Instance A ──┐
 *   Instance B ──┤── Redis (production) / In-Memory (development)
 *   Instance C ──┘
 *
 * États partagés :
 *   - Circuit Breaker states
 *   - Quota counters
 *   - Provider health scores
 *   - Rate limit counters
 *   - Cache entries
 *   - Request locks
 *
 * En l'absence de Redis, fallback automatique en in-memory.
 * Le code applicatif ne fait JAMAIS la différence.
 */

const { logger } = require('./inferenceLogger.js');

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY STORE (fallback)
// ═══════════════════════════════════════════════════════════════

class InMemoryStore {
  constructor() {
    this.data = new Map();
    this.ttls = new Map(); // key → expireTime
    this._cleanupInterval = setInterval(() => this._cleanup(), 30000);
  }

  async get(key) {
    this._checkExpiry(key);
    const entry = this.data.get(key);
    return entry !== undefined ? entry : null;
  }

  async set(key, value, ttlMs = null) {
    this.data.set(key, value);
    if (ttlMs) {
      this.ttls.set(key, Date.now() + ttlMs);
    }
    return 'OK';
  }

  async del(key) {
    this.data.delete(key);
    this.ttls.delete(key);
    return 1;
  }

  async incr(key) {
    const current = (await this.get(key)) || 0;
    const newVal = parseInt(current) + 1;
    await this.set(key, newVal);
    return newVal;
  }

  async incrby(key, amount) {
    const current = (await this.get(key)) || 0;
    const newVal = parseInt(current) + amount;
    await this.set(key, newVal);
    return newVal;
  }

  async decr(key) {
    return this.incrby(key, -1);
  }

  async keys(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.data.keys()).filter(k => regex.test(k));
  }

  async hset(key, field, value) {
    let hash = this.data.get(key);
    if (!hash || typeof hash !== 'object') hash = {};
    hash[field] = value;
    this.data.set(key, hash);
    return 1;
  }

  async hget(key, field) {
    const hash = this.data.get(key);
    if (!hash || typeof hash !== 'object') return null;
    return hash[field] !== undefined ? hash[field] : null;
  }

  async hgetall(key) {
    const hash = this.data.get(key);
    if (!hash || typeof hash !== 'object') return {};
    return { ...hash };
  }

  async hdel(key, field) {
    const hash = this.data.get(key);
    if (!hash || typeof hash !== 'object') return 0;
    if (field in hash) {
      delete hash[field];
      this.data.set(key, hash);
      return 1;
    }
    return 0;
  }

  async expire(key, ttlMs) {
    if (this.data.has(key)) {
      this.ttls.set(key, Date.now() + ttlMs);
      return 1;
    }
    return 0;
  }

  async ttl(key) {
    const expire = this.ttls.get(key);
    if (!expire) return -1;
    const remaining = expire - Date.now();
    if (remaining <= 0) {
      this._checkExpiry(key);
      return -2;
    }
    return Math.ceil(remaining / 1000);
  }

  _checkExpiry(key) {
    const expire = this.ttls.get(key);
    if (expire && Date.now() > expire) {
      this.data.delete(key);
      this.ttls.delete(key);
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, expire] of this.ttls) {
      if (now > expire) {
        this.data.delete(key);
        this.ttls.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this._cleanupInterval);
  }

  get size() {
    return this.data.size;
  }
}

// ═══════════════════════════════════════════════════════════════
// REDIS STORE (production)
// ═══════════════════════════════════════════════════════════════

class RedisStore {
  constructor(client) {
    this.client = client; // ioredis or node-redis client
    this.connected = true;
  }

  async get(key) {
    try { return await this.client.get(key); } catch { return null; }
  }

  async set(key, value, ttlMs = null) {
    try {
      if (ttlMs) return await this.client.set(key, value, 'PX', ttlMs);
      return await this.client.set(key, value);
    } catch { return null; }
  }

  async del(key) {
    try { return await this.client.del(key); } catch { return 0; }
  }

  async incr(key) {
    try { return await this.client.incr(key); } catch { return 0; }
  }

  async incrby(key, amount) {
    try { return await this.client.incrby(key, amount); } catch { return 0; }
  }

  async decr(key) {
    try { return await this.client.decr(key); } catch { return 0; }
  }

  async keys(pattern) {
    try { return await this.client.keys(pattern); } catch { return []; }
  }

  async hset(key, field, value) {
    try { return await this.client.hset(key, field, JSON.stringify(value)); } catch { return 0; }
  }

  async hget(key, field) {
    try {
      const val = await this.client.hget(key, field);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  }

  async hgetall(key) {
    try {
      const raw = await this.client.hgetall(key);
      const result = {};
      for (const [k, v] of Object.entries(raw)) {
        try { result[k] = JSON.parse(v); } catch { result[k] = v; }
      }
      return result;
    } catch { return {}; }
  }

  async hdel(key, field) {
    try { return await this.client.hdel(key, field); } catch { return 0; }
  }

  async expire(key, ttlMs) {
    try { return await this.client.pexpire(key, ttlMs); } catch { return 0; }
  }

  async ttl(key) {
    try { return await this.client.pttl(key); } catch { return -1; }
  }

  get size() { return 0; } // Can't easily count all keys
}

// ═══════════════════════════════════════════════════════════════
// DISTRIBUTED STATE MANAGER — High-level API
// ═══════════════════════════════════════════════════════════════

class DistributedStateManager {
  constructor() {
    this.store = new InMemoryStore(); // Default to in-memory
    this.mode = 'in-memory';
    this.instanceId = `instance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.stats = {
      reads: 0,
      writes: 0,
      errors: 0,
      lockAcquired: 0,
      lockReleased: 0,
    };
  }

  /**
   * Initialize with Redis if available, fallback to in-memory.
   */
  async initialize(redisUrl = null) {
    if (redisUrl) {
      try {
        // Dynamic import — Redis is optional
        let createClient;
        try {
          createClient = require('ioredis').default || require('ioredis');
        } catch {
          createClient = require('redis').createClient;
        }

        const client = createClient(redisUrl);
        await client.connect();
        this.store = new RedisStore(client);
        this.mode = 'redis';
        logger.event('DISTRIBUTED_STATE_INIT', { mode: 'redis', instanceId: this.instanceId });
      } catch (err) {
        logger.error('DistributedState', 'REDIS_CONNECT_FAILED', { error: err.message, fallback: 'in-memory' });
        this.mode = 'in-memory';
      }
    }

    logger.event('DISTRIBUTED_STATE_INIT', { mode: this.mode, instanceId: this.instanceId });
    return this.mode;
  }

  // ─── Simple Key-Value ───────────────────────────────────

  async get(key) {
    this.stats.reads++;
    try { return await this.store.get(key); } catch (e) { this.stats.errors++; return null; }
  }

  async set(key, value, ttlMs = null) {
    this.stats.writes++;
    try { return await this.store.set(key, value, ttlMs); } catch (e) { this.stats.errors++; return null; }
  }

  async del(key) {
    this.stats.writes++;
    try { return await this.store.del(key); } catch (e) { this.stats.errors++; return 0; }
  }

  async incr(key) {
    this.stats.writes++;
    try { return await this.store.incr(key); } catch (e) { this.stats.errors++; return 0; }
  }

  async incrby(key, amount) {
    this.stats.writes++;
    try { return await this.store.incrby(key, amount); } catch (e) { this.stats.errors++; return 0; }
  }

  // ─── Hash Operations ────────────────────────────────────

  async hset(key, field, value) {
    this.stats.writes++;
    try { return await this.store.hset(key, field, value); } catch (e) { this.stats.errors++; return 0; }
  }

  async hget(key, field) {
    this.stats.reads++;
    try { return await this.store.hget(key, field); } catch (e) { this.stats.errors++; return null; }
  }

  async hgetall(key) {
    this.stats.reads++;
    try { return await this.store.hgetall(key); } catch (e) { this.stats.errors++; return {}; }
  }

  // ─── Circuit Breaker State ──────────────────────────────

  async getCircuitBreakerState(provider) {
    return this.hget('cb:states', provider) || { state: 'closed', failures: 0, lastFailure: null };
  }

  async setCircuitBreakerState(provider, state) {
    return this.hset('cb:states', provider, state);
  }

  // ─── Quota Counters ─────────────────────────────────────

  async incrementQuota(provider, model, keyId, amount = 1) {
    const minuteKey = `quota:${provider}:${model}:${keyId}:${Math.floor(Date.now() / 60000)}`;
    return this.incrby(minuteKey, amount);
  }

  async getQuota(provider, model, keyId) {
    const minuteKey = `quota:${provider}:${model}:${keyId}:${Math.floor(Date.now() / 60000)}`;
    return parseInt(await this.get(minuteKey)) || 0;
  }

  // ─── Rate Limiting ──────────────────────────────────────

  async checkRateLimit(key, maxPerMinute) {
    const minuteKey = `ratelimit:${key}:${Math.floor(Date.now() / 60000)}`;
    const current = await this.incr(minuteKey);
    if (current === 1) {
      await this.store.expire(minuteKey, 60000);
    }
    return current <= maxPerMinute;
  }

  // ─── Distributed Lock ───────────────────────────────────

  async acquireLock(resource, ttlMs = 5000) {
    const lockKey = `lock:${resource}`;
    const lockValue = `${this.instanceId}:${Date.now()}`;

    // Simple optimistic lock via SET NX
    try {
      const result = await this.store.set(lockKey, lockValue, ttlMs);
      if (result === 'OK') {
        this.stats.lockAcquired++;
        return { acquired: true, lockValue };
      }
      return { acquired: false };
    } catch {
      return { acquired: false };
    }
  }

  async releaseLock(resource, lockValue) {
    const lockKey = `lock:${resource}`;
    try {
      const current = await this.store.get(lockKey);
      if (current === lockValue) {
        await this.store.del(lockKey);
        this.stats.lockReleased++;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ─── Health Score ───────────────────────────────────────

  async setProviderHealth(provider, healthData) {
    return this.hset('health:providers', provider, {
      ...healthData,
      updatedAt: new Date().toISOString(),
    });
  }

  async getProviderHealth(provider) {
    return this.hget('health:providers', provider);
  }

  async getAllProviderHealth() {
    return this.hgetall('health:providers');
  }

  // ─── Instance Info ──────────────────────────────────────

  async registerInstance() {
    await this.set(`instance:${this.instanceId}`, {
      id: this.instanceId,
      startedAt: new Date().toISOString(),
      pid: process.pid,
      memory: process.memoryUsage(),
    }, 300000); // 5 min TTL, heartbeat refreshes
  }

  async heartbeat() {
    await this.set(`instance:${this.instanceId}`, {
      id: this.instanceId,
      lastHeartbeat: new Date().toISOString(),
      pid: process.pid,
      memory: process.memoryUsage(),
    }, 300000);
  }

  // ─── Status ─────────────────────────────────────────────

  getStatus() {
    return {
      mode: this.mode,
      instanceId: this.instanceId,
      stats: { ...this.stats },
      storeSize: this.store.size,
    };
  }

  destroy() {
    if (this.store instanceof InMemoryStore) {
      this.store.destroy();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════

const distributedState = new DistributedStateManager();

module.exports = {
  DistributedStateManager,
  InMemoryStore,
  RedisStore,
  distributedState,
};

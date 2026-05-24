const crypto = require('crypto');
const express = require('express');
const { routeRequest, recordRateLimitHit, recordSuccess } = require('../services/router.js');
const { recordRequest, recordTokens, setCooldown } = require('../services/ratelimit.js');


const AUTO_MODEL_ID = 'auto';

function isAutoModel(modelId) {
  return modelId === AUTO_MODEL_ID;
}

function timingSafeStringEqual(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const compareA = a.length === b.length ? a : Buffer.alloc(b.length);
  return crypto.timingSafeEqual(compareA, b) && a.length === b.length;
}

const stickySessionMap = new Map();
const STICKY_TTL_MS = 30 * 60 * 1000;

function getSessionKey(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return '';
  
  let contentToHash;
  if (typeof firstUser.content === 'string') {
    contentToHash = firstUser.content;
  } else if (Array.isArray(firstUser.content)) {
    contentToHash = JSON.stringify(firstUser.content);
  } else {
    return '';
  }
  
  const hash = crypto.createHash('sha1').update(contentToHash).digest('hex');
  return hash + ':' + (messages.length > 2 ? 'multi' : 'single');
}

function getStickyModel(messages) {
  const hasAssistant = messages.some(m => m.role === 'assistant');
  if (!hasAssistant) return undefined;

  const key = getSessionKey(messages);
  if (!key) return undefined;

  const entry = stickySessionMap.get(key);
  if (!entry) return undefined;

  if (Date.now() - entry.lastUsed > STICKY_TTL_MS) {
    stickySessionMap.delete(key);
    return undefined;
  }
  return entry.modelDbId;
}

function setStickyModel(messages, modelDbId) {
  const key = getSessionKey(messages);
  if (!key) return;
  stickySessionMap.set(key, { modelDbId: modelDbId, lastUsed: Date.now() });

  if (stickySessionMap.size > 500) {
    const now = Date.now();
    for (const [k, v] of stickySessionMap) {
      if (now - v.lastUsed > STICKY_TTL_MS) stickySessionMap.delete(k);
    }
  }
}

const MAX_RETRIES = 20;

function isRetryableError(err) {
  const msg = (err.message || '').toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')
    || msg.includes('quota') || msg.includes('resource_exhausted')
    || msg.includes('aborted') || msg.includes('timeout') || msg.includes('etimedout')
    || msg.includes('econnrefused') || msg.includes('econnreset')
    || msg.includes('503') || msg.includes('unavailable')
    || msg.includes('500') || msg.includes('internal server error')
    || msg.includes('404') || msg.includes('not found')
    || msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('forbidden');
}

async function logRequest(RequestsModel, userId, platform, modelId, status, inputTokens, outputTokens, latencyMs, error) {
  try {
    await RequestsModel.create({
      userId,
      platform: platform,
      modelId: modelId,
      status: status,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      latencyMs: latencyMs,
      error: error
    });
  } catch (e) {
    console.error('Failed to log request:', e);
  }
}

function createFreeLLMProxyRouter(ModelsModel, ApiKeysModel, FallbackConfigModel, RequestsModel, unifiedApiKey) {
  const router = express.Router();
  router.get('/models', async (req, res) => {
    const models = await ModelsModel.find({ enabled: true, deletedAt: null })
      .sort({ intelligenceRank: 1 })
      .lean();
    
    res.json({
      object: 'list',
      data: [
        {
          id: AUTO_MODEL_ID,
          object: 'model',
          created: 0,
          owned_by: 'freellmapi',
          name: 'Auto (router picks the best available model)',
          context_window: null,
        },
        ...models.map(m => ({
          id: m.modelId,
          object: 'model',
          created: 0,
          owned_by: m.platform,
          name: m.displayName,
          context_window: m.contextWindow,
        })),
      ],
    });
  });

  router.post('/chat/completions', async (req, res) => {
    const start = Date.now();

    let userId = null;
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const User = req.getModel('User');

    if (token && timingSafeStringEqual(token, unifiedApiKey)) {
      const admin = await User.findOne({ role: 'admin' }).lean();
      userId = admin ? admin._id : null;
      if (!userId) {
        const firstUser = await User.findOne().lean();
        userId = firstUser ? firstUser._id : null;
      }
    } else if (token) {
      try {
        const { verifyToken } = require('../../../../dry/utils/auth/jwt.util');
        const decoded = verifyToken(token);
        userId = decoded.id;
      } catch (err) {
        res.status(401).json({
          error: { message: 'Invalid API key or JWT token', type: 'authentication_error' },
        });
        return;
      }
    }

    if (!userId) {
      res.status(401).json({
        error: { message: 'Authentication required', type: 'authentication_error' },
      });
      return;
    }

    const requestedModel = req.body.model;
    const temperature = req.body.temperature;
    const max_tokens = req.body.max_tokens;
    const top_p = req.body.top_p;
    const stream = req.body.stream;
    const tools = req.body.tools;
    const tool_choice = req.body.tool_choice;
    const parallel_tool_calls = req.body.parallel_tool_calls;
    const messages = req.body.messages;

    const estimatedInputTokens = messages.reduce((sum, m) => {
      let contentLength = 0;
      if (typeof m.content === 'string') {
        contentLength = m.content.length;
      } else if (Array.isArray(m.content)) {
        contentLength = m.content.reduce((partSum, part) => {
          if (part.type === 'text' && part.text) {
            return partSum + part.text.length;
          }
          return partSum;
        }, 0);
      }
      return sum + Math.ceil(contentLength / 4);
    }, 0);
    const estimatedTotal = estimatedInputTokens + (max_tokens || 1000);

    let preferredModel;
    if (isAutoModel(requestedModel)) {
      preferredModel = getStickyModel(messages);
    } else if (requestedModel) {
      const enabled = await ModelsModel.findOne({ modelId: requestedModel, enabled: true, deletedAt: null }).lean();
      if (enabled) {
        preferredModel = enabled._id;
      } else {
        const disabled = await ModelsModel.findOne({ modelId: requestedModel, deletedAt: null }).lean();
        const reason = disabled ? 'is disabled' : 'is not in the catalog';
        res.status(400).json({
          error: {
            message: "Model '" + requestedModel + "' " + reason + ". Use 'auto' (or omit the 'model' field) to auto-route, or call /v1/models for the available list.",
            type: 'invalid_request_error',
            code: 'model_not_found',
          },
        });
        return;
      }
    } else {
      preferredModel = getStickyModel(messages);
    }

    const skipKeys = new Set();
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let route;
      try {
        route = await routeRequest(
          ModelsModel, 
          ApiKeysModel, 
          FallbackConfigModel, 
          estimatedTotal, 
          skipKeys.size > 0 ? skipKeys : undefined, 
          preferredModel
        );
      } catch (err) {
        if (lastError) {
          res.status(429).json({
            error: {
              message: "All models rate-limited. Last error: " + lastError.message,
              type: 'rate_limit_error',
            },
          });
        } else {
          res.status(err.status || 503).json({
            error: { message: err.message, type: 'routing_error' },
          });
        }
        return;
      }

      recordRequest(route.platform, route.modelId, route.keyId);

      try {
        if (stream) {
          let totalOutputTokens = 0;
          let streamStarted = false;
          try {
            const gen = route.provider.streamChatCompletion(
              route.apiKey, messages, route.modelId,
              { temperature: temperature, max_tokens: max_tokens, top_p: top_p, tools: tools, tool_choice: tool_choice, parallel_tool_calls: parallel_tool_calls },
            );

            for await (const chunk of gen) {
              if (!streamStarted) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Routed-Via', route.platform + '/' + route.modelId);
                if (attempt > 0) res.setHeader('X-Fallback-Attempts', String(attempt));
                streamStarted = true;
              }
              const text = chunk.choices?.[0]?.delta?.content || '';
              totalOutputTokens += Math.ceil(text.length / 4);
              res.write('data: ' + JSON.stringify(chunk) + '\n\n');
            }

            if (!streamStarted) {
              res.setHeader('Content-Type', 'text/event-stream');
              res.setHeader('X-Routed-Via', route.platform + '/' + route.modelId);
            }
            res.write('data: [DONE]\n\n');
            res.end();

            recordTokens(route.platform, route.modelId, route.keyId, estimatedInputTokens + totalOutputTokens);
            recordSuccess(route.modelDbId);
            setStickyModel(messages, route.modelDbId);
            await logRequest(RequestsModel, userId, route.platform, route.modelId, 'success', estimatedInputTokens, totalOutputTokens, Date.now() - start, null);
            return;
          } catch (streamErr) {
            if (streamStarted) {
              console.error('[Proxy] Mid-stream error from ' + route.displayName + ':', streamErr.message);
              const payload = { error: { message: "Provider error (" + route.displayName + "): stream interrupted", type: 'stream_error' } };
              try { res.write('data: ' + JSON.stringify(payload) + '\n\n'); } catch { /* socket gone */ }
              try { res.write('data: [DONE]\n\n'); res.end(); } catch { /* socket gone */ }
              await logRequest(RequestsModel, userId, route.platform, route.modelId, 'error', estimatedInputTokens, totalOutputTokens, Date.now() - start, streamErr.message);
              return;
            }
            throw streamErr;
          }
        } else {
          const result = await route.provider.chatCompletion(
            route.apiKey, messages, route.modelId,
            { temperature: temperature, max_tokens: max_tokens, top_p: top_p, tools: tools, tool_choice: tool_choice, parallel_tool_calls: parallel_tool_calls },
          );

          const totalTokens = result.usage?.total_tokens || 0;
          recordTokens(route.platform, route.modelId, route.keyId, totalTokens);
          recordSuccess(route.modelDbId);
          setStickyModel(messages, route.modelDbId);

          res.setHeader('X-Routed-Via', route.platform + '/' + route.modelId);
          if (attempt > 0) res.setHeader('X-Fallback-Attempts', String(attempt));
          res.json(result);

          await logRequest(
            RequestsModel,
            userId,
            route.platform,
            route.modelId,
            'success',
            result.usage?.prompt_tokens || 0,
            result.usage?.completion_tokens || 0,
            Date.now() - start,
            null
          );
          return;
        }
      } catch (err) {
        const latency = Date.now() - start;
        await logRequest(RequestsModel, userId, route.platform, route.modelId, 'error', estimatedInputTokens, 0, latency, err.message);

        if (isRetryableError(err)) {
          const skipId = route.platform + ':' + route.modelId + ':' + route.keyId;
          skipKeys.add(skipId);
          setCooldown(route.platform, route.modelId, route.keyId, 120000);
          recordRateLimitHit(route.modelDbId);
          lastError = err;
          console.log('[Proxy] ' + (err.message || '').slice(0, 60) + ' from ' + route.displayName + ', falling back (attempt ' + (attempt + 1) + '/' + MAX_RETRIES + ')');
          continue;
        }

        console.error('[Proxy] Provider error:', err.message, err.response?.data);
        res.status(502).json({
          error: {
            message: "Provider error (" + route.displayName + "): " + err.message,
            type: 'provider_error',
            details: err.response?.data || null
          },
        });
        return;
      }
    }

    res.status(429).json({
      error: {
        message: "All models rate-limited after " + MAX_RETRIES + " attempts. Last: " + (lastError?.message || ''),
        type: 'rate_limit_error',
      },
    });
  });

  return router;
}

module.exports = {
  createFreeLLMProxyRouter
};

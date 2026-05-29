const { BaseProvider } = require('./base.js');

class OpenAICompatProvider extends BaseProvider {
  constructor(opts) {
    super();
    this._platform = opts.platform;
    this._name = opts.name;
    this.baseUrl = opts.baseUrl;
    this.extraHeaders = opts.extraHeaders ?? {};
    this.validateUrl = opts.validateUrl;
    this.timeoutMs = opts.timeoutMs ?? 15000;
  }

  get platform() {
    return this._platform;
  }

  get name() {
    return this._name;
  }

  async chatCompletion(apiKey, messages, modelId, options) {
    // NVIDIA NIM API ne supporte pas les outils
    const isNvidia = this.platform.toLowerCase().includes('nvidia');
    
    const body = {
      model: modelId,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.max_tokens,
      top_p: options?.top_p,
    };
    
    if (!isNvidia) {
      body.tools = options?.tools;
      body.tool_choice = options?.tool_choice;
      body.parallel_tool_calls = options?.parallel_tool_calls;
    }
    
    const res = await this.fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...this.extraHeaders,
      },
      body: JSON.stringify(body),
    }, this.timeoutMs);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`${this.name} API error ${res.status}: ${err?.error?.message ?? res.statusText}`);
    }

    const data = await res.json();
    normalizeChoices(data);
    data._routed_via = { platform: this.platform, model: modelId };
    return data;
  }

  async *streamChatCompletion(apiKey, messages, modelId, options) {
    // NVIDIA NIM API ne supporte pas les outils
    const isNvidia = this.platform.toLowerCase().includes('nvidia');
    
    const body = {
      model: modelId,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.max_tokens,
      top_p: options?.top_p,
      stream: true,
    };
    
    if (!isNvidia) {
      body.tools = options?.tools;
      body.tool_choice = options?.tool_choice;
      body.parallel_tool_calls = options?.parallel_tool_calls;
    }
    
    const res = await this.fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...this.extraHeaders,
      },
      body: JSON.stringify(body),
    }, this.timeoutMs);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`${this.name} API error ${res.status}: ${err?.error?.message ?? res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          yield JSON.parse(data);
        } catch {
        }
      }
    }
  }

  async validateKey(apiKey) {
    const url = this.validateUrl ?? `${this.baseUrl}/models`;
    const res = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...this.extraHeaders,
      },
    }, 10000);
    return res.status !== 401 && res.status !== 403;
  }
}

function normalizeChoices(data) {
  for (const choice of data.choices ?? []) {
    const msg = choice.message;
    if (Array.isArray(msg.content)) {
      msg.content = msg.content
        .map(seg => (typeof seg === 'string' ? seg : (seg.text ?? '')))
        .join('');
    }
    const hasToolCalls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
    if (!hasToolCalls && (msg.content === '' || msg.content == null)) {
      const fold = (typeof msg.reasoning_content === 'string' && msg.reasoning_content.length > 0)
        ? msg.reasoning_content
        : (typeof msg.reasoning === 'string' && msg.reasoning.length > 0 ? msg.reasoning : null);
      if (fold !== null) msg.content = fold;
    }
  }
}

module.exports = { OpenAICompatProvider };

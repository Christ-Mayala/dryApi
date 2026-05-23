const { BaseProvider } = require('./base.js');
const { OpenAICompatProvider } = require('./openai-compat.js');
const { GoogleProvider } = require('./google.js');
const { CohereProvider } = require('./cohere.js');
const { CloudflareProvider } = require('./cloudflare.js');

const providers = new Map();

function register(provider) {
  providers.set(provider.platform, provider);
}

register(new OpenAICompatProvider({
  platform: 'groq',
  name: 'Groq',
  baseUrl: 'https://api.groq.com/openai/v1',
}));

register(new OpenAICompatProvider({
  platform: 'cerebras',
  name: 'Cerebras',
  baseUrl: 'https://api.cerebras.ai/v1',
}));

register(new OpenAICompatProvider({
  platform: 'sambanova',
  name: 'SambaNova',
  baseUrl: 'https://api.sambanova.ai/v1',
}));

register(new OpenAICompatProvider({
  platform: 'nvidia',
  name: 'NVIDIA NIM',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
}));

register(new OpenAICompatProvider({
  platform: 'mistral',
  name: 'Mistral',
  baseUrl: 'https://api.mistral.ai/v1',
}));

register(new OpenAICompatProvider({
  platform: 'openrouter',
  name: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  extraHeaders: {
    'HTTP-Referer': 'http://localhost:3001',
    'X-Title': 'FreeLLMAPI',
  },
}));

register(new OpenAICompatProvider({
  platform: 'github',
  name: 'GitHub Models',
  baseUrl: 'https://models.github.ai/inference',
}));

register(new OpenAICompatProvider({
  platform: 'zhipu',
  name: 'Zhipu AI',
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
}));

register(new OpenAICompatProvider({
  platform: 'ollama',
  name: 'Ollama Cloud',
  baseUrl: 'https://ollama.com/v1',
  timeoutMs: 120000,
}));

register(new OpenAICompatProvider({
  platform: 'kilo',
  name: 'Kilo Gateway',
  baseUrl: 'https://api.kilo.ai/api/gateway/v1',
}));

register(new OpenAICompatProvider({
  platform: 'pollinations',
  name: 'Pollinations',
  baseUrl: 'https://text.pollinations.ai/openai/v1',
}));

register(new OpenAICompatProvider({
  platform: 'llm7',
  name: 'LLM7',
  baseUrl: 'https://api.llm7.io/v1',
}));

register(new OpenAICompatProvider({
  platform: 'openai',
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
}));

register(new GoogleProvider());
register(new CohereProvider());
register(new CloudflareProvider());

function getProvider(platform) {
  return providers.get(platform);
}

function getAllProviders() {
  return Array.from(providers.values());
}

function hasProvider(platform) {
  return providers.has(platform);
}

module.exports = {
  getProvider,
  getAllProviders,
  hasProvider,
  register
};

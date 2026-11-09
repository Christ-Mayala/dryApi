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

// Kilo AI Gateway : endpoint officiel compatible OpenAI. Les modèles `:free`
// sont accessibles sans clé (200 req/h/IP) ; le seed enregistre une clé
// partagée « marqueur » pour rendre ces modèles routables sans configuration.
register(new OpenAICompatProvider({
  platform: 'kilo',
  name: 'Kilo Gateway',
  baseUrl: 'https://ai-gateway.kilo.ai/api/v1',
  timeoutMs: 30000,
}));

// Pollinations expose une API compatible OpenAI sur `https://text.pollinations.ai/v1`
// (l'ancien chemin `/openai/v1` renvoie une erreur réseau). Aucune clé n'est
// requise : une clé partagée marqueur est enregistrée par le seed.
register(new OpenAICompatProvider({
  platform: 'pollinations',
  name: 'Pollinations',
  baseUrl: 'https://text.pollinations.ai/v1',
  // Service souvent saturé (402/timeouts) : échec rapide pour laisser la main
  // aux fournisseurs suivants au lieu de bloquer la requête ~30 s.
  timeoutMs: 8000,
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

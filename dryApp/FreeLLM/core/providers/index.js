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

// Ollama Cloud : API compatible OpenAI.
// Timeout aligné sur la philosophie du budget global de fallback (60 s) : à
// 120 s, un seul fournisseur pouvait consommer — et dépasser — tout le budget,
// empêchant tout repli vers un autre fournisseur.
register(new OpenAICompatProvider({
  platform: 'ollama',
  name: 'Ollama Cloud',
  baseUrl: 'https://ollama.com/v1',
  timeoutMs: 30000,
}));

// Kilo AI Gateway : endpoint officiel compatible OpenAI. Les modèles `:free`
// sont accessibles sans clé (200 req/h/IP) ; le seed enregistre une clé
// partagée « marqueur » pour rendre ces modèles routables sans configuration.
// Timeout court : les modèles `:free` sont mis en file d'attente et dépassent
// souvent 30 s. Un échec rapide laisse le budget global de fallback (60 s)
// servir à un autre fournisseur au lieu d'être consommé par un seul.
register(new OpenAICompatProvider({
  platform: 'kilo',
  name: 'Kilo Gateway',
  baseUrl: 'https://ai-gateway.kilo.ai/api/v1',
  timeoutMs: 15000,
}));

// OVHcloud AI Endpoints : API compatible OpenAI, modèles open-weight hébergés en
// France. Le tier anonyme s'utilise SANS clé (aucun en-tête `Authorization`) et
// est plafonné à 2 req/min ; le seed enregistre une clé partagée « marqueur » pour
// rendre ces modèles routables sans configuration.
// Timeout généreux : l'inférence européenne est plus lente que les gateways US.
register(new OpenAICompatProvider({
  platform: 'ovh',
  name: 'OVHcloud AI Endpoints',
  baseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
  timeoutMs: 30000,
}));

// Pollinations a supprimé l'accès anonyme : l'endpoint compatible OpenAI exige
// désormais une clé et a déménagé vers `gen.pollinations.ai`. L'URL est corrigée
// mais les modèles sont désactivés par le seed : sans clé, chaque appel ne
// consommait qu'une tentative de fallback. Réactiver après avoir enregistré une clé.
register(new OpenAICompatProvider({
  platform: 'pollinations',
  name: 'Pollinations',
  baseUrl: 'https://gen.pollinations.ai/v1',
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

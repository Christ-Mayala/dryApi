const crypto = require('crypto');

async function seedFreeLLM(ModelsModel, FallbackConfigModel, SettingsModel) {
  console.log('Seeding FreeLLM data...');

  const count = await ModelsModel.countDocuments({ deletedAt: null });
  console.log(`Current model count: ${count}`);
  console.log('Ensuring FreeLLM model catalog...');

  const models = [
      // Google
      ['google', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 14, 8, 'Frontier', 5, 50, 250000, null, '~6M', 1048576, false],
      ['google', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 20, 5, 'Large', 10, 20, 250000, null, '~3M', 1048576, true],
      ['google', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', 26, 3, 'Medium', 15, 20, 250000, null, '~3M', 1048576, true],
      ['google', 'gemini-3.1-flash-lite-preview', 'Gemini 3.1 Flash-Lite Preview', 18, 3, 'Medium', 15, 20, 250000, null, '~3M', 1048576, true],
      ['google', 'gemini-3-flash-preview', 'Gemini 3 Flash Preview', 11, 5, 'Large', 10, 20, 250000, null, '~3M', 1048576, true],
      ['google', 'gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview', 1, 8, 'Frontier', 5, 20, 250000, null, '~3M', 1048576, true],

      // OpenRouter
      ['openrouter', 'minimax/minimax-m2.5:free', 'MiniMax M2.5 (free)', 1, 9, 'Frontier', 20, 200, null, null, '~6M', 196608, true],
      ['openrouter', 'qwen/qwen3-coder:free', 'Qwen3 Coder (free)', 2, 9, 'Frontier', 20, 200, null, null, '~6M', 262144, true],
      ['openrouter', 'qwen/qwen3-next-80b-a3b-instruct:free', 'Qwen3-Next 80B (free)', 3, 9, 'Large', 20, 200, null, null, '~6M', 262144, true],
      ['openrouter', 'z-ai/glm-4.5-air:free', 'GLM-4.5 Air (free)', 8, 9, 'Large', 20, 200, null, null, '~6M', 131072, true],
      ['openrouter', 'openai/gpt-oss-120b:free', 'GPT-OSS 120B (free)', 6, 9, 'Large', 20, 200, null, null, '~6M', 131072, true],
      ['openrouter', 'inclusionai/ling-2.6-1t:free', 'Ling 2.6 1T (free)', 4, 9, 'Frontier', 20, 200, null, null, '~6M', 262144, true],
      ['openrouter', 'tencent/hy3-preview:free', 'Tencent HY3 Preview (free)', 7, 9, 'Frontier', 20, 200, null, null, '~6M', 262144, true],
      ['openrouter', 'poolside/laguna-m.1:free', 'Poolside Laguna M.1 (free)', 13, 9, 'Large', 20, 200, null, null, '~6M', 131072, true],
      ['openrouter', 'google/gemma-4-26b-a4b-it:free', 'Gemma 4 26B-A4B (free)', 22, 9, 'Medium', 20, 200, null, null, '~6M', 262144, true],
      ['openrouter', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'Nemotron 3 Nano 30B Reasoning (free)', 23, 9, 'Medium', 20, 200, null, null, '~6M', 262144, true],
      ['openrouter', 'poolside/laguna-xs.2:free', 'Poolside Laguna XS.2 (free)', 26, 10, 'Medium', 20, 200, null, null, '~6M', 131072, true],
      ['openrouter', 'nvidia/nemotron-nano-9b-v2:free', 'Nemotron Nano 9B v2 (free)', 28, 10, 'Medium', 20, 200, null, null, '~6M', 128000, true],
      ['openrouter', 'liquid/lfm-2.5-1.2b-thinking:free', 'Liquid LFM 2.5 1.2B Thinking (free)', 30, 10, 'Small', 20, 200, null, null, '~6M', 32768, true],
      ['openrouter', 'openai/gpt-oss-20b:free', 'GPT-OSS 20B (free)', 18, 9, 'Medium', 20, 200, null, null, '~6M', 131072, true],
      ['openrouter', 'meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B (free)', 17, 9, 'Medium', 20, 200, null, null, '~6M', 131072, true],
      ['openrouter', 'liquid/lfm-2.5-1.2b-instruct:free', 'Liquid LFM 2.5 1.2B (free)', 30, 10, 'Small', 20, 200, null, null, '~6M', 32768, true],
      ['openrouter', 'google/gemma-4-31b-it:free', 'Gemma 4 31B (free)', 19, 9, 'Medium', 20, 200, null, null, '~6M', 262144, true],

      // Cerebras
      ['cerebras', 'qwen-3-235b-a22b-instruct-2507', 'Qwen3 235B', 6, 1, 'Frontier', 30, 14400, 60000, 1000000, '~30M', 131072, true],
      ['cerebras', 'gpt-oss-120b', 'GPT-OSS 120B (Cerebras)', 6, 1, 'Large', 30, 1000, 60000, 1000000, '~30M', 131072, true],
      ['cerebras', 'llama3.1-8b', 'Llama 3.1 8B (Cerebras)', 28, 1, 'Small', 30, 1000, 60000, 1000000, '~30M', 131072, true],

      // GitHub Models
      ['github', 'openai/gpt-4.1', 'GPT-4.1 (GitHub)', 20, 7, 'Large', 10, 50, null, null, '~9M', 128000, true],
      ['github', 'gpt-4o', 'GPT-4o', 25, 7, 'Large', 10, 50, null, null, '~18M', 8000, true],

      // SambaNova
      ['sambanova', 'DeepSeek-V3.2', 'DeepSeek V3.2', 4, 9, 'Frontier', 20, 20, null, 200000, '~3M', 131072, true],
      ['sambanova', 'DeepSeek-V3.1', 'DeepSeek V3.1', 5, 9, 'Frontier', 20, 20, null, 200000, '~3M', 131072, true],
      ['sambanova', 'Llama-4-Maverick-17B-128E-Instruct', 'Llama 4 Maverick', 11, 9, 'Large', 20, 20, null, 200000, '~3M', 8192, true],
      ['sambanova', 'gpt-oss-120b', 'GPT-OSS 120B (SambaNova)', 6, 9, 'Large', 20, 20, null, 200000, '~3M', 131072, true],
      ['sambanova', 'DeepSeek-V3.1-cb', 'DeepSeek V3.1 (CB)', 5, 9, 'Frontier', 20, 20, null, 200000, '~3M', 131072, true],
      ['sambanova', 'gemma-3-12b-it', 'Gemma 3 12B (SambaNova)', 22, 9, 'Medium', 20, 20, null, 200000, '~3M', 131072, true],

      // Groq
      ['groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B', 17, 2, 'Medium', 30, 1000, 12000, 500000, '~15M', 131072, true],
      ['groq', 'meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout', 12, 2, 'Medium', 30, 1000, 6000, 1000000, '~30M', 131072, true],
      ['groq', 'openai/gpt-oss-120b', 'GPT-OSS 120B (Groq)', 6, 2, 'Large', 30, 1000, 8000, 200000, '~6M', 131072, true],
      ['groq', 'openai/gpt-oss-20b', 'GPT-OSS 20B (Groq)', 18, 2, 'Medium', 30, 1000, 8000, 200000, '~6M', 131072, true],
      ['groq', 'qwen/qwen3-32b', 'Qwen3 32B (Groq)', 19, 2, 'Medium', 60, 1000, 6000, 500000, '~15M', 131072, true],
      ['groq', 'llama-3.1-8b-instant', 'Llama 3.1 8B Instant', 28, 2, 'Small', 30, 14400, 6000, 500000, '~15M', 131072, true],
      ['groq', 'groq/compound', 'Compound (Groq)', 6, 2, 'Large', 30, 1000, 8000, 200000, '~6M', 131072, true],
      ['groq', 'groq/compound-mini', 'Compound Mini (Groq)', 18, 2, 'Medium', 30, 1000, 8000, 200000, '~6M', 131072, true],

      // Mistral
      ['mistral', 'mistral-large-latest', 'Mistral Large 3', 14, 8, 'Large', 2, null, 500000, null, '~50-100M', 131072, true],
      ['mistral', 'magistral-medium-latest', 'Magistral Medium', 21, 8, 'Large', 2, null, 500000, null, '~50-100M', 40000, true],
      ['mistral', 'codestral-latest', 'Codestral', 16, 6, 'Medium', 2, null, 500000, null, '~50-100M', 32000, true],
      ['mistral', 'devstral-latest', 'Devstral', 16, 8, 'Medium', 2, null, 500000, null, '~50-100M', 131072, true],
      ['mistral', 'mistral-medium-latest', 'Mistral Medium 3.5', 14, 8, 'Large', 2, null, 500000, null, '~50-100M', 131072, true],

      // NVIDIA
      ['nvidia', 'meta/llama-3.1-70b-instruct', 'Llama 3.1 70B (NV)', 17, 6, 'Large', 40, null, null, null, '~3M (1k credits)', 131072, true],
      ['nvidia', 'meta/llama-3.3-70b-instruct', 'Llama 3.3 70B (NV)', 17, 6, 'Large', 40, null, null, null, '~3M (credits)', 131072, true],
      ['nvidia', 'meta/llama-4-maverick-17b-128e-instruct', 'Llama 4 Maverick (NV)', 11, 6, 'Large', 40, null, null, null, '~3M (credits)', 131072, true],
      ['nvidia', 'deepseek-ai/deepseek-v4-pro', 'DeepSeek V4 Pro (NV)', 3, 9, 'Frontier', 40, null, null, null, '~2M (credits)', 131072, true],
      ['nvidia', 'mistralai/mistral-large-3-675b-instruct-2512', 'Mistral Large 3 675B (NV)', 3, 9, 'Frontier', 40, null, null, null, '~2M (credits)', 131072, true],
      ['nvidia', 'minimaxai/minimax-m2.7', 'MiniMax M2.7 (NV)', 3, 9, 'Frontier', 40, null, null, null, '~2M (credits)', 196608, true],
      ['nvidia', 'nvidia/nemotron-3-super-120b-a12b', 'Nemotron 3 Super 120B (NV)', 22, 9, 'Frontier', 40, null, null, null, '~2M (credits)', 262144, true],
      ['nvidia', 'nvidia/nemotron-3-nano-30b-a3b', 'Nemotron 3 Nano 30B (NV)', 22, 9, 'Medium', 40, null, null, null, '~3M (credits)', 262144, true],
      ['nvidia', 'google/gemma-4-31b-it', 'Gemma 4 31B (NV)', 19, 9, 'Medium', 40, null, null, null, '~3M (credits)', 262144, true],
      ['nvidia', 'moonshotai/kimi-k2.6', 'Kimi K2.6 (NV)', 3, 9, 'Frontier', 40, null, null, null, '~2M (credits)', 131072, true],

      // Cohere
      ['cohere', 'command-r-plus-08-2024', 'Command R+ (08-2024)', 27, 11, 'Large', 20, 33, null, null, '~1-2M', 131072, true],
      ['cohere', 'command-a-03-2025', 'Command-A (03-2025)', 27, 11, 'Large', 20, 33, null, null, '~1-2M', 131072, true],

      // Cloudflare
      ['cloudflare', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'Llama 3.3 70B fp8-fast (CF)', 17, 11, 'Large', null, null, null, null, '~18-45M', 131072, true],
      ['cloudflare', '@cf/openai/gpt-oss-120b', 'GPT-OSS 120B (CF)', 6, 11, 'Large', null, null, null, null, '~18-45M', 131072, true],
      ['cloudflare', '@cf/zai-org/glm-4.7-flash', 'GLM-4.7 Flash (CF)', 10, 11, 'Large', null, null, null, null, '~18-45M', 131072, true],
      ['cloudflare', '@cf/meta/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout (CF)', 12, 11, 'Large', null, null, null, null, '~18-45M', 131072, true],
      ['cloudflare', '@cf/moonshotai/kimi-k2.5', 'Kimi K2.5 (CF)', 3, 11, 'Frontier', null, null, null, null, '~10-20M', 262144, true],
      ['cloudflare', '@cf/qwen/qwen3-30b-a3b-fp8', 'Qwen3 30B-A3B fp8 (CF)', 7, 11, 'Large', null, null, null, null, '~18-45M', 131072, true],
      ['cloudflare', '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', 'DeepSeek R1 Distill Qwen 32B (CF)', 9, 11, 'Large', null, null, null, null, '~3-5M', 131072, true],
      ['cloudflare', '@cf/moonshotai/kimi-k2.6', 'Kimi K2.6 (CF)', 2, 11, 'Frontier', null, null, null, null, '~10-20M', 262144, true],
      ['cloudflare', '@cf/ibm-granite/granite-4.0-h-micro', 'Granite 4.0 H Micro (CF)', 29, 11, 'Small', null, null, null, null, '~5-10M', 131072, true],

      // Zhipu
      ['zhipu', 'glm-4.5-flash', 'GLM-4.5 Flash', 24, 4, 'Large', null, null, null, 1000000, '~30M', 131072, true],
      ['zhipu', 'glm-4.7-flash', 'GLM-4.7 Flash', 18, 4, 'Large', null, null, null, 1000000, '~30M', 131072, true],

      // Ollama
      ['ollama', 'qwen3-coder:480b', 'Qwen3-Coder 480B (Ollama)', 2, 9, 'Frontier', null, null, null, null, '~5-10M', 262144, true],
      ['ollama', 'mistral-large-3:675b', 'Mistral Large 3 675B (Ollama)', 3, 9, 'Frontier', null, null, null, null, '~5-10M', 131072, true],
      ['ollama', 'deepseek-v3.2', 'DeepSeek V3.2 (Ollama)', 4, 9, 'Frontier', null, null, null, null, '~5-10M', 131072, true],
      ['ollama', 'cogito-2.1:671b', 'Cogito 2.1 671B (Ollama)', 4, 9, 'Frontier', null, null, null, null, '~5-10M', 131072, true],
      ['ollama', 'kimi-k2-thinking', 'Kimi K2 Thinking (Ollama)', 5, 9, 'Frontier', null, null, null, null, '~5-10M', 131072, true],
      ['ollama', 'glm-4.7', 'GLM-4.7 (Ollama)', 6, 9, 'Frontier', null, null, null, null, '~5-10M', 131072, true],
      ['ollama', 'gpt-oss:120b', 'GPT-OSS 120B (Ollama)', 6, 9, 'Large', null, null, null, null, '~10-20M', 131072, true],
      ['ollama', 'devstral-2:123b', 'Devstral 2 123B (Ollama)', 8, 10, 'Large', null, null, null, null, '~10-20M', 131072, true],
      ['ollama', 'gpt-oss:20b', 'GPT-OSS 20B (Ollama)', 18, 10, 'Medium', null, null, null, null, '~20-30M', 131072, true],
      ['ollama', 'gemma4:31b', 'Gemma 4 31B (Ollama)', 22, 10, 'Medium', null, null, null, null, '~20-30M', 131072, true],

      // Kilo
      ['kilo', 'nvidia/nemotron-3-super-120b-a12b:free', 'Nemotron 3 Super 120B (Kilo)', 22, 9, 'Frontier', null, null, null, null, '~2-3M (200/hr)', 262144, true],

      // Pollinations
      ['pollinations', 'openai-fast', 'GPT-OSS 20B (Pollinations)', 18, 10, 'Medium', null, null, null, null, '~? (anon)', 131072, true],

      // LLM7
      ['llm7', 'gpt-oss-20b', 'GPT-OSS 20B (LLM7)', 18, 10, 'Medium', 100, null, null, null, '~2-3M (100/hr)', 131072, true],
      ['llm7', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'Llama 3.1 8B Turbo (LLM7)', 28, 10, 'Small', 100, null, null, null, '~2-3M (100/hr)', 131072, true],
      ['llm7', 'codestral-latest', 'Codestral (LLM7)', 16, 8, 'Medium', 100, null, null, null, '~2-3M (100/hr)', 32000, true],
      ['llm7', 'ministral-8b-2512', 'Ministral 8B (LLM7)', 28, 10, 'Small', 100, null, null, null, '~2-3M (100/hr)', 131072, true],
      ['llm7', 'GLM-4.6V-Flash', 'GLM-4.6V Flash (LLM7)', 15, 9, 'Large', 100, null, null, null, '~2-3M (100/hr)', 131072, true],

      // OpenAI
      ['openai', 'gpt-4o', 'GPT-4o', 1, 5, 'Frontier', null, null, null, null, 'Paid (your key)', 128000, true],
      ['openai', 'gpt-4o-mini', 'GPT-4o Mini', 4, 5, 'Large', null, null, null, null, 'Paid (your key)', 128000, true],
      ['openai', 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 12, 3, 'Medium', null, null, null, null, 'Paid (your key)', 16384, true]
    ];

    const modelDocs = models.map(m => ({
      platform: m[0],
      modelId: m[1],
      displayName: m[2],
      intelligenceRank: m[3],
      speedRank: m[4],
      sizeLabel: m[5],
      rpmLimit: m[6],
      rpdLimit: m[7],
      tpmLimit: m[8],
      tpdLimit: m[9],
      monthlyTokenBudget: m[10],
      contextWindow: m[11],
      enabled: m[12]
    }));

  let insertedModels = 0;
  let updatedModels = 0;
  for (const doc of modelDocs) {
    const result = await ModelsModel.updateOne(
      { platform: doc.platform, modelId: doc.modelId },
      {
        $setOnInsert: {
          label: doc.platform,
          enabled: doc.enabled,
        },
        $set: {
          displayName: doc.displayName,
          intelligenceRank: doc.intelligenceRank,
          speedRank: doc.speedRank,
          sizeLabel: doc.sizeLabel,
          rpmLimit: doc.rpmLimit,
          rpdLimit: doc.rpdLimit,
          tpmLimit: doc.tpmLimit,
          tpdLimit: doc.tpdLimit,
          monthlyTokenBudget: doc.monthlyTokenBudget,
          contextWindow: doc.contextWindow,
        },
      },
      { upsert: true },
    );

    insertedModels += result.upsertedCount || 0;
    if ((result.matchedCount || 0) > 0) {
      updatedModels += 1;
    }
  }
  console.log(`Model catalog ready (inserted=${insertedModels}, updated=${updatedModels}).`);

  let enabledCount = await ModelsModel.countDocuments({ enabled: true, deletedAt: null });
  if (enabledCount === 0) {
    await ModelsModel.updateOne(
      { platform: 'google', modelId: 'gemini-2.5-pro' },
      { $set: { enabled: true } },
    );
    enabledCount = await ModelsModel.countDocuments({ enabled: true, deletedAt: null });
    if (enabledCount === 0) {
      const firstModel = await ModelsModel.findOne({ deletedAt: null }).sort({ intelligenceRank: 1 }).lean();
      if (firstModel) {
        await ModelsModel.updateOne({ _id: firstModel._id }, { $set: { enabled: true } });
        enabledCount = 1;
      }
    }
    console.log(`No enabled model found; recovery applied. enabledCount=${enabledCount}`);
  }

  const sortedEnabledModels = await ModelsModel.find({ enabled: true, deletedAt: null })
    .sort({ speedRank: 1, intelligenceRank: 1 })
    .lean();

  if (sortedEnabledModels.length > 0) {
    for (let i = 0; i < sortedEnabledModels.length; i++) {
      const model = sortedEnabledModels[i];
      await FallbackConfigModel.updateOne(
        { modelDbId: model._id },
        {
          $set: {
            priority: i + 1,
            enabled: true,
            deletedAt: null,
            status: 'active',
          },
          $setOnInsert: {
            label: model.displayName,
          },
        },
        { upsert: true },
      );
    }

    await FallbackConfigModel.updateMany(
      { modelDbId: { $nin: sortedEnabledModels.map((m) => m._id) } },
      { $set: { enabled: false } },
    );
  }
  console.log(`Fallback chain ensured with ${sortedEnabledModels.length} enabled model(s).`);

  console.log(`Checking unified API key...`);

  let unifiedKey;
  const existingSetting = await SettingsModel.findOne({ key: 'unified_api_key' });

  if (!existingSetting) {
    unifiedKey = crypto.randomBytes(32).toString('hex');
    await SettingsModel.create({
      key: 'unified_api_key',
      value: unifiedKey,
      label: 'Unified API Key'
    });
    console.log(`Generated unified API key: ${unifiedKey}`);
  } else {
    unifiedKey = existingSetting.value;
    console.log(`Using existing unified API key.`);
  }

  console.log('Seeding complete!');

  return unifiedKey;
}

module.exports = {
  seedFreeLLM
};

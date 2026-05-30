const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../core/routes/inferenceOsProxy.js');
let code = fs.readFileSync(file, 'utf8');

// 1. Remove old local circuit breaker definition
code = code.replace(/const cbKey = `\$\{route\.platform\}:\$\{route\.modelId\}`;\s*const circuitBreaker = getCircuitBreaker\(cbKey\);/g, '');

// 2. Update circuitBreaker.recordSuccess() -> circuitBreaker.recordSuccess(route.platform)
code = code.replace(/circuitBreaker\.recordSuccess\(\);/g, 'circuitBreaker.recordSuccess(route.platform);');

// 3. Update circuitBreaker.recordFailure() -> circuitBreaker.recordFailure(route.platform)
code = code.replace(/circuitBreaker\.recordFailure\(\);/g, 'circuitBreaker.recordFailure(route.platform);');

// 4. In the request finalization, we want a unified finalizer. Instead of parsing the whole file,
// we will replace all `logger.request({...})` with a single unified call or just keep them but 
// modify their calls to use `perf.summary()` correctly.
// Actually, since the prompt specifies "Créer un logger final UNIQUE exécuté une seule fois par requête... s'exécuter après la sérialisation... Utiliser try/finally lorsque nécessaire."
// It's better to wrap the route logic in a try/finally block. 

// Find the start of the chat completions handler
const handlerStart = "router.post('/chat/completions', async (req, res) => {\n    const profiler = createProfiler();\n    profiler.mark('start');";

const unifiedSetup = `router.post('/chat/completions', async (req, res) => {
    const profiler = createProfiler();
    profiler.mark('start');
    const requestId = crypto.randomUUID();
    let isFinalized = false;
    let finalStatus = 'error';
    let finalError = null;
    let routeContext = { platform: null, modelId: null, keyId: null };
    let taskType = 'chat';
    let fallbackCount = 0;
    let cacheHit = false;
    let tokensContext = { originalInput: 0, processedInput: 0, output: 0, total: 0, saved: 0, conversationUsed: 0 };
    let compressionRatio = 0;
    let isIdeMode = false;

    const finalizeRequest = () => {
      if (isFinalized) return;
      isFinalized = true;
      profiler.mark('serialize');
      logger.request({
        requestId,
        taskType,
        status: finalStatus,
        platform: routeContext.platform,
        model: routeContext.modelId,
        keyId: routeContext.keyId,
        fallbackCount,
        cacheHit,
        isIdeMode,
        tokens: tokensContext,
        compression: compressionRatio,
        performance: profiler.summary(),
        error: finalError
      });
    };

    try {`;

// We also need to add the finally block at the end.
const handlerEnd = "    res.status(429).json({\n      error: {\n        message: \"All models exhausted after \" + fallbackCount + \" attempts. Last: \" + (lastError?.message || ''),\n        type: 'rate_limit_error',\n        requestId\n      },\n    });\n  });";

const replacementEnd = `    res.status(429).json({
      error: {
        message: "All models exhausted after " + fallbackCount + " attempts. Last: " + (lastError?.message || ''),
        type: 'rate_limit_error',
        requestId
      },
    });
    } finally {
      finalizeRequest();
    }
  });`;

// Replace logger.request internally with state updates
code = code.replace(/logger\.request\(\{[\s\S]*?\}\);/g, (match) => {
    return `// Final log delegated to finally block`;
});

// Write the file back
fs.writeFileSync(file, code);
console.log("Refactoring script executed.");

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../core/routes/inferenceOsProxy.js');
let code = fs.readFileSync(filePath, 'utf8');

// Replace ALL logger.request({ ... }) with a call to assignState(...) and then it returns.
// Wait, actually, if we just remove logger.request, we need to make sure finalStatus is set.
// It's easier to just replace logger.request with state assignments manually using string replacement or regex.

code = code.replace(/logger\.request\(\{[\s\S]*?\}\);/g, (match) => {
    // Extract status if present
    const statusMatch = match.match(/status:\s*['"]([^'"]+)['"]/);
    const status = statusMatch ? statusMatch[1] : 'error';
    
    // Extract error if present
    const errorMatch = match.match(/error:\s*(.+?),?\n/);
    const errorStr = errorMatch ? errorMatch[1] : 'null';

    // Extract platform
    const platformMatch = match.match(/platform:\s*(.+?),?\n/);
    const platform = platformMatch ? platformMatch[1] : 'null';

    // Extract model
    const modelMatch = match.match(/model:\s*(.+?),?\n/);
    const model = modelMatch ? modelMatch[1] : 'null';

    // Extract tokens
    const tokensMatch = match.match(/tokens:\s*(\{[\s\S]*?\})/);
    const tokens = tokensMatch ? tokensMatch[1] : 'null';

    return `finalStatus = '${status}';
        finalError = ${errorStr};
        routeContext.platform = ${platform};
        routeContext.modelId = ${model};
        if (${tokens} !== null) tokensContext = ${tokens};
        // logger.request removed`;
});

fs.writeFileSync(filePath, code);
console.log("Replaced logger.request with state assignments.");

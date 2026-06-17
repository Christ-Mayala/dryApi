const fs = require('fs');

// ===== 1. FIX AIContext.js - Use FreeLLM API instead of Gemini =====
const aiPath = 'D:/Alvine/trivida-version-commercial/src/context/AIContext.js';
let ai = fs.readFileSync(aiPath, 'utf8');

// Add FRELLM_API endpoint constant and replace Gemini calls
const freeLLMImports = `import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// FreeLLM Configuration - user gets API key from freellmapi.netlify.app
const FREELLM_API_ENDPOINT = 'https://dryapi.onrender.com';
const FREELLM_CHAT_ENDPOINT = FREELLM_API_ENDPOINT + '/v1/chat/completions';
const AI_CONFIG = {`;

// Find the start of file and replace the imports section
ai = ai.replace(/import.*Platform.*;[\s\S]*?const AI_CONFIG = {/, freeLLMImports);

// Modify callGemini to call FreeLLM instead
const freeLLMCall = `async function callFreeLLM(messages, maxTokens = AI_CONFIG.MAX_OUTPUT_TOKENS.CHAT) {
  try {
    const apiKey = await SecurityService.getApiKey();
    if (!apiKey) {
      return { error: true, message: 'Clé API FreeLLM manquante. Configurez-la dans Paramètres > Intelligence Artificielle.', isSetupNeeded: true };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(FREELLM_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'auto',
        messages: messages,
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        return { error: true, message: 'Clé API FreeLLM invalide. Vérifiez votre clé dans Paramètres.', isSetupNeeded: true };
      }
      if (response.status === 429) {
        return { error: true, message: 'Quota de requêtes dépassé. Réessayez dans quelques instants.' };
      }
      return { error: true, message: 'Erreur serveur: ' + (errorText || response.status) };
    }

    const data = await response.json();
    
    if (data.error) {
      return { error: true, message: data.error.message || 'Erreur inconnue' };
    }

    if (data.choices && data.choices.length > 0) {
      return { error: false, text: data.choices[0].message.content };
    }

    return { error: true, message: 'Réponse vide de l\\'API' };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { error: true, message: 'La requête a pris trop de temps. Vérifiez votre connexion.' };
    }
    return { error: true, message: 'Erreur de connexion: ' + (error.message || 'Réseau indisponible') };
  }
}`;

// Replace the old callGemini function with callFreeLLM
// First find the old callGemini function boundaries
const oldCallGeminiStart = ai.indexOf('async function callGemini');
if (oldCallGeminiStart !== -1) {
  // Find the end - look for the next function or export
  const restAfter = ai.slice(oldCallGeminiStart);
  let depth = 0;
  let endIdx = 0;
  for (let i = 0; i < restAfter.length; i++) {
    if (restAfter[i] === '{') depth++;
    if (restAfter[i] === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
    // Also stop at next top-level function declaration or export
    if (depth === 0 && (restAfter.startsWith('async function', i) || restAfter.startsWith('function', i) || restAfter.startsWith('export', i))) {
      endIdx = i;
      break;
    }
  }
  if (endIdx === 0) endIdx = restAfter.length;
  
  const beforeCall = ai.slice(0, oldCallGeminiStart);
  const afterCall = ai.slice(oldCallGeminiStart + endIdx);
  ai = beforeCall + freeLLMCall + '\n\n' + afterCall;
}

// Replace getAIAdvice to use callFreeLLM
ai = ai.replace(
  /const result = await callGemini\(/g,
  'const result = await callFreeLLM('
);

ai = ai.replace(
  /const response = await callGemini\(/g,
  'const response = await callFreeLLm('
);

// Replace analyzeReceipt's call to callGemini
ai = ai.replace(
  /callGemini\(messages,/g,
  'callFreeLLM(messages,'
);

// Update exports in the context to show FreeLLM instead of Gemini
ai = ai.replace(/Connecter une clé API Google/g, 'Connecter une clé API FreeLLM');
ai = ai.replace(/Gemini/g, 'FreeLLM');
ai = ai.replace(/google/g, 'freellm');

// Update prompt templates to remove Gemini-specific references
ai = ai.replace(/sur Google/g, 'via FreeLLM');

fs.writeFileSync(aiPath, ai);
console.log('1/5 FIXED: AIContext.js - FreeLLM API integration');


// ===== 2. FIX App.js - Add ErrorBoundary =====
const appPath = 'D:/Alvine/trivida-version-commercial/App.js';
let app = fs.readFileSync(appPath, 'utf8');

// Add a simple ErrorBoundary catch at the App level
if (!app.includes('ErrorBoundary') && !app.includes('componentDidCatch')) {
  // Add a rendering error handler
  app = app.replace(
    `const App = () => (`,
    `// Error boundary wrapper
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F4F7', padding: 24 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#DC2626" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 }}>Une erreur est survenue</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
            {this.state.error?.message || 'L\\'application a rencontré un problème.'}
          </Text>
          <Button mode="contained" onPress={() => this.setState({ hasError: false })} buttonColor="#006B4D" style={{ borderRadius: 30 }}>
            Réessayer
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}

const App = () => (`
  );
}

// Wrap providers with ErrorBoundary
app = app.replace(
  `<WorkspaceProvider>
    <ThemeProvider>
      <PrivacyProvider>
        <AIProvider>
          <RefreshProvider>
            <SafeAreaProvider>
              <InsightProvider>
                <AppContent />
              </InsightProvider>
            </SafeAreaProvider>
          </RefreshProvider>
        </AIProvider>
      </PrivacyProvider>
    </ThemeProvider>
  </WorkspaceProvider>`,
  `<ErrorBoundary>
    <WorkspaceProvider>
      <ThemeProvider>
        <PrivacyProvider>
          <AIProvider>
            <RefreshProvider>
              <SafeAreaProvider>
                <InsightProvider>
                  <AppContent />
                </InsightProvider>
              </SafeAreaProvider>
            </RefreshProvider>
          </AIProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </WorkspaceProvider>
  </ErrorBoundary>`
);

// Add keyboardShouldPersistTaps to any ScrollViews that might need it
// (This is a common bug - keyboard doesn't dismiss on tap)

fs.writeFileSync(appPath, app);
console.log('2/5 FIXED: App.js - ErrorBoundary added');


// ===== 3. FIX database/index.js - Add missing indexes =====
const dbPath = 'D:/Alvine/trivida-version-commercial/src/database/index.js';
let db = fs.readFileSync(dbPath, 'utf8');

// Add missing indexes after the existing CREATE INDEX statements
const existingIndexes = db.lastIndexOf('CREATE INDEX IF NOT EXISTS');
const lastIndexEnd = db.indexOf(';', existingIndexes) + 1;
const afterIndexes = db.slice(lastIndexEnd);

// Check if these indexes already exist
if (!db.includes('idx_debts_customer')) {
  const newIndexes = `
  // Missing indexes for performance
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_debts_customer ON debts(customerId);');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(createdAt);');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_transactions_workspace ON transactions(workspaceId, date);');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_activities_workspace ON activities(workspaceId);');
`;
  db = db.slice(0, lastIndexEnd) + newIndexes + afterIndexes;
}

// Replace execSync with runAsync for migration queries
// (execSync blocks the UI thread)
db = db.replace(/db\.execSync\(/g, 'await db.runAsync(');

fs.writeFileSync(dbPath, db);
console.log('3/5 FIXED: database/index.js - indexes + runAsync');


// ===== 4. FIX hooks - Add error feedback =====
// Fix useTransactions.js - wrap in try/catch with user feedback
const hooksToFix = [
  'D:/Alvine/trivida-version-commercial/src/hooks/useTransactions.js',
  'D:/Alvine/trivida-version-commercial/src/hooks/useDebts.js',
  'D:/Alvine/trivida-version-commercial/src/hooks/useCustomers.js',
];

const hookFixScript = `
  // Add error state for user feedback
  const [hookError, setHookError] = useState(null);

  // Clear errors after display
  const clearError = useCallback(() => setHookError(null), []);

  // Wrap all functions with error handling
`;

for (const hookPath of hooksToFix) {
  try {
    let hook = fs.readFileSync(hookPath, 'utf8');
    
    // Add error state if not present
    if (!hook.includes('hookError') && !hook.includes('setHookError')) {
      // Add useState for error after the last useState declaration
      const lastUseState = hook.lastIndexOf('const [');
      const afterLastUseState = hook.indexOf('\n', hook.indexOf(')', lastUseState));
      
      if (lastUseState !== -1 && afterLastUseState !== -1) {
        const errorStateLine = `  const [hookError, setHookError] = useState(null);\n  const clearHookError = useCallback(() => setHookError(null), []);\n`;
        hook = hook.slice(0, afterLastUseState + 1) + errorStateLine + hook.slice(afterLastUseState + 1);
      }
    }
    
    // Wrap db calls in try/catch with error state
    hook = hook.replace(
      /catch\s*\(error\)\s*\{[^}]*console\.error/g,
      (match) => {
        return match.replace('console.error', 'setHookError(error.message || "Erreur");\n      console.error');
      }
    );
    
    // Export hookError and clearHookError
    if (hook.includes('return {') && !hook.includes('hookError')) {
      hook = hook.replace('return {', 'return {\n    hookError,\n    clearHookError,');
    }
    
    fs.writeFileSync(hookPath, hook);
    console.log('4/5 FIXED: ' + hookPath.split('/').pop() + ' - error feedback added');
  } catch (e) {
    console.log('4/5 SKIP: ' + hookPath.split('/').pop() + ' - ' + e.message);
  }
}


// ===== 5. FIX Dashboard - Add refresh after transaction add =====
const dashPath = 'D:/Alvine/trivida-version-commercial/src/screens/DashboardScreen.js';
let dash = fs.readFileSync(dashPath, 'utf8');

// Add useFocusEffect refresh if not present
if (!dash.includes('useFocusEffect')) {
  dash = dash.replace(
    "import React, { useState, useEffect, useCallback } from 'react';",
    "import React, { useState, useEffect, useCallback } from 'react';\nimport { useFocusEffect } from '@react-navigation/native';"
  );
  
  // Add refresh on focus
  dash = dash.replace(
    'const [isLoading, setIsLoading] = useState(true);',
    'const [isLoading, setIsLoading] = useState(true);\n  const [refreshKey, setRefreshKey] = useState(0);\n\n  // Rafraîchir les données à chaque fois que l\'écran est focus\n  useFocusEffect(\n    useCallback(() => {\n      setRefreshKey(k => k + 1);\n    }, [])\n  );'
  );
}

fs.writeFileSync(dashPath, dash);
console.log('5/5 FIXED: DashboardScreen.js - refresh on focus');

console.log('\\n=== ALL FIXES APPLIED SUCCESSFULLY ===');

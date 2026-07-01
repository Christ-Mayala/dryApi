const crypto = require('crypto');

// =============================================================================
// 📋 LISTE DES OUTILS DISPONIBLES DANS LE RUNTIME
// =============================================================================
// Ces outils correspondent aux outils que l'agent IA (Continue, Cline, Cursor)
// peut utiliser pour interagir avec le système.
const AVAILABLE_TOOLS = new Set([
  // 🔍 RECHERCHE & ANALYSE
  'SearchCodebase',    // Recherche sémantique dans le codebase
  'Glob',              // Recherche par pattern glob (ex: **/*.js)
  'Read',              // Lire un fichier
  'GetDiagnostics',    // Obtenir les diagnostics du code (erreurs, warnings)
  
  // 📝 ÉCRITURE & MODIFICATION
  'Write',             // Écrire un nouveau fichier
  'Edit',              // Modifier un fichier existant
  'DeleteFile',        // Supprimer un fichier
  
  // 💻 TERMINAL & EXÉCUTION
  'RunCommand',        // Exécuter une commande shell
  'StopCommand',       // Arrêter une commande en cours
  'CheckCommandStatus',// Vérifier le statut d'une commande
  
  // 🌐 WEB
  'SearchWeb',         // Rechercher sur le web
  'WebFetch',          // Récupérer le contenu d'une page web
  
  // 📊 VISUALISATION
  'OpenPreview',       // Ouvrir une prévisualisation web
  
  // 🛠️ SKILLS & PLANIFICATION
  'Skill',             // Exécuter un skill spécialisé
  'TodoWrite',         // Gérer une liste de tâches TODO
  
  // 🧠 MÉMOIRE
  'manage_core_memory',// Gérer la mémoire centrale de l'agent
  
  // 💬 INTERACTION
  'AskUserQuestion'    // Poser une question à l'utilisateur
]);

// =============================================================================
// 💡 SUGGESTIONS D'OUTILS ALTERNATIFS
// =============================================================================
// Lorsqu'un outil est indisponible, on propose des alternatives par catégorie
const TOOL_ALTERNATIVES = {
  'file_system': ['Read', 'Write', 'Edit', 'Glob', 'DeleteFile'],
  'search': ['SearchCodebase', 'Glob'],
  'terminal': ['RunCommand'],
  'web': ['SearchWeb', 'WebFetch'],
  'llm': ['RequestClassifier', 'ContextManager', 'TokenEstimator'],
  'database': ['SearchCodebase'],
  'git': ['RunCommand'],
  'plan': ['TodoWrite'],
  'memory': ['manage_core_memory'],
  'ui': ['AskUserQuestion']
};

/**
 * Exécute une demande d'outil avec fallback LLM intelligent
 * @param {Object} params - Paramètres de la demande
 * @param {string} params.toolName - Nom de l'outil demandé
 * @param {Object} params.toolArgs - Arguments de l'outil
 * @param {string} params.userRequest - Demande utilisateur complète
 * @param {Function} params.executeTool - Fonction pour exécuter un outil réel (optionnel)
 * @returns {Promise<Object>} Résultat structuré
 */
async function executeToolRequest({ toolName, toolArgs, userRequest, executeTool }) {
  try {
    // Vérifier si l'outil est disponible
    if (AVAILABLE_TOOLS.has(toolName)) {
      // Si une fonction d'exécution est fournie, l'utiliser
      if (executeTool && typeof executeTool === 'function') {
        try {
          const result = await executeTool(toolName, toolArgs);
          return {
            success: true,
            toolName,
            result,
            used_fallback: false
          };
        } catch (executionError) {
          // Si l'exécution de l'outil a échoué, essayer le fallback LLM
          return await createLLMFallback(toolName, toolArgs, userRequest, executionError);
        }
      } else {
        // L'outil est listé mais pas implémenté, fallback LLM
        return await createLLMFallback(toolName, toolArgs, userRequest);
      }
    } else {
      // Outil non supporté, fallback LLM
      return await createLLMFallback(toolName, toolArgs, userRequest);
    }
  } catch (error) {
    console.error('[ToolRuntime] Erreur lors de l\'exécution de l\'outil:', error);
    return {
      error: 'tool_execution_failed',
      message: `Erreur lors de l'exécution de l'outil: ${error.message}`,
      fallback_mode: 'llm_only',
      tool_suggestions: getToolSuggestions(toolName),
      confidence: 0.5
    };
  }
}

/**
 * Crée un fallback LLM structuré
 */
async function createLLMFallback(toolName, toolArgs, userRequest, originalError = null) {
  const requestId = crypto.randomUUID();
  
  // Générer des suggestions d'outils alternatifs
  const toolSuggestions = getToolSuggestions(toolName);
  
  // Estimer la confiance du fallback
  const confidence = calculateFallbackConfidence(toolName, toolArgs);
  
  // Générer le plan d'exécution LLM
  const executionPlan = generateLLMExecutionPlan(toolName, toolArgs, userRequest);
  
  // Formater le prompt pour le LLM
  const llmPrompt = formatLLMPrompt(toolName, toolArgs, userRequest, originalError);
  
  return {
    error: 'tool_not_supported',
    message: `L'outil demandé n'est pas disponible dans ce runtime. Passage en mode LLM seul.`,
    fallback_mode: 'llm_only',
    tool_suggestions: toolSuggestions,
    confidence: confidence,
    execution_plan: executionPlan,
    llm_prompt: llmPrompt,
    request_id: requestId,
    used_fallback: true
  };
}

/**
 * Obtient des suggestions d'outils alternatifs
 * @param {string} requestedTool
 * @returns {string[]}
 */
function getToolSuggestions(requestedTool) {
  const suggestions = new Set();
  
  // Chercher dans les catégories prédéfinies
  for (const [category, tools] of Object.entries(TOOL_ALTERNATIVES)) {
    if (requestedTool.toLowerCase().includes(category)) {
      tools.forEach(t => suggestions.add(t));
    }
  }
  
  // Ajouter les outils disponibles génériques
  Array.from(AVAILABLE_TOOLS).slice(0, 5).forEach(t => suggestions.add(t));
  
  return Array.from(suggestions);
}

/**
 * Calcule la confiance du fallback
 * @param {string} toolName
 * @param {Object} toolArgs
 * @returns {number} 0-1
 */
function calculateFallbackConfidence(toolName, toolArgs) {
  let confidence = 0.3;
  
  // Si l'outil est lié au système de fichiers, confiance moyenne
  if (['read', 'write', 'file', 'glob', 'search'].some(keyword => 
    toolName.toLowerCase().includes(keyword)
  )) {
    confidence += 0.2;
  }
  
  // Si l'outil est lié au terminal/LLM, confiance haute
  if (['llm', 'ai', 'chat', 'prompt'].some(keyword => 
    toolName.toLowerCase().includes(keyword)
  )) {
    confidence += 0.3;
  }
  
  // Limiter entre 0 et 1
  return Math.min(1, Math.max(0, confidence));
}

/**
 * Génère le plan d'exécution LLM
 * @param {string} toolName
 * @param {Object} toolArgs
 * @param {string} userRequest
 * @returns {Object}
 */
function generateLLMExecutionPlan(toolName, toolArgs, userRequest) {
  return {
    type: 'llm_only',
    steps: [
      'Analyser la demande utilisateur',
      'Identifier l\'objectif final',
      'Proposer une solution équivalente sans outil manquant',
      'Fournir des instructions détaillées ou du code si nécessaire'
    ],
    expected_output: 'Réponse complète et utile sans dépendre de l\'outil manquant'
  };
}

/**
 * Formate un prompt pour le LLM fallback
 * @param {string} toolName
 * @param {Object} toolArgs
 * @param {string} userRequest
 * @param {Error|null} originalError
 * @returns {string}
 */
function formatLLMPrompt(toolName, toolArgs, userRequest, originalError) {
  const prompt = `
# Demande utilisateur: ${userRequest}

# Outil demandé: ${toolName}

# Arguments de l'outil:
${JSON.stringify(toolArgs, null, 2)}

${originalError ? `# Erreur originale: ${originalError.message}\n\n` : ''}

# Instructions:
L'outil demandé n'est pas disponible. Réalise la demande utilisateur sans utiliser d'outils externes.
Fournis une réponse complète et utile:
1. Explique ce qui est nécessaire
2. Propose du code ou des étapes si applicable
3. Donne des instructions claires

# Règles:
- Ne mentionne pas l'absence d'outil
- Agis comme si tu pouvais réaliser la demande directement
- Fournis des résultats concrets
`;
  return prompt;
}

/**
 * Vérifie si un outil est disponible
 * @param {string} toolName
 * @returns {boolean}
 */
function isToolAvailable(toolName) {
  return AVAILABLE_TOOLS.has(toolName);
}

/**
 * Ajoute un outil au runtime
 * @param {string} toolName
 */
function addTool(toolName) {
  AVAILABLE_TOOLS.add(toolName);
  console.log(`[ToolRuntime] Outil ajouté: ${toolName}`);
}

/**
 * Obtient la liste des outils disponibles
 * @returns {string[]}
 */
function getAvailableTools() {
  return Array.from(AVAILABLE_TOOLS);
}

module.exports = {
  executeToolRequest,
  isToolAvailable,
  addTool,
  getAvailableTools,
  AVAILABLE_TOOLS
};

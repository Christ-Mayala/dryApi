# 🚀 FREELLM - RÉSUMÉ COMPLET DU SYSTÈME D'INFERENCE OS

---

## 📌 Aperçu Général
FreeLLM est un système d'**Inference Operating System** multi-fournisseurs LLM, conçu pour :
1. Reduire drastiquement la consommation de tokens
2. Optimiser la latence et la stabilité
3. Gérer le routage intelligent et les retours en arrière
4. Fournir une API compatible OpenAI prête pour les IDE agents (Continue, Cline, Cursor, Windsurf)

---

## 📁 Structure du Projet
```
dryApp/FreeLLM/
├── core/
│   ├── routes/          # Routes API (inferenceOsProxy.js, etc.)
│   ├── services/        # Services métier (toolRuntime.js, keyPoolManager.js, etc.)
│   ├── providers/       # Fournisseurs LLM (google.js, openai-compat.js, etc.)
│   ├── lib/             # Utilitaires (crypto.js)
│   └── types.js
├── features/            # Modèles et logique métier
│   ├── models/
│   ├── apiKeys/
│   ├── fallbackConfig/
│   ├── requests/
│   ├── conversations/
│   ├── conversationMessages/
│   ├── settings/
│   └── admin/
├── seed.js
├── addons.js
├── index.js
└── README.md
```

---

## 🎯 Composants Principaux & Fonctionnalités

---

### 1. 🔄 Tool Runtime (core/services/toolRuntime.js)
**Rôle**: Gérer l'exécution d'outils pour les agents IA, avec fallback LLM intelligent.

#### 📋 Outils Disponibles
| Catégorie          | Outils                                                                 |
|--------------------|-----------------------------------------------------------------------|
| 🔍 Recherche       | `SearchCodebase`, `Glob`, `Read`, `GetDiagnostics`                    |
| 📝 Écriture        | `Write`, `Edit`, `DeleteFile`                                         |
| 💻 Terminal        | `RunCommand`, `StopCommand`, `CheckCommandStatus`                     |
| 🌐 Web             | `SearchWeb`, `WebFetch`                                               |
| 📊 Visualisation   | `OpenPreview`                                                         |
| 🛠️ Skills/Planif   | `Skill`, `TodoWrite`                                                  |
| 🧠 Mémoire         | `manage_core_memory`                                                  |
| 💬 Interaction     | `AskUserQuestion`                                                     |

#### 🛡️ Fonctionnalités Clés
- **Fallback LLM Structuré**: Si un outil échoue ou n'existe pas, retourne un objet complet avec :
  ```json
  {
    "error": "tool_not_supported",
    "message": "...",
    "fallback_mode": "llm_only",
    "tool_suggestions": ["...", "..."],
    "confidence": 0.5,
    "execution_plan": {...},
    "llm_prompt": "...",
    "request_id": "...",
    "used_fallback": true
  }
  ```
- **Suggestions Alternatives**: Par catégorie (file_system, search, terminal, etc.)
- **Confiance Dynamique**: Basée sur le type d'outil demandé

---

### 2. 🔑 Key Pool Manager (core/services/keyPoolManager.js)
**Rôle**: Gestion intelligente des API keys par fournisseur.

#### 📋 Fonctionnalités
- **Score Dynamique**: Par clé (taux de succès, latence)
- **Decay Temporel**: Les métriques vieux de plus d'une heure sont réduites de 50%
- **Cooldown Automatique**: Après erreurs répétées
- **Priorité pour IDE Mode**: Boost pour fournisseurs rapides (Groq, NVIDIA, Cerebras, etc.)

#### 📊 Metriques Collectées
- Nombre de requêtes total
- Taux de succès
- Latence moyenne
- Erreurs récentes
- Date de dernière utilisation

---

### 3. ⚡ Fast Path Layer (core/services/fastPathLayer.js)
**Rôle**: Bypass complet de l'orchestration pour les requêtes triviales/rapides.

#### 🚀 Cas Bypass
1. **Cache Hit**: Si la requête (temperature = 0) est déjà en cache
2. **Requête Triviale**: Salutations, remerciements, etc.

---

### 4. 🧠 Context Manager (core/services/contextManager.js)
**Rôle**: Gestion intelligente de la mémoire conversationnelle pour réduire les tokens.

#### 🛠️ Fonctionnalités
- **Fenêtre Glissante**: Ne garde que les messages récents
- **Résumé Compressé**: Pour la vieille conversation
- **Élimination Messages Non Essentiels**: Filtrage intelligent
- **Objectif**: Réduction ≥ 50% des tokens en entrée

---

### 5. 📊 Token Estimator (core/services/tokenEstimator.js)
**Rôle**: Estimer les tokens avant la requête pour éviter les dépassements.

#### 🔍 Fonctionnalités
- Estimation temps réel des tokens
- Vérification des limites par fournisseur
- Compression automatique du contexte si nécessaire
- Budgets par type de tâche (chat, code, reasoning, summary, traduction)

---

### 6. 🎯 Request Classifier (core/services/requestClassifier.js)
**Rôle**: Classifier la requête pour optimiser le routage.

#### 📋 Types de Tâches Détectés
- `chat` (confiance 1.0 par défaut)
- `code`
- `reasoning`
- `summary`
- `traduction`

---

### 7. 🚦 Circuit Breaker (core/services/circuitBreaker.js)
**Rôle**: Protéger le système des échecs répétés des fournisseurs.

#### 🛡️ Fonctionnalités
- Détection d'échecs
- Mise en pause temporaire des fournisseurs problématiques
- Redémarrage automatique après un délai

---

### 8. 📈 Performance Metrics (core/services/performanceMetrics.js)
**Rôle**: Collecter et analyser les métriques de performance.

#### 📊 Metriques Suivies
- Taux de succès par fournisseur/modèle
- Latence moyenne
- Tokens consommés (entrée/sortie)
- Cache hit rate

---

### 9. 💾 Response Cache (core/services/responseCache.js)
**Rôle**: Mettre en cache les réponses pour les requêtes déterministes (temperature = 0).

#### 🗄️ Fonctionnalités
- Génération clé unique par requête
- TTL par défaut configurable
- Économies massives de tokens et de latence

---

### 10. 🧭 Router (core/services/router.js)
**Rôle**: Sélectionner le meilleur fournisseur/modèle/clé pour chaque requête.

#### 🎯 Critères de Sélection
1. Priorité IDE Mode (si applicable)
2. Taux de succès historique
3. Latence moyenne
4. Score dynamique du Key Pool Manager
5. Sticky sessions pour les conversations multi-tours

---

### 11. ⚙️ IDE Mode (core/services/ideMode.js)
**Rôle**: Optimiser le système pour les agents d'IDE (Continue, Cline, Cursor, Windsurf, Zoo Code).

#### 🚀 Optimisations
- Bypass du Request Classifier
- Bypass du Context Manager
- Priorité massive aux fournisseurs rapides
- Timeout réduit (5s max)

---

### 12. 🔒 Inference OS Proxy (core/routes/inferenceOsProxy.js)
**Rôle**: Point d'entrée principal compatible OpenAI.

#### 📋 Routes Principales
| Route               | Méthode | Description                                      |
|---------------------|---------|--------------------------------------------------|
| `/v1/models`        | GET     | Liste des modèles disponibles                    |
| `/v1/chat/completions` | POST  | Envoyer une requête de chat (compatible OpenAI) |
| `/v1/tools`         | GET     | Liste des outils disponibles                     |
| `/v1/tools/execute` | POST    | Exécuter un outil avec fallback LLM             |

#### 🛡️ Controles & Optimisations
- **Budget Global Tokens**: 1.000.000 tokens par conversation (TTL 24h)
- **Ignore Erreurs Aborted**: Interruptions utilisateur non comptées comme échecs
- **Max Fallback**: 1 seul fallback par requête
- **Logs Structurés**: Toutes les requêtes sont tracées avec request_id unique

---

### 13. 📄 Autres Routes API
| Route               | Description                                      |
|---------------------|--------------------------------------------------|
| `/api/user`         | Authentification et gestion des utilisateurs    |
| `/api/keys`         | Gestion des API keys                             |
| `/api/fallback`     | Configuration du fallback                        |
| `/api/analytics`    | Analytiques de performance                       |
| `/api/settings`     | Paramètres du système                            |
| `/api/health`       | Vérification de santé                            |
| `/api/conversations`| Gestion des conversations                        |
| `/api/pdf`          | Traitement de fichiers PDF                       |

---

## 🔄 Flux d'Exécution d'une Requête (Simplifié)
```
Request
  ↓
1. Fast Path Layer (cache hit ? requête triviale ?)
  ↓ Oui → Réponse immédiate
  ↓ Non
2. Conversation Token Budget Check
  ↓
3. Request Classifier (si pas IDE Mode)
  ↓
4. Context Manager (si pas IDE Mode)
  ↓
5. Router + Key Pool Manager → Meilleur fournisseur/modèle/clé
  ↓
6. Token Estimator Check → Compression si nécessaire
  ↓
7. Provider Call + Circuit Breaker
  ↓
8. Metrics Collection & Logging
  ↓
9. Response Cache (si applicable)
  ↓
Réponse OpenAI Compatible
```

---

## 🛢️ Modèles de Données (Features)
| Modèle               | Description                                      |
|----------------------|--------------------------------------------------|
| `Models`             | Modèles LLM disponibles                          |
| `ApiKeys`            | API keys des fournisseurs (encryptées)           |
| `FallbackConfig`     | Configuration du fallback et priorités           |
| `Requests`           | Historique des requêtes                          |
| `Settings`           | Paramètres utilisateurs                          |
| `SystemSettings`     | Paramètres système admin                         |
| `Conversations`      | Conversations utilisateur                        |
| `ConversationMessages` | Messages individuels des conversations         |

---

## 🎯 Objectifs Atteints
✅ API 100% compatible OpenAI<br>
✅ Réduction massive de la consommation de tokens<br>
✅ Latence optimisée, notamment pour IDE Mode<br>
✅ Gestion multi-fournisseurs avec Key Pool Manager<br>
✅ Fallback intelligent avec max 1 niveau<br>
✅ Circuit Breaker pour stabilité<br>
✅ System complet pour agents IDE<br>
✅ Tool Runtime avec fallback LLM structuré<br>
✅ Observabilité complète et logs structurés<br>

---

## 🚀 Utilisation Rapide
1. **Démarrer le serveur**: `npm run dev`
2. **Vérifier la santé**: `GET /api/health/ready`
3. **Utiliser le proxy**: `POST /v1/chat/completions` (format OpenAI)
4. **Voir les outils**: `GET /v1/tools`
5. **Exécuter un outil**: `POST /v1/tools/execute`

---

## 🌐 Fournisseurs Supportés (Free Tier)
Les fournisseurs disponibles sont configurés via les modèles et les API keys.
Exemples :
- Groq
- NVIDIA
- Cerebras
- SambaNova
- OpenRouter
- Mistral
- Google (Gemini)
- GitHub Models
- Cohere
- Cloudflare
- Et bien d'autres !

---

## 📚 Glossaire
| Terme               | Définition                                      |
|---------------------|-------------------------------------------------|
| **Inference OS**    | Système d'exploitation pour inférence LLM       |
| **Sticky Session**  | Même fournisseur pour une conversation multi-tours |
| **Circuit Breaker** | Protection contre échecs répétés                |
| **Key Pool**        | Ensemble de clés API avec scoring dynamique    |
| **Fast Path**       | Bypass de l'orchestration pour requêtes rapides|
| **Fallback**        | Fournisseur/modèle de remplacement en cas d'échec|

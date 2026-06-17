# Phase 5 — IA Avancée pour Trivida

## Objectif

Améliorer l'intelligence artificielle de Trivida en exploitant les données historiques stockées dans MongoDB pour des analyses financières plus approfondies et personnalisées.

---

## 1. Endpoints d'analyse à créer

### `/api/v1/trivida/ai/analyze`
**POST** - Analyse financière complète avec historique

**Payload :**
```json
{
  "period": "last_6_months",
  "includeTransactions": true,
  "includeActivities": true,
  "includeDebts": true
}
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalIncome": 2500000,
      "totalExpenses": 1800000,
      "netSavings": 700000,
      "averageMonthlyIncome": 416666,
      "averageMonthlyExpenses": 300000
    },
    "trends": {
      "income": "increasing",
      "expenses": "stable",
      "savings": "increasing"
    },
    "insights": [
      "Votre épargne a augmenté de 15% ce mois-ci",
      "Vos dépenses en Transport sont 30% plus élevées que la moyenne"
    ],
    "recommendations": [
      "Continuez à maintenir ce niveau d'épargne",
      "Considérez des alternatives pour réduire les frais de transport"
    ]
  }
}
```

---

### `/api/v1/trivida/ai/chat`
**POST** - Chat IA avec contexte MongoDB

**Payload :**
```json
{
  "message": "Quel est mon pattern de dépenses alimentaires ?",
  "includeContext": true
}
```

**Backend :**
1. Récupérer l'historique de l'utilisateur
2. Construire un prompt enrichi avec les données
3. Appeler l'API DryApi avec le contexte
4. Mettre en cache la réponse

---

### `/api/v1/trivida/ai/predict`
**POST** - Prédictions financières

**Payload :**
```json
{
  "type": "spending",
  "category": "Alimentation",
  "horizon": "next_month"
}
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "prediction": 85000,
    "confidence": 0.87,
    "factors": [
      "Basé sur 6 mois d'historique",
      "Tendance stable",
      "Pas d'événement exceptionnel détecté"
    ]
  }
}
```

---

## 2. Amélioration du contexte IA

### Actuellement (AIContext.js mobile)
```javascript
const systemPromptWithContext = FINANCIAL_EXPERT_SYSTEM_PROMPT + `
📊 Situation Financière :
- Fortune Totale : ${summaryData.balance} XAF
- Dépenses du mois : ${summaryData.spent} XAF
...
`;
```

### Avec MongoDB (via API)
```javascript
// Appel API pour récupérer le contexte enrichi
const context = await authenticatedFetch('/ai/context');

// context.data contient :
{
  "current": { ... },
  "history": {
    "last6Months": {
      "transactions": 450,
      "avgIncome": 400000,
      "avgExpenses": 280000,
      "topCategories": ["Alimentation", "Transport", "Loisirs"]
    }
  },
  "patterns": {
    "spendingTrend": "stable",
    "savingsTrend": "increasing",
    "unusualActivity": false
  }
}
```

---

## 3. Cache intelligent côté serveur

### Structure Redis
```javascript
// Cache des réponses IA par utilisateur et question
const cacheKey = `trivida:ai:${userId}:${hash(query)}`;

// TTL : 24h pour les analyses générales, 1h pour les prédictions
redis.setex(cacheKey, 86400, JSON.stringify(response));
```

### Invalidation
- Après une sync importante (> 10 transactions)
- Une fois par jour automatiquement
- Manuellement par l'utilisateur

---

## 4. Analyses avancées

### 4.1 Détection d'anomalies
```javascript
// Endpoint: /api/v1/trivida/ai/anomalies
{
  "anomalies": [
    {
      "type": "unusual_expense",
      "transaction_id": "...",
      "amount": 150000,
      "category": "Loisirs",
      "deviation": "+250%",
      "explanation": "Dépense 250% plus élevée que votre moyenne mensuelle"
    }
  ]
}
```

### 4.2 Scoring financier
```javascript
// Endpoint: /api/v1/trivida/ai/score
{
  "score": 78,
  "level": "Bon",
  "breakdown": {
    "savings_rate": 85,
    "debt_management": 90,
    "budget_adherence": 65,
    "income_stability": 72
  },
  "tips": [
    "Votre taux d'épargne est excellent (28%)",
    "Vous dépassez régulièrement votre budget (+15%)"
  ]
}
```

### 4.3 Projections
```javascript
// Endpoint: /api/v1/trivida/ai/projection
{
  "projection": {
    "next_month": {
      "income": 450000,
      "expenses": 320000,
      "savings": 130000,
      "confidence": 0.85
    },
    "next_3_months": {
      "income": 1350000,
      "expenses": 960000,
      "savings": 390000,
      "confidence": 0.72
    }
  }
}
```

---

## 5. Optimisation du prompt

### Prompt actuel (court)
Le prompt actuel dans AIContext.js demande un résumé court. C'est bien pour le dashboard.

### Nouveau prompt (analytique)
Pour les analyses approfondies, créer un nouveau prompt :

```javascript
const ANALYTICAL_PROMPT = `Tu es un analyste financier CFA niveau 3, spécialisé en finances personnelles et en conseil stratégique.

MISSION :
Analyser en profondeur les données financières d'un utilisateur et fournir des recommandations actionnables basées sur :
- Historique de 6 mois minimum
- Patterns de comportement
- Tendances du marché local (Congo/Afrique)
- Objectifs financiers déclarés

FORMAT DE RÉPONSE :
1. 📊 ANALYSE QUANTITATIVE
   - Métriques clés (ROI, taux d'épargne, liquidité)
   - Comparaison avec les moyennes locales
   - Évolution temporelle

2. 🔍 ANALYSE QUALITATIVE
   - Patterns comportementaux identifiés
   - Forces et faiblesses
   - Opportunités et risques

3. 💡 RECOMMANDATIONS STRATÉGIQUES
   - Actions immédiates (< 1 mois)
   - Actions moyen terme (3-6 mois)
   - Actions long terme (1 an+)

4. ⚠️ ALERTES
   - Risques détectés
   - Anomalies
   - Points de vigilance
`;
```

---

## 6. Interface mobile améliorée

### 6.1 Nouveau screen : AIInsightsScreen

```javascript
// Affiche :
- Score financier (gauge circulaire)
- Top 3 insights du mois
- Graphique de tendance
- Recommandations personnalisées
- Bouton "Analyse complète"
```

### 6.2 Chatbot enrichi

Modifier AIChatScreen.js pour :
- Afficher le contexte utilisé (toggle)
- Proposer des questions suggérées
- Historique des conversations (stocké en MongoDB)
- Export des analyses en PDF

---

## 7. Implémentation progressive

### Étape 1 (1 semaine)
- [ ] Créer `/api/v1/trivida/ai/analyze`
- [ ] Créer `/api/v1/trivida/ai/context`
- [ ] Modifier AIContext.js pour utiliser le contexte enrichi

### Étape 2 (1 semaine)
- [ ] Implémenter le cache Redis
- [ ] Créer `/api/v1/trivida/ai/score`
- [ ] Créer AIInsightsScreen côté mobile

### Étape 3 (2 semaines)
- [ ] Créer `/api/v1/trivida/ai/predict`
- [ ] Créer `/api/v1/trivida/ai/anomalies`
- [ ] Historique des conversations

---

## 8. Coûts et limites

### Tokens DryApi
- Analyse courte (dashboard) : ~500 tokens
- Analyse approfondie : ~2000 tokens
- Chat avec contexte : ~1500 tokens/message

### Stratégie d'optimisation
1. **Cache agressif** : TTL de 24h pour les analyses
2. **Résumés pré-calculés** : Stocker des métriques agrégées
3. **Requêtes ciblées** : Ne charger que les données nécessaires
4. **Batch processing** : Analyses nocturnes pour tous les users Premium

---

## 9. Exemples concrets

### Question : "Puis-je me permettre d'acheter une voiture à 5M XAF ?"

**Contexte envoyé à l'IA :**
- Revenu moyen : 450K XAF/mois
- Épargne actuelle : 2M XAF
- Dépenses fixes : 280K XAF/mois
- Taux d'épargne : 28%
- Dettes actuelles : 0 XAF

**Réponse de l'IA :**
```
📊 ANALYSE RAPIDE

Avec votre revenu actuel de 450K XAF/mois et un taux d'épargne de 28%, 
voici mon analyse :

✅ FAISABILITÉ À COURT TERME (0-6 mois)
- Apport : 2M XAF (40% du prix)
- Reste à financer : 3M XAF
- Mensualité estimée : ~100K XAF sur 36 mois
- Capacité d'endettement : OK (ratio 35%)

⚠️ POINTS D'ATTENTION
- Réduirait votre épargne mensuelle de 50%
- Coûts additionnels : assurance (40K/mois), carburant (60K/mois), entretien
- Budget total voiture : ~200K XAF/mois

💡 RECOMMANDATION
Je vous conseille d'attendre 6 mois supplémentaires pour :
1. Augmenter votre apport à 2.5M (éviter le crédit)
2. Constituer un fonds d'urgence de 1M XAF
3. Négocier une augmentation ou revenus complémentaires

🎯 ALTERNATIVE
Envisagez un véhicule à 3M XAF avec apport de 2M. 
Budget mensuel réduit à 120K, plus gérable.
```

---

## 10. Mesure du succès

### KPIs à suivre
- Taux d'utilisation de l'IA (% users actifs)
- Satisfaction des réponses (rating 1-5)
- Temps moyen de réponse
- Taux de conversion (insights → actions)
- Coût par analyse (tokens)

### Feedback loop
- Bouton "Cette analyse m'a aidé" (oui/non)
- Champ de commentaire optionnel
- Analytics des questions les plus fréquentes

---

**Note** : Cette phase nécessite une API key DryApi valide et idéalement un cache Redis pour optimiser les coûts.

# Trivida Backend

Application backend pour Trivida - Gestion financière personnelle et business.

## 🎯 Statut de l'intégration

### ✅ Phase 1 - Authentification (TERMINÉE)
- Inscription, connexion, gestion de profil
- JWT avec refresh automatique
- 7 jours Premium gratuits
- Mode invité supporté

### ✅ Phase 2 - Synchronisation (TERMINÉE)
- Endpoints `/push`, `/pull`, `/stats`
- Batch sync (INSERT/UPDATE/DELETE)
- Gestion des conflits

### ✅ Phase 3 - Schémas MongoDB (TERMINÉE)
- Transactions, Customers, Activities, Debts, Savings Goals
- Partitionnement par userId
- Soft delete, timestamps, index optimisés

### 🚧 Phase 4 - Fonctionnalités Cloud (EN COURS)
- Backup automatique
- Multi-device
- Notifications push

### 🔜 Phase 5 - IA Améliorée
- Analyses approfondies avec historique MongoDB
- Prédictions financières
- Chat contextuel enrichi
- Voir `PHASE_5_IA_AVANCEE.md`

---

## Architecture

Cette app suit le pattern DRY :
- **features/** : modules métier (auth, transactions, sync, etc.)
- **utils/** : utilitaires spécifiques à Trivida
- **validation/** : schémas de validation Joi

---

## Endpoints disponibles

### 🔐 Auth (`/api/v1/trivida/auth`)
- `POST /register` - Inscription (7j Premium gratuits)
- `POST /login` - Connexion
- `POST /refresh` - Refresh token
- `GET /profile` - Profil utilisateur
- `PATCH /profile` - Mise à jour profil
- `PATCH /password` - Changer mot de passe
- `POST /logout` - Déconnexion

### 🔄 Sync (`/api/v1/trivida/sync`)
- `POST /push` - Envoyer modifications locales (batch)
- `GET /pull?since=timestamp` - Récupérer modifications serveur
- `GET /stats` - Statistiques de sync

### 📊 Entités MongoDB
- **Transaction** : Revenus, dépenses, prêts, remboursements
- **Customer** : Clients business
- **Activity** : Activités commerciales
- **Debt** : Prêts et emprunts
- **SavingsGoal** : Objectifs d'épargne

---

## Mode offline-first

L'app mobile Trivida fonctionne 100% hors ligne. La synchronisation avec ce backend est **optionnelle** et permet :

✅ Backup automatique dans le cloud  
✅ Synchronisation multi-device  
✅ Partage d'activités business  
✅ Analyse IA avancée avec historique  
✅ Notifications push  

---

## Installation & Démarrage

### Prérequis
- Node.js 18+
- MongoDB 6+
- Redis (optionnel, pour le cache IA)

### Configuration

1. **Cloner et installer**
   ```bash
   cd dryApi
   npm install
   ```

2. **Configurer `.env`**
   ```env
   MONGO_URI=mongodb://localhost:27017/dryapi
   JWT_SECRET=votre_secret_jwt_très_très_long
   SESSION_SECRET=votre_secret_session_très_très_long
   SYSTEM_PASSWORD=votre_mot_de_passe_admin
   ```

3. **Démarrer MongoDB**
   ```bash
   # Windows
   net start MongoDB

   # Linux/Mac
   sudo systemctl start mongod
   ```

4. **Lancer le serveur**
   ```bash
   npm run dev
   ```

Le serveur démarre sur `http://localhost:5000`

---

## Tests manuels

### Test authentification
```bash
# Inscription
curl -X POST http://localhost:5000/api/v1/trivida/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@trivida.app",
    "password": "Test123!",
    "telephone": "+243999999999"
  }'

# Connexion
curl -X POST http://localhost:5000/api/v1/trivida/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@trivida.app",
    "password": "Test123!"
  }'

# Récupérer le token dans la réponse, puis :

# Profil
curl -X GET http://localhost:5000/api/v1/trivida/auth/profile \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

### Test synchronisation
```bash
# Push (envoyer des modifications)
curl -X POST http://localhost:5000/api/v1/trivida/sync/push \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI" \
  -H "Content-Type: application/json" \
  -d '{
    "operations": [
      {
        "entity": "transaction",
        "localId": 1,
        "operation": "INSERT",
        "payload": {
          "type": "depense",
          "category": "Alimentation",
          "amount": 5000,
          "date": "2026-06-17T12:00:00.000Z",
          "description": "Courses"
        },
        "timestamp": 1718629200000
      }
    ]
  }'

# Stats
curl -X GET http://localhost:5000/api/v1/trivida/sync/stats \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

---

## Vérification dans MongoDB

```javascript
// Connexion à MongoDB
mongosh

// Sélectionner la base
use dryapi

// Collections créées automatiquement au bootstrap :
show collections
// → trivida_users
// → trivida_transactions
// → trivida_customers
// → trivida_activities
// → trivida_debts
// → trivida_savingsgoals

// Voir les utilisateurs
db.trivida_users.find().pretty()

// Voir les transactions d'un user
db.trivida_transactions.find({ 
  userId: ObjectId("VOTRE_USER_ID_ICI") 
}).pretty()
```

---

## Architecture de synchronisation

### Flux Push (Mobile → Serveur)

```
Mobile                    Serveur
  │                         │
  ├─ Opération locale      │
  │  (INSERT/UPDATE/DELETE)│
  │                         │
  ├─ Ajout à sync_queue    │
  │                         │
  ├─ Détection réseau ✅   │
  │                         │
  ├─ POST /sync/push ──────►│
  │  (batch de 50 ops max)  │
  │                         │
  │                         │◄─ Validation
  │                         │◄─ Création MongoDB
  │                         │◄─ Retour IDs serveur
  │                         │
  │◄─────────────────────── │
  │  { results, errors }    │
  │                         │
  ├─ Marquage syncedAt     │
  │                         │
```

### Flux Pull (Serveur → Mobile)

```
Mobile                    Serveur
  │                         │
  ├─ GET /sync/pull ───────►│
  │  ?since=timestamp       │
  │                         │
  │                         │◄─ Recherche MongoDB
  │                         │   (updatedAt >= since)
  │                         │
  │◄─────────────────────── │
  │  { changes: [...] }     │
  │                         │
  ├─ Application locale    │
  │  (INSERT/UPDATE/DELETE)│
  │                         │
```

---

## Sécurité

### Authentification
- ✅ JWT avec expiration (1h)
- ✅ Refresh token avec rotation
- ✅ Hashage bcrypt (12 rounds)
- ✅ Rate limiting (5 tentatives/15min)
- ✅ Verrouillage compte (2h après 5 échecs)

### Autorisation
- ✅ Middleware `protect` sur toutes les routes sensibles
- ✅ Filtrage par `userId` automatique
- ✅ Soft delete (pas de vraies suppressions)
- ✅ Audit trail sur toutes les actions

### Données
- ✅ Validation des payloads (Joi)
- ✅ Sanitization MongoDB (prevent injection)
- ✅ HTTPS en production
- 🔜 Chiffrement des données sensibles au repos

---

## Performance

### Index MongoDB
Tous les schémas incluent des index optimisés :
- `userId` (partitionnement)
- `userId + date` (requêtes chronologiques)
- `userId + type` (filtres par catégorie)
- `createdAt`, `updatedAt` (sync)

### Limites
- Sync push : 50 opérations max par batch
- Sync pull : 100 documents max par entité
- Cache IA : 24h (Redis)

---

## Monitoring

### Logs
Les logs incluent :
- Requêtes HTTP (morgan)
- Opérations de sync
- Erreurs avec stack trace
- Audit trail

### Métriques
- Nombre d'utilisateurs actifs
- Nombre de sync par jour
- Latence moyenne des endpoints
- Taux d'erreur

---

## Contribution

### Structure de feature
```
features/
└── nom_feature/
    ├── controller/
    │   └── feature.controller.js
    ├── model/
    │   └── feature.schema.js
    ├── route/
    │   └── feature.routes.js
    └── validation/
        └── feature.validation.js
```

### Conventions
- Noms en camelCase
- Commentaires en français
- Logs explicites
- Tests unitaires (TODO)

---

## Support

Pour toute question :
- 📧 Email : support@trivida.app
- 📱 WhatsApp : +243 XXX XXX XXX
- 📚 Documentation complète : voir `../trivida-v2/INTEGRATION_TRIVIDA_DRYAPI.md`

---

**Version** : 1.0.0  
**Auteur** : Alvine (avec Kiro AI)  
**Date** : Juin 2026

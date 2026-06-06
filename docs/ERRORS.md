# Codes d'Erreur API

Documentation exhaustive des codes d'erreur retournés par l'API DRY.

---

## Format de Réponse

```json
{
  "success": false,
  "message": "Description de l'erreur",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

---

## 400 Bad Request

| Code | Statut HTTP | Description | Cause |
|------|------------|-------------|-------|
| `INVALID_INPUT` | 400 | Données d'entrée invalides | Validation échouée |
| `MISSING_REQUIRED_FIELD` | 400 | Champ obligatoire manquant | Corps de requête incomplet |
| `INVALID_JSON` | 400 | JSON malformé | Syntaxe JSON invalide |
| `INVALID_CONTENT_TYPE` | 415 | Type de contenu non supporté | Content-Type incorrect |
| `PAYLOAD_TOO_LARGE` | 413 | Payload trop volumineux | Dépassement limite 10MB |
| `INVALID_PARAMETER` | 400 | Paramètre de requête invalide | Query/params invalides |
| `INVALID_FILE_TYPE` | 400 | Type de fichier non supporté | Format de fichier incorrect |
| `FILE_TOO_LARGE` | 413 | Fichier trop volumineux | Dépassement limite fichier |

**Exemple:**
```json
{
  "success": false,
  "message": "Le champ email est requis.",
  "error": {
    "code": "MISSING_REQUIRED_FIELD",
    "details": {
      "field": "email",
      "expected": "string"
    }
  }
}
```

---

## 401 Unauthorized

| Code | Statut HTTP | Description | Cause |
|------|------------|-------------|-------|
| `NO_TOKEN` | 401 | Token non fourni | Header Authorization manquant |
| `INVALID_TOKEN` | 401 | Token invalide | Signature JWT incorrecte |
| `EXPIRED_TOKEN` | 401 | Token expiré | JWT au-delà de sa durée de vie |
| `INVALID_API_KEY` | 401 | Clé API invalide | Clé API incorrecte ou révoquée |
| `MISSING_API_KEY` | 401 | Clé API manquante | Header X-API-Key absent |

**Exemple:**
```json
{
  "success": false,
  "message": "Session invalide. Veuillez vous reconnecter.",
  "error": {
    "code": "EXPIRED_TOKEN",
    "details": {
      "expiredAt": "2026-06-06T10:30:00Z"
    }
  }
}
```

---

## 403 Forbidden

| Code | Statut HTTP | Description | Cause |
|------|------------|-------------|-------|
| `INSUFFICIENT_PERMISSIONS` | 403 | Permissions insuffisantes | Rôle non autorisé |
| `RESOURCE_NOT_OWNED` | 403 | Ressource non possédée | Tentative d'accès cross-tenant |
| `ACCOUNT_DISABLED` | 403 | Compte désactivé | Utilisateur banni/supprimé |
| `IP_BLOCKED` | 403 | IP bloquée | Trop de tentatives échouées |
| `CORS_ORIGIN_BLOCKED` | 403 | Origine non autorisée | CORS bloque la requête |

**Exemple:**
```json
{
  "success": false,
  "message": "Rôle 'user' non autorisé",
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "details": {
      "requiredRole": "admin",
      "currentRole": "user"
    }
  }
}
```

---

## 404 Not Found

| Code | Statut HTTP | Description | Cause |
|------|------------|-------------|-------|
| `RESOURCE_NOT_FOUND` | 404 | Ressource introuvable | ID inexistant |
| `ENDPOINT_NOT_FOUND` | 404 | Endpoint introuvable | Route invalide |
| `VERSION_NOT_FOUND` | 404 | Version API inconnue | Version non supportée |

**Exemple:**
```json
{
  "success": false,
  "message": "Ressource introuvable",
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "details": {
      "resourceType": "conversation",
      "resourceId": "507f1f77bcf86cd799439011"
    }
  }
}
```

---

## 409 Conflict

| Code | Statut HTTP | Description | Cause |
|------|------------|-------------|-------|
| `DUPLICATE_KEY` | 409 | Valeur déjà utilisée | Email/téléphone déjà existant |
| `VERSION_MISMATCH` | 409 | Conflit de version | Mise à jour concurrente |
| `ALREADY_EXISTS` | 409 | Ressource déjà existante | Tentative de création en double |
| `STATUS_CONFLICT` | 409 | Conflit de statut | Transition de statut invalide |

**Exemple:**
```json
{
  "success": false,
  "message": "Cet email est déjà utilisé.",
  "error": {
    "code": "DUPLICATE_KEY",
    "details": {
      "field": "email",
      "value": "user@example.com"
    }
  }
}
```

---

## 429 Too Many Requests

| Code | Statut HTTP | Description | Cause |
|------|------------|-------------|-------|
| `RATE_LIMIT_EXCEEDED` | 429 | Limite de requêtes atteinte | Trop de requêtes dans la fenêtre |
| `AUTH_RATE_LIMIT_EXCEEDED` | 429 | Trop de tentatives de connexion | Brute-force détecté |

**Exemple:**
```json
{
  "success": false,
  "message": "Trop de requêtes. Limite: 1000 requêtes par heure.",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "resetAt": "2026-06-06T11:30:00Z",
      "retryAfter": 3600
    }
  }
}
```

---

## 500 Internal Server Error

| Code | Statut HTTP | Description | Cause |
|------|------------|-------------|-------|
| `DATABASE_ERROR` | 500 | Erreur base de données | Connexion/requête DB échouée |
| `EXTERNAL_API_ERROR` | 500 | Erreur API externe | Service tiers indisponible |
| `INTERNAL_ERROR` | 500 | Erreur interne | Exception non gérée |
| `VALIDATION_ERROR` | 500 | Erreur de validation | Schéma invalide |

**Headers de réponse pour 500:**
```
X-Request-ID: req-abc-123-def
Retry-After: 5
```

**Exemple:**
```json
{
  "success": false,
  "message": "Une erreur est survenue. Veuillez réessayer.",
  "error": {
    "code": "DATABASE_ERROR",
    "details": {
      "retryable": true
    }
  }
}
```

---

## 503 Service Unavailable

| Code | Statut HTTP | Description | Cause |
|------|------------|-------------|-------|
| `SERVICE_UNAVAILABLE` | 503 | Service indisponible | Maintenance / Surcharge |
| `DB_UNAVAILABLE` | 503 | Base de données indisponible | MongoDB déconnecté |
| `CACHE_UNAVAILABLE` | 503 | Cache indisponible | Redis injoignable (optionnel) |

---

## Résolution des Erreurs Courantes

| Erreur | Action Recommandée |
|--------|-------------------|
| `NO_TOKEN` | Ajouter le header `Authorization: Bearer <token>` |
| `EXPIRED_TOKEN` | Rafraîchir le token via `/auth/refresh` |
| `RATE_LIMIT_EXCEEDED` | Attendre le reset ou contacter le support |
| `INSUFFICIENT_PERMISSIONS` | Demander une mise à niveau de compte |
| `DUPLICATE_KEY` | Utiliser une autre valeur (email, nom, etc.) |
| `DATABASE_ERROR` | Réessayer dans quelques secondes |

---

## Bonnes Pratiques Client

1. **Toujours vérifier `success`** avant d'utiliser la réponse
2. **Implémenter un retry** avec backoff exponentiel pour les erreurs 5xx
3. **Logger les `error.code`** pour le debugging
4. **Utiliser `X-Request-ID`** pour tracer les problèmes avec le support
5. **Gérer le rate limiting** en respectant les headers `X-RateLimit-*`

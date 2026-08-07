# 🚀 Guide de Déploiement (Production Hardening)

<!-- nav:start -->

[⬅ Précédent : 05 · API Reference](./05_API_REFERENCE.md) · **06 · Deployment** · [Suivant : 07 · Commands Reference ➡](./07_COMMANDS_REFERENCE.md)

<!-- nav:end -->

Mettre une API en ligne est une responsabilité. Ce guide t'assure que ton déploiement est **sécurisé**, **rapide** et **auto-reparable**.

---

## 1. Préparation de l'Environnement (Standard Industriel) 🛡️

En production, ton fichier `.env` doit être durci :

```bash
NODE_ENV=production
# Sécurité
JWT_SECRET=GENERER_UNE_CLE_DE_64_CHAR_MINIMUM
# Base de données (Utilise MongoDB Atlas pour la réplication)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/DryMain
# Origins autorisées (Ne jamais laisser *)
ALLOWED_ORIGINS=https://mon-app.com,https://admin.mon-app.com
```

---

## 2. Hardening (Sécurité Maximale) 🔒

DRY active automatiquement ces protections en mode production :

- **HSTS (HTTP Strict Transport Security)** : Force le HTTPS.
- **CSP (Content Security Policy)** : Bloque les scripts malveillants (XSS).
- **Rate Limiting Hardened** : Réduit le nombre de requêtes autorisées par minute pour prévenir les attaques par déni de service (DoS).
- **Hide Powered-By** : Supprime les en-têtes qui indiquent l'onglet technologique (Express).

---

## 3. Déploiement Docker 🐳

### 3.1 Build et lancement rapide

```bash
# Build de l'image
docker build -t dryapi:latest .

# Lancer la stack complète (API + MongoDB + Redis + Nginx)
docker-compose up -d
```

### 3.2 Services inclus dans `docker-compose.yml`

| Service | Rôle | Port |
|---------|------|------|
| `app` | API DRY | 5000 |
| `mongodb` | Base de données | 27017 |
| `redis` | Cache / Rate limit | 6379 |
| `nginx` | Reverse proxy (HTTPS) | 80 / 443 |
| `prometheus` | Métriques (profil `monitoring`) | 9090 |
| `grafana` | Dashboard (profil `monitoring`) | 3001 |

### 3.3 Commandes utiles

```bash
# Voir les logs de l'API
docker-compose logs -f app

# Redémarrer l'API après une modification
docker-compose restart app

# Arrêter la stack
docker-compose down

# Arrêter ET supprimer les volumes (⚠️ supprime les données)
docker-compose down -v
```

### 3.4 Profils Docker

```bash
# Stack minimale (API + Mongo + Redis)
docker-compose up -d

# Stack complète avec monitoring
docker-compose --profile monitoring up -d

# Stack complète avec Nginx + monitoring
docker-compose --profile full up -d
```

---

## 4. Déploiement Kubernetes ☸️

### 4.1 Prérequis

- Un cluster Kubernetes fonctionnel
- `kubectl` configuré
- Un registry Docker (Docker Hub, ECR, GCR, etc.)

### 4.2 Déploiement

```bash
# Créer le namespace
kubectl create namespace dryapi

# Déployer tous les manifests
npm run k8s:deploy

# Vérifier le déploiement
kubectl get pods -n dryapi
kubectl get services -n dryapi
kubectl get ingress -n dryapi
```

### 4.3 Structure des manifests

| Fichier | Rôle |
|---------|------|
| `namespace.yaml` | Namespace dédié |
| `secret.yaml` | Secrets (JWT, Mongo, etc.) |
| `configmap.yaml` | Config non sensible |
| `deployment.yaml` | Deploy de l'API avec HPA |
| `service.yaml` | Service ClusterIP |
| `ingress.yaml` | Exposition HTTPS |
| `hpa.yaml` | Auto-scaling horizontal |

### 4.4 Mise à jour

```bash
# Appliquer un changement de config
kubectl apply -f k8s/

# Redémarrer les pods après une nouvelle image
kubectl rollout restart deployment/dryapi -n dryapi

# Voir les logs
kubectl logs -f deployment/dryapi -n dryapi
```

---

## 5. Reverse Proxy Nginx (Production) 🔄

### 5.1 Pourquoi Nginx ?

- Terminaison SSL/TLS
- Compression gzip
- Cache statique
- Rate limiting avancé
- Buffering et timeouts optimisés
- Logging centralisé

### 5.2 Configuration de base

Le fichier `nginx/nginx.conf` est inclus dans le repo. Il gère :

- **HTTP → HTTPS** : Redirection automatique
- **WebSocket** : Support Socket.IO pour les notifications temps réel
- **Health checks** : Pas de rate limiting sur `/health/*`
- **Métriques** : Pas de rate limiting sur `/metrics`

### 5.3 Obtenir un certificat SSL (Let's Encrypt)

```bash
# Sur la machine hébergeant Nginx
sudo apt install certbot python3-certbot-nginx

# Générer le certificat
sudo certbot --nginx -d api.mon-app.com

# Renouvellement automatique
sudo certbot renew --dry-run
```

### 5.4 Variables Nginx à adapter

Dans `nginx/nginx.conf`, modifier :

```nginx
server_name api.mon-app.com;  # ← Ton domaine
ssl_certificate /etc/nginx/ssl/fullchain.pem;  # ← Chemin vers tes certificats
```

---

## 6. Sauvegardes MongoDB 💾

### 6.1 Sauvegarde manuelle

```bash
# Via le script intégré
npm run backup:mongo

# Via mongodump directement
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/DryMain" --out="./backups/mongo-2026-08-07"
```

### 6.2 Sauvegarde automatisée (cron)

Ajouter dans le crontab du serveur (`crontab -e`) :

```bash
# Backup quotidien à 2h du matin
0 2 * * * cd /chemin/vers/dryApi && npm run backup:mongo >> logs/backup.log 2>&1

# Nettoyage des backups de plus de 30 jours
0 3 * * * find /chemin/vers/dryApi/backups -type f -mtime +30 -delete
```

### 6.3 Restauration

```bash
# Via mongorestore
mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/DryMain" --drop ./backups/mongo-2026-08-07
```

---

## 7. Logs en Production 📝

DRY utilise deux systèmes de logs. En production, configure une agrégation.

### 7.1 Logs applicatifs (Winston)

Fichiers générés automatiquement :

- `logs/combined-<date>.log` : Tous les logs (JSON structuré)
- `logs/error-<date>.log` : Erreurs uniquement

### 7.2 Logs HTTP (morgan)

Si `LOG_REQUESTS=true` dans `.env` :

- `logs/info.log` : Requêtes HTTP (méthode, URL, statut, durée, body masqué)
- `logs/error.log` : Erreurs HTTP

### 7.3 Agrégation recommandée

Pour un environnement sérieux, envoyer les logs vers un service externe :

- **Datadog / New Relic** : Via leur agent
- **ELK Stack** (Elasticsearch + Logstash + Kibana) : Via Filebeat
- **CloudWatch** : Si déployé sur AWS
- **Google Cloud Logging** : Si sur GCP

Exemple avec Filebeat :

```yaml
# filebeat.yml
filebeat.inputs:
  - type: log
    paths:
      - /app/logs/*.log
    json.keys_under_root: true
    json.add_error_key: true
```

---

## 8. Variables d'Environnement Essentielles 📋

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `NODE_ENV` | `production` en prod | ✅ |
| `PORT` | Port d'écoute (défaut: 5000) | ❌ |
| `MONGO_URI` | Connexion MongoDB | ✅ |
| `JWT_SECRET` | Secret JWT (≥ 64 car.) | ✅ |
| `SESSION_SECRET` | Secret sessions (≥ 64 car.) | ✅ |
| `ALLOWED_ORIGINS` | CORS (jamais `*`) | ✅ |
| `REDIS_ENABLED` | `true` pour activer Redis | ❌ |
| `REDIS_URL` | URL Redis | ❌ |
| `LOG_LEVEL` | `info`, `warn`, `error` | ❌ |
| `HEALTH_MONITOR_INTERVAL_MS` | Intervalle monitoring | ❌ |
| `ALERT_EMAIL_TO` | Email pour les alertes | ❌ |
| `PROMETHEUS_ENABLED` | `true` pour exposer `/metrics` | ❌ |

---

## 9. Checklist de Déploiement ✅

- [ ] `NODE_ENV=production` configuré
- [ ] `JWT_SECRET` et `SESSION_SECRET` générés (≥ 64 caractères)
- [ ] `ALLOWED_ORIGINS` restrictif (pas de `*`)
- [ ] MongoDB accessible et répliqué (Atlas recommandé)
- [ ] Redis activé pour le cache et rate limiting
- [ ] SSL/TLS configuré (Let's Encrypt)
- [ ] Health check configuré (`/health/ready`)
- [ ] Monitoring activé (Prometheus + Grafana)
- [ ] Sauvegardes automatiques configurées (cron)
- [ ] Logs agrégés vers un service externe
- [ ] Rate limiting testé
- [ ] Test de charge effectué (k6, Artillery, etc.)

---

## 10. Scalabilité 📈

### Horizontal

DRY est **stateless** : tu peux lancer N instances derrière un load balancer.

```bash
# Avec Docker Compose
docker-compose up -d --scale app=3
```

### Vertical

Augmente les ressources du serveur (CPU/RAM) si le goulot est matériel.

### Base de données

- **MongoDB Atlas** : Scaling automatique, sharding
- **Redis Cluster** : Si le cache devient un goulot

---

## 11. Support & Alertes 🆘

- **Email** : `ALERT_EMAIL_TO` pour les alertes critiques
- **Slack/Discord** : Configurable via `dry/services/alert/`
- **Webhook** : Pour intégration avec PagerDuty, OpsGenie, etc.

---

_🚀 Déployer, c'est bien. Déployer en toute confiance, c'est mieux._

<!-- nav:start -->

[⬅ Précédent : 05 · API Reference](./05_API_REFERENCE.md) · **06 · Deployment** · [Suivant : 07 · Commands Reference ➡](./07_COMMANDS_REFERENCE.md)

<!-- nav:end -->

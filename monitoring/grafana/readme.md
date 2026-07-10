# Tableau de Bord Grafana — DRY API

Ce dossier contient les tableaux de bord Grafana pour le monitoring de l'API DRY.

## Prérequis

- Grafana (v9+)
- Source de données Prometheus configurée sur `http://localhost:9090` (ou l'URL de votre Prometheus)

## Import

### Méthode 1: Interface Grafana
1. Aller dans Grafana → **+** → **Import**
2. Uploader le fichier `dry-api-dashboard.json`
3. Sélectionner la source de données Prometheus
4. Cliquer sur **Import**

### Méthode 2: API Grafana
```bash
curl -X POST http://admin:admin@localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d '{
    "dashboard": '"$(cat monitoring/grafana/dry-api-dashboard.json)"',
    "overwrite": true
  }'
```

## Métriques disponibles

| Métrique | Type | Description |
|----------|------|-------------|
| `dry_http_requests_total` | Counter | Total requêtes par méthode/route/status |
| `dry_http_request_duration_seconds` | Histogram | Distribution des temps de réponse |
| `dry_errors_total` | Counter | Erreurs par type/service |
| `dry_active_users` | Gauge | Utilisateurs actifs par app |
| `dry_cache_hits_total` | Counter | Hits du cache |
| `dry_cache_misses_total` | Counter | Misses du cache |
| `dry_ws_connections` | Gauge | Connexions WebSocket |

## Endpoint Prometheus

```
GET /health/metrics
```

## Alertes

Les 4 seuils recommandés ci-dessous sont maintenant fournis comme règles Grafana **réellement importables** dans `alerting-rules.yml` (avant, c'était uniquement cette liste en texte — jamais configuré) :

1. **Disponibilité < 99.9%** pendant 5 min → warning
2. **Taux d'erreur 5xx > 5%** pendant 5 min → critical
3. **Latence p95 > 2s** pendant 5 min → warning
4. **Mémoire RSS > 1024 MB** pendant 10 min → warning (**ajuster ce seuil à la taille réelle de votre instance**, 1024 MB est un point de départ arbitraire)

Import (Grafana v9+, unified alerting) :
1. Adapter `datasourceUid: Prometheus` dans `alerting-rules.yml` avec l'UID réel de votre datasource Prometheus (Grafana → Connections → Data sources → Prometheus → l'UID est dans l'URL).
2. Copier le fichier dans le dossier de provisioning Grafana (`/etc/grafana/provisioning/alerting/`), ou l'importer via **Alerting → Alert rules → Import**.
3. Configurer un contact point (email/Slack/webhook) dans Grafana pour recevoir ces alertes — distinct du système d'alerte applicatif déjà en place (`dry/services/alert/alert.service.js`, qui couvre les crashs/exceptions, pas les métriques d'infra).

**Volontairement absent de ces règles** : les erreurs 4xx métier attendues (mauvais mot de passe, email déjà utilisé, etc.) — visibles dans le panel "Échecs de connexion (401 sur /login)" du dashboard à titre informatif, mais ne déclenchent aucune alerte (ni ici, ni côté email — voir `dry/middlewares/error/errorHandler.js#isClientError`).

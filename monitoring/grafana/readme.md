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

## Alertes recommandées

1. **Disponibilité < 99.9%** → Notification équipe
2. **Temps de réponse p95 > 2s** → Investigation performance
3. **Taux d'erreur > 5%** → Alerte critique
4. **Mémoire > 80%** → Scaling nécessaire

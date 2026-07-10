# Monitoring (Prometheus + Grafana) — DRY API

Avant, ce dossier ne contenait qu'un fichier JSON à importer manuellement —
rien ne faisait réellement tourner Prometheus ou Grafana. Maintenant,
`docker-compose.yml` sait démarrer les deux, avec le dashboard et les
alertes déjà chargés automatiquement (provisioning).

## Lancer Grafana (méthode recommandée)

Depuis la racine du projet :

```bash
docker-compose --profile monitoring up -d prometheus grafana
```

(ou `docker-compose --profile full up -d` pour tout lancer, y compris l'app/Mongo/Redis/nginx)

Puis ouvrir **http://localhost:3001** (identifiants : `admin` / `admin` par
défaut — changer via les variables d'env `GRAFANA_ADMIN_USER` /
`GRAFANA_ADMIN_PASSWORD` dans `.env`, ou en surchargeant `docker-compose.yml`).

Au démarrage, Grafana charge automatiquement :

- la source de données Prometheus (`http://prometheus:9090`) — `provisioning/datasources/datasource.yml`
- le dashboard "DRY API - Monitoring" (13 panels) — `provisioning/dashboards/` + `dry-api-dashboard.json`
- les 4 règles d'alerte (disponibilité, erreurs 5xx, latence, mémoire) — `provisioning/alerting/alerting-rules.yml`

Rien à importer à la main. Le dashboard est visible dans **Dashboards → DRY API**, les alertes dans **Alerting → Alert rules**.

Prometheus lui-même scrape `GET /health/metrics` sur le service `app` (voir `monitoring/prometheus/prometheus.yml`) — donc le service `app` du même `docker-compose.yml` doit être démarré (`docker-compose --profile monitoring up -d` sans arguments de service supplémentaires le fait aussi).

## Configurer les notifications d'alerte

Le provisioning charge les _règles_, mais pas de destinataire par défaut.
Dans Grafana : **Alerting → Contact points** → ajouter un email/Slack/webhook,
puis l'associer à la policy de notification (**Alerting → Notification policies**).

C'est un système différent et complémentaire de celui déjà actif dans le
code (`dry/services/alert/alert.service.js`, `ALERT_EMAIL_TO`/`SLACK_WEBHOOK_URL`
dans `.env`) : celui-là couvre les crashs/exceptions applicatifs avec le
détail exact de l'erreur (stack, fichier, ligne) ; Grafana couvre les
métriques d'infrastructure (taux d'erreur, latence, mémoire dans le temps).

## En production (sans docker-compose)

Si l'app tourne ailleurs (ex: Render, comme `dryapi.onrender.com`) et que
vous voulez un Grafana/Prometheus séparés qui scrapent cette instance :

1. Adapter `monitoring/prometheus/prometheus.yml` : remplacer `app:5000` par
   l'URL publique (ex: `dryapi.onrender.com:443`, avec `scheme: https`).
2. Pointer `datasourceUid`/l'URL de la datasource Grafana vers ce Prometheus.
3. Importer `dry-api-dashboard.json` et `provisioning/alerting/alerting-rules.yml`
   manuellement si vous n'utilisez pas le provisioning automatique (interface
   Grafana → **+** → **Import**, ou API `POST /api/dashboards/db`).

## Métriques disponibles

| Métrique                                          | Type      | Description                                 |
| ------------------------------------------------- | --------- | ------------------------------------------- |
| `dry_http_requests_total`                         | Counter   | Total requêtes par méthode/route/status/app |
| `dry_http_request_duration_seconds`               | Histogram | Distribution des temps de réponse           |
| `dry_errors_total`                                | Counter   | Erreurs par type/service/app                |
| `dry_active_users`                                | Gauge     | Utilisateurs actifs par app                 |
| `dry_db_connections`                              | Gauge     | Connexions DB actives par état              |
| `dry_ws_connections`                              | Gauge     | Connexions WebSocket actives                |
| `dry_cache_hits_total` / `dry_cache_misses_total` | Counter   | Hits/misses du cache Redis                  |

Endpoint : `GET /health/metrics`

## Alertes

Les 4 seuils recommandés sont provisionnés automatiquement (`provisioning/alerting/alerting-rules.yml`) :

1. **Disponibilité < 99.9%** pendant 5 min → warning
2. **Taux d'erreur 5xx > 5%** pendant 5 min → critical
3. **Latence p95 > 2s** pendant 5 min → warning
4. **Mémoire RSS > 1024 MB** pendant 10 min → warning (**ajuster ce seuil à la taille réelle de votre instance**, 1024 MB est un point de départ arbitraire)

**Volontairement absent de ces règles** : les erreurs 4xx métier attendues (mauvais mot de passe, email déjà utilisé, etc.) — visibles dans le panel "Échecs de connexion (401 sur /login)" du dashboard à titre informatif, mais ne déclenchent aucune alerte (ni ici, ni côté email — voir `dry/middlewares/error/errorHandler.js#isClientError`).

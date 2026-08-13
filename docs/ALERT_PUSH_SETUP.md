# Alertes Push Gratuites — Telegram & WhatsApp

## 🚀 Configuration rapide

### 1. Telegram (recommandé, instantané)

1. Ouvrir Telegram et chercher **@BotFather**
2. Envoyer `/newbot`, suivre les étapes, nommer le bot (ex: `DRY API Alerts`)
3. Copier le **token** (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
4. Ouvrir **@userinfobot** ou **@getidsbot**, envoyer un message, copier le **chat_id** (ex: `123456789`)
5. Ajouter dans `.env` :
   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   TELEGRAM_CHAT_ID=123456789
   ```
6. Redémarrer le backend → les `critical` arrivent sur Telegram.

### 2. WhatsApp via CallMeBot (gratuit, pas de frais)

1. Aller sur **https://www.callmebot.com**
2. Cliquer sur **Get API Key** / **Free API**
3. Entrer ton numéro WhatsApp avec indicatif pays (ex: `242068457521`)
4. Suivre les étapes pour obtenir la **API Key**
5. Ajouter dans `.env` :
   ```env
   CALLMEBOT_API_KEY=ta_cle_api_callmebot
   CALLMEBOT_PHONE=242068457521
   ```
6. Redémarrer le backend → les `critical` arrivent sur WhatsApp.

## 📋 Récapitulatif des canaux par sévérité

| Severity | Email | Webhook | Slack | Discord | Telegram | WhatsApp |
|----------|-------|---------|-------|---------|----------|----------|
| `critical` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `warning` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `info` | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `info` + résumé (DRY_DAILY_SUMMARY / DRY_LOGS_SUMMARY) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

## 🧪 Tester

Une fois configuré, redémarre le backend puis déclenche une erreur 500 :

```bash
curl -X POST http://localhost:5000/api/v1/admin/alerts/test \
  -H "Content-Type: application/json" \
  -d '{"severity":"critical","message":"Test Telegram/WhatsApp"}'
```

Tu recevras la notification sur Telegram ET WhatsApp (si configurés).

## 🛑 Couper complètement les notifications (ex: dev local)

Pour **bloquer tous les envois** (Telegram, email, webhooks, WhatsApp — même les `critical`), mettre dans `.env` :

```env
ALERTS_ENABLED=false
```

L'alerte reste **loggée et stockée en base** (trace gardée), mais rien ne part à l'extérieur. Alternative plus douce : `ALERT_MAINTENANCE_MODE=true` (coupe tout **sauf** les `critical`).

## ⚠️ Notes

- **Telegram** : 100% gratuit, fiable, pas de limite connue.
- **CallMeBot WhatsApp** : gratuit mais non officiel. Pour un usage professionnel, préférer la **WhatsApp Business Platform** (payante après période d'essai).
- Les alertes **`critical`** partent partout ; les **`warning`** sur Email + Telegram ; les **`info`** sur **Telegram + Webhook uniquement** (pas d'email pour éviter le spam), **sauf exception** : les résumés planifiés `DRY_DAILY_SUMMARY` / `DRY_LOGS_SUMMARY` partent aussi par **email** (rapports quotidiens) en plus de Telegram.
- **Telegram reçoit toutes les sévérités** (`critical`, `warning`, `info`) avec un message complet : environnement, serveur, source exacte de l'erreur, extrait de stack, état santé et heure lisible — de quoi débugger sans ouvrir les logs.
- Les alertes **`warning`** et **`info`** sont suspendues pendant les **heures calmes** (22h–7h par défaut, fuseau `Africa/Brazzaville`) : seules les `critical` partent — **sauf les résumés planifiés**, qui sont toujours envoyés (même la nuit, pour garantir la réception du rapport quotidien).
- L'email d'alerte n'est marqué comme **envoyé** que si un provider email est réellement configuré (SMTP, Resend ou Brevo). Sans config, le canal est marqué `skipped` au lieu de simuler un succès.

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
| `warning` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `info` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

## 🧪 Tester

Une fois configuré, redémarre le backend puis déclenche une erreur 500 :

```bash
curl -X POST http://localhost:5000/api/v1/admin/alerts/test \
  -H "Content-Type: application/json" \
  -d '{"severity":"critical","message":"Test Telegram/WhatsApp"}'
```

Tu recevras la notification sur Telegram ET WhatsApp (si configurés).

## ⚠️ Notes

- **Telegram** : 100% gratuit, fiable, pas de limite connue.
- **CallMeBot WhatsApp** : gratuit mais non officiel. Pour un usage professionnel, préférer la **WhatsApp Business Platform** (payante après période d'essai).
- Les notifications ne partent **que pour les alertes `critical`** (erreurs 5xx, crash, queue down, etc.).

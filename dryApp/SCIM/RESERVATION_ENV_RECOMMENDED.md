# Variables .env Reservation SCIM (Staging et Production)

Ce fichier donne des valeurs recommandees pour le flux reservation web:
- accuse automatique de prise en charge,
- suivi asynchrone cote client,
- fallback WhatsApp optionnel.

## Staging (recommande)
Utilise un contact support dedie pour ne pas melanger avec la production.

```env
SCIM_CONTACT_EMAIL=support-staging@votre-domaine.com
SCIM_WHATSAPP_PHONE=242060000001
SCIM_RESERVATION_SLA_MINUTES=20
SCIM_RESERVATION_REMINDER_MINUTES=20
SCIM_REMINDER_ENABLED=true
SCIM_REMINDER_CRON=*/1 * * * *
SCIM_DEFAULT_COUNTRY_CODE=+242
SCIM_ENABLE_EMAIL_NOTIFICATIONS=false
SCIM_ENABLE_SMS_NOTIFICATIONS=false
SCIM_ENABLE_WHATSAPP_NOTIFICATIONS=false
SCIM_TZ_OFFSET_MINUTES=60
```

## Production (recommande)
Utilise le vrai canal support et un SLA realiste.

```env
SCIM_CONTACT_EMAIL=support@votre-domaine.com
SCIM_WHATSAPP_PHONE=242060000999
SCIM_RESERVATION_SLA_MINUTES=30
SCIM_RESERVATION_REMINDER_MINUTES=30
SCIM_REMINDER_ENABLED=true
SCIM_REMINDER_CRON=*/1 * * * *
SCIM_DEFAULT_COUNTRY_CODE=+242
SCIM_ENABLE_EMAIL_NOTIFICATIONS=true
SCIM_ENABLE_SMS_NOTIFICATIONS=true
SCIM_ENABLE_WHATSAPP_NOTIFICATIONS=true
SCIM_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SCIM_TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SCIM_TWILIO_SMS_FROM=+15005550006
SCIM_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
SCIM_TZ_OFFSET_MINUTES=60
```

## Variables optionnelles E2E (script rapide)
Tu peux forcer les identifiants/utilisateur bien cible:

```env
E2E_SCIM_ADMIN_EMAIL=admin@admin.com
E2E_SCIM_ADMIN_PASSWORD=Admin@2026
E2E_SCIM_REQUESTER_EMAIL=
E2E_SCIM_REQUESTER_PASSWORD=
E2E_SCIM_REQUESTER_PHONE=+242060000003
E2E_SCIM_PROPERTY_ID=
E2E_SCIM_TEST_ACK=false
```

Le script E2E cible le local par defaut:

```env
E2E_SCIM_BASE_URL=http://localhost:5000
E2E_SCIM_ALLOW_REMOTE=false
```

Execution:

```bash
npm run test:e2e:scim:reservation
```

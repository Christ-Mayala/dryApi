# SkillForge

Application generee avec le Generateur DRY (mode professionnel par defaut).

## Demarrage express (debutant)
1. Installe les dependances: `npm install`
2. Cree ton fichier .env a partir de `.env.exemple`
3. Demarre le serveur: `npm run dev`
4. Verifie la sante: `GET /`
5. Ouvre la doc Swagger: `http://localhost:5000/api-docs`

## Endpoints principaux
- /api/v1/skillforge/courses
- /api/v1/skillforge/ebooks
- /api/v1/skillforge/categories
- /api/v1/skillforge/orders
- /api/v1/skillforge/students
- /api/v1/skillforge/reviews

## Details par feature (routes + payloads)
### courses
- GET /api/v1/skillforge/courses
- POST /api/v1/skillforge/courses
- GET /api/v1/skillforge/courses/:id
- PUT /api/v1/skillforge/courses/:id
- DELETE /api/v1/skillforge/courses/:id

Exemple payload:
```json
{
  "title": "exemple_title",
  "subtitle": "exemple_subtitle",
  "price": 100,
  "duration": 100,
  "level": "exemple_level",
  "categoryId": "exemple_categoryId",
  "trailerUrl": "exemple_trailerUrl",
  "contentUrl": "exemple_contentUrl",
  "isPublished": true,
  "label": "exemple_label"
}
```

### ebooks
- GET /api/v1/skillforge/ebooks
- POST /api/v1/skillforge/ebooks
- GET /api/v1/skillforge/ebooks/:id
- PUT /api/v1/skillforge/ebooks/:id
- DELETE /api/v1/skillforge/ebooks/:id

Exemple payload:
```json
{
  "title": "exemple_title",
  "author": "exemple_author",
  "price": 100,
  "summary": "exemple_summary",
  "pages": 100,
  "format": "exemple_format",
  "coverUrl": "exemple_coverUrl",
  "fileUrl": "exemple_fileUrl",
  "label": "exemple_label"
}
```

### categories
- GET /api/v1/skillforge/categories
- POST /api/v1/skillforge/categories
- GET /api/v1/skillforge/categories/:id
- PUT /api/v1/skillforge/categories/:id
- DELETE /api/v1/skillforge/categories/:id

Exemple payload:
```json
{
  "name": "exemple_name",
  "description": "exemple_description",
  "slug": "exemple_slug",
  "icon": "exemple_icon",
  "parentId": "exemple_parentId",
  "label": "exemple_label"
}
```

### orders
- GET /api/v1/skillforge/orders
- POST /api/v1/skillforge/orders
- GET /api/v1/skillforge/orders/:id
- PUT /api/v1/skillforge/orders/:id
- DELETE /api/v1/skillforge/orders/:id

Exemple payload:
```json
{
  "studentId": "exemple_studentId",
  "items": [],
  "subtotal": 100,
  "tax": 100,
  "total": 100,
  "status": "exemple_status",
  "paymentMethod": "exemple_paymentMethod",
  "transactionId": "exemple_transactionId",
  "label": "exemple_label"
}
```

### students
- GET /api/v1/skillforge/students
- POST /api/v1/skillforge/students
- GET /api/v1/skillforge/students/:id
- PUT /api/v1/skillforge/students/:id
- DELETE /api/v1/skillforge/students/:id

Exemple payload:
```json
{
  "fullName": "exemple_fullName",
  "email": "demo@example.com",
  "phone": "exemple_phone",
  "preferences": [],
  "balance": 100,
  "enrolledCourses": [],
  "label": "exemple_label"
}
```

### reviews
- GET /api/v1/skillforge/reviews
- POST /api/v1/skillforge/reviews
- GET /api/v1/skillforge/reviews/:id
- PUT /api/v1/skillforge/reviews/:id
- DELETE /api/v1/skillforge/reviews/:id

Exemple payload:
```json
{
  "courseId": "exemple_courseId",
  "studentId": "exemple_studentId",
  "rating": 100,
  "comment": "exemple_comment",
  "isApproved": true,
  "label": "exemple_label"
}
```


## 💳 Configuration Paiement (Multi-Fournisseurs)
Le module de paiement supporte **Moneroo**, **CinetPay**, **Stripe**, **MTN Mobile Money** et **Airtel Money**.

### 1. Configuration .env
Ajoutez les clés correspondant à vos fournisseurs :
```env
# --- Moneroo (Recommandé) ---
MONEROO_API_KEY=votre_cle_secrete_moneroo
MONEROO_RETURN_URL=http://localhost:5000/api/v1/skillforge/payment/callback

# --- CinetPay ---
CINETPAY_API_KEY=votre_api_key
CINETPAY_SITE_ID=votre_site_id

# --- MTN Mobile Money ---
MTN_SUBSCRIPTION_KEY=votre_subscription_key
MTN_API_USER=votre_uuid_api_user
MTN_API_KEY=votre_api_key_generee
MTN_TARGET_ENV=sandbox
# Base URL par défaut: Sandbox. Pour la prod, voir doc MTN.

# --- Airtel Money ---
AIRTEL_CLIENT_ID=votre_client_id
AIRTEL_CLIENT_SECRET=votre_client_secret

# --- Stripe ---
STRIPE_SECRET_KEY=votre_secret_key
```

### 2. Utilisation (Choix du Provider)
Le choix se fait via le champ `provider` dans le body de la requête.

- **Moneroo**: `{ "provider": "moneroo", ... }`
- **CinetPay**: `{ "provider": "cinetpay", ... }`
- **MTN MoMo**: `{ "provider": "mtn", "customerPhone": "24206..." }`
- **Airtel**: `{ "provider": "airtel", "customerPhone": "24206..." }`
- **Stripe**: `{ "provider": "stripe", ... }`

### Endpoints Paiement
- **Initier un paiement**: `POST /api/v1/skillforge/payment/init`
  - Body Exemple (Moneroo): `{ "provider": "moneroo", "amount": 1000, "currency": "XAF", "customerName": "Jean", "customerEmail": "jean@test.com" }`
  - Body Exemple (MTN): `{ "provider": "mtn", "amount": 500, "currency": "XAF", "customerPhone": "24206123456" }`
- **Vérifier un paiement**: `GET /api/v1/skillforge/payment/verify/:id?provider=moneroo`


## 📊 Module Export (CSV / Excel)
Le module d'export est activé pour toutes vos entités.

### Utilisation
- **URL**: `GET /api/v1/skillforge/export`
- **Paramètres**:
  - `entity`: Nom du modèle (ex: `Courses`)
  - `format`: `csv` ou `excel`
- **Exemple**: `/api/v1/skillforge/export?entity=Courses&format=excel`



## 🔔 Notifications Temps Réel (Socket.io)
Le service de notification est pré-intégré et prêt à l'emploi.

### Quand l'utiliser ?
- **Confirmation de commande/paiement** : Notifier l'utilisateur instantanément sans recharger la page.
- **Mises à jour de statut** : "Votre commande est en route", "Votre dossier a été validé".
- **Chat / Messagerie** : Communication en direct entre utilisateurs ou avec le support.
- **Alertes Admin** : Notifier les administrateurs d'une nouvelle inscription ou d'une erreur critique.

### Comment l'utiliser ?

#### 1. Backend (Émettre une notification)
Utilisez le `NotificationService` n'importe où dans vos contrôleurs ou services.

```javascript
const notificationService = require('../../../dry/services/notification/notification.service');

// Exemple: Dans un contrôleur après une action réussie
exports.validateOrder = asyncHandler(async (req, res) => {
  // ... logique de validation ...

  // 1. Notifier l'utilisateur spécifique (nécessite que l'utilisateur soit connecté au socket)
  notificationService.sendToUser(req.user._id, 'order_status', { 
    status: 'VALIDATED', 
    message: 'Votre commande a été validée !' 
  });

  // 2. Diffuser à tout le monde (ex: Annonce globale)
  notificationService.broadcast('global_announcement', { 
    message: 'Maintenance prévue dans 10 minutes' 
  });

  sendResponse(res, order, 'Commande validée');
});
```

#### 2. Frontend (Recevoir une notification)
Le client doit se connecter et écouter les événements.

```javascript
import { io } from 'socket.io-client';

// Connexion au serveur (ajustez l'URL en prod)
const socket = io('http://localhost:5000');

// Authentification Socket (Important pour recevoir les messages privés)
// Une fois l'utilisateur loggué, envoyez son ID pour rejoindre sa "room" privée
const userId = "USER_ID_DU_CLIENT"; 
socket.on('connect', () => {
  console.log('Connecté au serveur de notification');
  socket.emit('join', userId); 
});

// Écouter les événements spécifiques
socket.on('order_status', (data) => {
  alert(data.message); // "Votre commande a été validée !"
  // Mettre à jour l'UI...
});

socket.on('global_announcement', (data) => {
  console.warn('Annonce:', data.message);
});
```


## Comprendre la securite (simple)
1. Les routes d'ecriture utilisent `protect` + `authorize('admin')`
2. La validation Joi bloque les donnees invalides
3. Cache + audit sont actives sur les routes sensibles
4. CSP/HSTS/ReferrerPolicy sont durcis en production

## Etapes recommandees (pro)
1. Definit `ALLOWED_ORIGINS` en production (pas de `*`)
2. Definis un `JWT_SECRET` long (>= 32 caracteres)
3. Lance le seeder global pour creer un admin
4. Active le monitoring via `HEALTH_MONITOR_INTERVAL_MS`

## Password Reset (injecte automatiquement)
1. POST /api/v1/skillforge/password-reset/request
2. POST /api/v1/skillforge/password-reset/verify
3. POST /api/v1/skillforge/password-reset/reset
4. POST /api/v1/skillforge/password-reset/status

Templates modifiables:
- dry/templates/email/password-reset.html
- dry/templates/email/password-reset-confirmation.html
## Frontend ready
1. Genere le client: `npm run client:gen`
2. Utilise `VITE_API_BASE_URL` ou `REACT_APP_API_BASE_URL`
3. Hooks disponibles: `useCourses`, `useCreate...`, `useUpdate...`

## Conventions DRY
1. Le champ `label` est genere automatiquement si absent
2. Le `slug` est cree depuis `label`
3. Champs techniques DRY: status, deletedAt, createdBy, updatedBy

## Tests
1. Lancer tous les tests: `npm run test`
2. Smoke test HTTP: `npm run test:smoke`

## Signature Backend
Ce backend est signe **Cyberfusion** (Server GOLD).
Email: servergold2012@gmail.com
Tel: +242068457521

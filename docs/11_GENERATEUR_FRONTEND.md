# 🚀 Générateur de Frontend DRY

## Présentation

Le générateur de frontend DRY (`scripts/generator/create-frontend.js`) crée automatiquement un projet frontend CRUD complet connecté à une application DRY existante. Il supporte **3 stacks** et **2 modes** de génération.

```bash
node scripts/generator/create-frontend.js
```

---

## 📋 Sommaire

- [Modes d'utilisation](#modes-dutilisation)
- [Stacks disponibles](#stacks-disponibles)
- [Structure générée](#structure-générée)
- [Composants DRY UI](#composants-dry-ui)
- [Gestion des rôles](#gestion-des-rôles)
- [Référence CLI](#référence-cli)
- [Exemples](#exemples)
- [Dépannage](#dépannage)

---

## Modes d'utilisation

### Mode interactif (recommandé)

```bash
node scripts/generator/create-frontend.js
```

Le CLI pose 4 questions :
1. **Application** — Choisir parmi les apps disponibles dans `dryApp/`
2. **Feature** — Choisir une feature spécifique **ou** sélectionner "Toutes les features" (option 0)
3. **Stack** — React, Angular ou React Native
4. **Rôle** — Admin (accès complet) ou Client (accès limité)

### Mode non-interactif (scripts / CI)

```bash
node scripts/generator/create-frontend.js --app <app> --feature <feature> --stack <stack> [--role <role>]
node scripts/generator/create-frontend.js --app <app> --stack <stack> --all [--role <role>]
```

| Flag | Description | Obligatoire |
|------|-------------|:-----------:|
| `--app` | Nom de l'application DRY (ex: `scim`, `FreeLLM`) | ✅ |
| `--feature` | Nom de la feature (ex: `property`, `users`) | ⚠️* |
| `--stack` | Stack frontend (`react`, `angular`, `react-native`) | ✅ |
| `--all` | Génère toutes les features de l'app | ⚠️* |
| `--role` | Rôle (`admin` ou `client`, défaut: `admin`) | ❌ |

*Soit `--feature` soit `--all` est requis.*

---

## Stacks disponibles

| Stack | Commande | Description |
|---
> ⚠️ **Note :** Le mode multi-features (`--all`) est optimise pour React. Angular et React Native generent la premiere feature uniquement.
----|----------|-------------|
| **React (Vite)** | `--stack react` | SPA moderne avec Vite, axios, react-router-dom |
| **Angular** | `--stack angular` | Angular 17 avec HttpClient, FormsModule |
| **React Native** | `--stack react-native` | Expo SDK 50, React Navigation, AsyncStorage |

---

## Structure générée

### React (Vite) — Single feature

```
frontend/react/<appName>/
├── index.html
├── package.json
├── vite.config.js              # Proxy /api → localhost:5000
├── .gitignore
├── README.md
└── src/
    ├── main.jsx                 # Point d'entrée React + DRY UI CSS
    ├── App.jsx                  # Routes + DryNavbar + DryRoleGuard
    ├── api/
    │   ├── client.js            # Axios avec interception JWT (401 → /login)
    │   ├── auth.js              # login(), logout(), getCurrentUser()
    │   └── crud.js              # createCrudApi() : list, get, create, update, delete
    ├── pages/
    │   ├── Login.jsx            # DryInput + DryButton + DryCard + DryAlert + DrySpinner
    │   ├── List.jsx             # DryTable + DryCard + DryButton + DrySpinner
    │   ├── Create.jsx           # DryInput + DryButton + DryCard + DryForm
    │   └── Edit.jsx             # DryInput + DryButton + DryCard + DryForm + DrySpinner
    ├── components/
    │   └── dry-ui/              # 15 composants DRY UI (copiés automatiquement)
    └── styles/
        └── dry.css              # Design system (variables CSS, classes utilitaires)
```

### React (Vite) — Multi-features (`--all`)

```
frontend/react/<appName>/
├── src/
│   ├── App.jsx                  # Dashboard multi-features + routes dynamiques
│   ├── pages/
│   │   └── Login.jsx            # Page de connexion (DRY UI)
│   └── ...                     # Identique à single-feature pour le reste
```

L'`App.jsx` multi-features contient :
- **`DashboardPage`** — Grille de cartes (DryCard) avec compteurs (DryBadge) pour chaque feature
- **`FeatureListPage`** — DryTable avec colonnes auto-détectées, boutons Edit/Delete
- **`FeatureCreatePage`** — DryInput pour chaque champ
- **`FeatureEditPage`** — DryInput pré-rempli avec les données existantes
- **Onglets de navigation** — Barre d'onglets pour basculer entre les features

### Angular

```
frontend/angular/<appName>/
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.css
│   └── app/
│       ├── app.module.ts
│       ├── app-routing.module.ts
│       ├── app.component.ts
│       ├── api/
│       │   └── api.service.ts   # HttpClient + JWT
│       └── pages/
│           ├── login.component.ts
│           ├── list.component.ts
│           ├── create.component.ts
│           └── edit.component.ts
├── angular.json
├── proxy.conf.json              # Proxy /api → localhost:5000
├── tsconfig.json
└── package.json
```

### React Native (Expo)

```
frontend/react-native/<appName>/
├── App.js                       # Navigation stack
├── app.json
├── babel.config.js
├── package.json
└── src/
    ├── api/
    │   ├── client.js            # Axios + AsyncStorage + détection plateforme
    │   └── crud.js              # createCrudApi() pour React Native
    └── screens/
        ├── LoginScreen.js
        ├── ListScreen.js
        ├── CreateScreen.js
        └── EditScreen.js
```

---

## Composants DRY UI

La bibliothèque `dry/ui/` contient **15 composants React** réutilisables, copiés automatiquement dans `src/components/dry-ui/` du projet généré.

| Composant | Fichier | Props principales |
|-----------|---------|-------------------|
| **DryButton** | `DryButton.jsx` | `variant`, `size`, `loading`, `fullWidth`, `type` |
| **DryInput** | `DryInput.jsx` | `label`, `type`, `value`, `onChange`, `placeholder`, `error`, `required` |
| **DrySelect** | `DrySelect.jsx` | `label`, `options`, `value`, `onChange`, `placeholder` |
| **DryTable** | `DryTable.jsx` | `data`, `loading`, `exclude`, `onEdit`, `onDelete`, `emptyText` |
| **DryCard** | `DryCard.jsx` | `padding`, `hoverable`, `className` |
| **DryBadge** | `DryBadge.jsx` | `variant` (success, warning, error, info) |
| **DryModal** | `DryModal.jsx` | `isOpen`, `onClose`, `title`, `children` |
| **DryForm** | `DryForm.jsx` | `onSubmit`, `loading`, `children` |
| **DryNavbar** | `DryNavbar.jsx` | `brand`, `links`, `user`, `role`, `onLogout`, `onRoleSwitch` |
| **DrySpinner** | `DrySpinner.jsx` | `variant` (default, overlay, inline, button), `text` |
| **DryAlert** | `DryAlert.jsx` | `variant` (success, error, warning, info), `message`, `dismissible` |
| **DryLayout** | `DryLayout.jsx` | `children`, `role` (intègre Navbar + RoleGuard) |
| **DryRoleGuard** | `DryRoleGuard.jsx` | `role`, `userRole`, `children` |

### Utilisation dans un projet généré

```jsx
import { DryButton, DryInput, DryTable, DryCard } from '../components/dry-ui';

<DryButton variant="primary" onClick={handleSave}>Enregistrer</DryButton>
<DryInput label="Email" type="email" value={email} onChange={setEmail} />
<DryCard padding={24}>
  <DryTable data={items} loading={isLoading} onEdit={handleEdit} />
</DryCard>
```

### Export central

Le fichier `dry/ui/index.js` exporte également les constantes :

```jsx
import { ROLES, ROLE_LABELS } from '../components/dry-ui';

// ROLES = { SUPERADMIN, ADMIN, MANAGER, CLIENT, USER, GUEST }
// ROLE_LABELS = { admin: 'Administrateur', client: 'Client', ... }
```

---

## Gestion des rôles

> ⚠️ **Note :** Le systeme de roles (`--role`, `DryRoleGuard`, `DryNavbar`) est **uniquement supporte pour React**. Les stacks Angular et React Native generent un CRUD simple sans gestion de roles.


Le flag `--role` (admin/client) a un **effet concret** sur le code généré :

### 1. Template variable `{{userRole}}`

Le rôle est injecté dans `App.jsx` via `DEFAULT_ROLE` :

```jsx
const DEFAULT_ROLE = 'admin';  // ou 'client' selon --role
const [userRole, setUserRole] = useState(DEFAULT_ROLE);
```

### 2. DryRoleGuard

Tous les composants sont protégés par `DryRoleGuard` qui vérifie que `userRole` correspond au rôle attendu.

```jsx
// Dans ProtectedRoute :
<DryRoleGuard role={role || DEFAULT_ROLE} userRole={DEFAULT_ROLE}>
  {children}
</DryRoleGuard>

// Dans AppLayout :
<DryRoleGuard role={userRole} userRole={DEFAULT_ROLE}>
  {children}
</DryRoleGuard>
```

### 3. Sélecteur de rôle dans DryNavbar

Le `DryNavbar` inclut un sélecteur de rôle (Admin/Client) qui met à jour `userRole` via `onRoleSwitch={setUserRole}`, ce qui déclenche un re-rendu des `DryRoleGuard`.

### 4. Effets du rôle

| Rôle | Accès |
|------|-------|
| **Admin** | Accès complet à toutes les fonctionnalités (lecture, création, modification, suppression) |
| **Client** | Accès limité défini par `canAccess()` dans `DryRoleGuard` |

---

## Référence CLI

### Usage

```bash
node scripts/generator/create-frontend.js [options]
```

### Options

| Option | Description | Exemple |
|--------|-------------|---------|
| `--app` | Application DRY cible | `--app scim` |
| `--feature` | Feature spécifique | `--feature property` |
| `--stack` | Stack frontend | `--stack react` |
| `--all` | Toutes les features | `--all` |
| `--role` | Rôle utilisateur | `--role admin` |

### Applications disponibles

Liste des applications dans `dryApp/` :

| App | Features |
|-----|----------|
| `FreeLLM` | API keys, conversations, models, settings |
| `LaStreet` | Categories, leads, professionals, subscriptions |
| `MediaDL` | Batches, downloads, presets |
| `SCIM` | Admin, Favoris, Message, Property, Reservation, Users |
| `SkillForge` | Categories, courses, ebooks, orders, reviews, students |
| `SpiritEmeraude` | Atelier, contact, formation, gallery, impact, product |

---

## Exemples

### 1. Créer un frontend React pour la feature Property de SCIM (mode admin)

```bash
node scripts/generator/create-frontend.js --app scim --feature property --stack react --role admin
```

Génère : `frontend/react/scim/` avec un CRUD pour `/api/v1/scim/property`

### 2. Créer un dashboard multi-features React pour SCIM

```bash
node scripts/generator/create-frontend.js --app scim --stack react --all --role admin
```

Génère : `frontend/react/scim/` avec 6 features + dashboard + navigation par onglets

### 3. Créer un frontend Angular pour une feature

```bash
node scripts/generator/create-frontend.js --app FreeLLM --feature models --stack angular
```

### 4. Créer une app mobile React Native

```bash
node scripts/generator/create-frontend.js --app LaStreet --feature leads --stack react-native
```

### 5. Mode interactif

```bash
node scripts/generator/create-frontend.js
# → Choisir app (numéro)
# → Choisir feature (numéro, ou 0 pour toutes)
# → Choisir stack (numéro)
# → Choisir rôle (1: Admin, 2: Client)
```

---

## Démarrage du projet généré

### React (Vite)

```bash
cd frontend/react/<appName>
npm install
npm run dev
# → http://localhost:3000
```

### Angular

```bash
cd frontend/angular/<appName>
npm install
ng serve --proxy-config proxy.conf.json
# → http://localhost:4200
```

### React Native (Expo)

```bash
cd frontend/react-native/<appName>
npm install
npx expo start
```

> **Note :** Le proxy Vite/Angular redirige les appels `/api/*` vers `http://localhost:5000` (serveur DRY).

---

## Architecture de l'API

Le frontend généré communique avec l'API DRY via Axios :

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `api.list(params)` | `GET /api/v1/<app>/<feature>` | Liste des éléments |
| `api.get(id)` | `GET /api/v1/<app>/<feature>/:id` | Détail d'un élément |
| `api.create(data)` | `POST /api/v1/<app>/<feature>` | Création |
| `api.update(id, data)` | `PUT /api/v1/<app>/<feature>/:id` | Mise à jour |
| `api.delete(id)` | `DELETE /api/v1/<app>/<feature>/:id` | Suppression |
| `auth.login(email, password)` | `POST /api/v1/user/login` | Connexion |

### Authentification JWT

Le token est automatiquement :
- 🔐 Injecté dans chaque requête (intercepteur Axios)
- 💾 Stocké dans `localStorage` (`dry_token`)
- 🔄 Récupéré au refresh de page
- 🚪 Supprimé à la déconnexion
- 🔀 Redirection vers `/login` en cas de 401

---

## Dépannage

### Erreur : "Aucune application trouvée dans dryApp/"

Le dossier `dryApp/` doit contenir au moins une application DRY avec un dossier `features/`.

```bash
ls dryApp/
# scim/  FreeLLM/  LaStreet/  MediaDL/  ...
```

### Erreur : "Feature introuvable"

Vérifiez le nom exact de la feature (sensible à la casse) :

```bash
ls dryApp/<appName>/features/
```

### Le proxy ne fonctionne pas

Vérifiez que le serveur DRY tourne sur le port 5000 :

```bash
# Démarrer le serveur DRY
node server.js
```

### Les composants DRY UI ne sont pas importés

Vérifiez que `dry/ui/` existe et contient les fichiers :

```bash
ls dry/ui/
# DryButton.jsx  DryInput.jsx  DryTable.jsx  ...
```

---

## Développement du générateur

### Architecture du code

Le générateur est structuré en 3 parties principales :

```
scripts/generator/create-frontend.js
├── Helpers (getAvailableApps, getAppFeatures, writeTemplate, copyDryUI)
├── Generateurs
│   ├── generateReact()        → React single-feature
│   ├── generateReactAll()     → React multi-features
│   ├── generateAngular()      → Angular single-feature
│   └── generateReactNative()  → React Native single-feature
└── CLI (parseCliArgs, main)
```

### Ajouter une nouvelle stack

1. Ajouter l'entrée dans `TEMPLATES`
2. Créer la fonction `generate<Stack>()`
3. Ajouter l'appel dans `main()`

### Ajouter un template de composant

Les templates sont des tableaux de strings concaténés avec `.join('\n')`. Les variables `{{var}}` sont remplacées par `writeTemplate()`.

```javascript
writeTemplate(dir('src/pages/MaPage.jsx'), [
  "import React from 'react';",
  "export default function MaPage() {",
  "  return <h1>{{titre}}</h1>;",
  "}",
].join('\n'), { titre: 'Bonjour' });
```

# 📘 Documentation Technique du Framework DRY

Ce document détaille l'architecture, les composants internes et le fonctionnement du framework **DRY (Don't Repeat Yourself)** utilisé dans ce projet. Il est destiné aux développeurs souhaitant comprendre le "moteur" sous le capot ou étendre ses fonctionnalités.

---

## 🏗️ Architecture Globale

Le projet est divisé en deux parties distinctes pour garantir une séparation claire entre le **Framework (Outils)** et le **Métier (Business)**.

### 1. `dry/` (Le Framework)
C'est le "noyau" du système. Ce dossier contient tout le code générique, réutilisable et agnostique du métier.
*   **Règle d'or** : Rien dans ce dossier ne doit faire référence à un client spécifique (ex: "LaStreet", "Voyage"). Tout doit être abstrait.
*   **Contenu** : Connexions DB, Middlewares de sécurité, Factories de contrôleurs, Plugins Mongoose globaux.

### 2. `dryApp/` (Les Applications Métier)
C'est ici que vivent les applications réelles (Tenants).
*   **Structure** : `dryApp/<NomDuClient>/features/<NomFeature>/`
*   **Exemple** : `dryApp/LaStreet/features/users/`
*   **Contenu** : Modèles (Schemas), Contrôleurs spécifiques (si besoin), Routes.

---

## 🔌 Le Plugin Mongoose Global (`dry.plugin.js`)

Le fichier `dry/core/plugins/mongoose.plugin.js` est **automatiquement injecté** dans TOUS les schémas créés via le framework. C'est lui qui assure la cohérence des données.

### Ce qu'il injecte automatiquement :
Si vous ne les définissez pas dans votre schéma, ces champs sont ajoutés par défaut :

| Champ | Type | Description |
| :--- | :--- | :--- |
| `status` | String | `enum: ['active', 'inactive', 'deleted', 'banned']`. Défaut : `'active'`. |
| `deletedAt` | Date | Date de suppression logique (Soft Delete). |
| `slug` | String | URL-friendly ID, généré automatiquement depuis le nom/titre/label. |
| `createdBy` | ObjectId | Référence vers l'User créateur. |
| `updatedBy` | ObjectId | Référence vers l'User modificateur. |
| `label` | String | Un nom lisible pour l'entité (généré auto si absent). |

### Gestion Automatique des Statuts (Soft Delete)
Le plugin intercepte les requêtes pour gérer le cycle de vie des données :

1.  **Suppression Logique (Soft Delete)** :
    *   Quand vous passez `status: 'deleted'`, le plugin remplit automatiquement `deletedAt` avec la date actuelle.
    *   La donnée n'est **jamais** supprimée physiquement de la base de données par défaut.

2.  **Filtrage Automatique** :
    *   Toutes les requêtes `find()`, `findOne()`, etc. excluent automatiquement les documents avec `status: 'deleted'`.
    *   **Pour voir les supprimés** : Il faut explicitement demander `{ includeDeleted: true }` ou filtrer sur `{ status: 'deleted' }`.

---

## 🏭 Les Factories

Les "usines" à code permettent de ne pas réécrire les opérations CRUD classiques.

### `modelFactory.js`
*   **Rôle** : Gère la connexion multi-tenant.
*   **Fonctionnement** : Au lieu de faire `mongoose.model('User')`, on fait `getModel('NomClient', 'User')`.
*   **Magie** : Il connecte dynamiquement le modèle à la base de données du client (`NomClientDB`) et applique le `dry.plugin.js`.

### `crudFactory.js`
*   **Rôle** : Génère les contrôleurs CRUD (Create, Read, Update, Delete) standard.
*   **Fonctionnement** :
    ```javascript
    const { getAll, create, getOne, update, deleteOne } = crudFactory(MonModele);
    ```
*   **Avantage** : Si on améliore la pagination ou le tri dans `crudFactory`, toutes les features en profitent immédiatement.

---

## 🛡️ Sécurité & Middlewares

Le dossier `dry/middlewares/` centralise la protection.

*   **`protect`** : Vérifie le JWT (Access Token).
*   **`authorize`** : Vérifie le rôle (admin, user, guide...).
*   **`security`** :
    *   **Sanitize** : Nettoie les injections NoSQL (ex: `$gt: ""`) via `express-mongo-sanitize`.
    *   **Helmet** : Sécurise les headers HTTP.
    *   **RateLimit** : Bloque les attaques par force brute (trop de requêtes).

---

## 🚀 Comment "Prendre la Main" (Workflow)

Pour créer une nouvelle fonctionnalité sans casser l'existant :

1.  **Utiliser le Générateur** (Recommandé) :
    ```bash
    npm run create-feature
    ```
    *   Il crée les dossiers `model`, `controller`, `route`.
    *   Il pré-remplit les fichiers avec les standards DRY.

2.  **Définir le Modèle (`.schema.js`)** :
    *   Ne mettez QUE vos champs métier (prix, description, date...).
    *   Ne mettez PAS `status`, `slug`, `createdAt` (le plugin s'en charge).

3.  **Personnaliser le Contrôleur (`.controller.js`)** :
    *   Par défaut, il utilise `crudFactory`.
    *   Pour une logique custom, écrasez une méthode :
        ```javascript
        exports.createCustom = async (req, res, next) => {
            // Votre logique ici
        };
        ```

4.  **Déclarer la Route (`.routes.js`)** :
    *   Ajoutez les middlewares `protect` et `authorize` si nécessaire.
    *   Liez votre contrôleur.

---

## 💡 Idées pour étendre le Plugin Global

Si vous voulez ajouter plus de puissance à `dry.plugin.js` :

1.  **Auto-Populate** :
    *   Ajouter un hook `pre(/^find/)` pour toujours peupler `createdBy` (savoir qui a créé l'item).
2.  **Historique / Versionning** :
    *   Créer une collection `AuditLog` à chaque modification pour garder l'ancien état.
3.  **Masquage de Champs** :
    *   Ajouter une méthode `toJSON` pour retirer automatiquement `__v` ou des champs privés lors de l'envoi au front.

# 👨‍💻 Guide du Développeur (Developer Guide)

Ce guide t'explique comment créer des applications et des fonctionnalités avec DRY sans écrire de code répétitif.

## 🌟 Concept Clé : "Tout est généré"
Avec DRY, tu n'écris pas les fichiers à la main. Tu utilises le **Générateur**.

## 1️⃣ Créer une Nouvelle Application
Une "Application" (ou Tenant) est un projet indépendant (ex: `LaStreet`, `ImmoPro`, `UberClone`) hébergé sur ton serveur.

1. **Lancer le générateur** :
   ```bash
   npm run create-app
   ```
2. **Suivre les instructions** :
   - Choisir `Application`
   - Nom de l'app : `MonSuperProjet`
   - Description : `Une super app de test`

👉 Cela crée un dossier `dryApp/MonSuperProjet/`.

## 2️⃣ Ajouter une Fonctionnalité (Feature)
Une "Feature" est une brique de ton application (ex: `products`, `orders`, `comments`).

1. **Lancer le générateur** :
   ```bash
   npm run create-app
   ```
2. **Suivre les instructions** :
   - Choisir `Feature`
   - Sélectionner l'application cible (ex: `MonSuperProjet`)
   - Nom de la feature : `products`
   - **Définir les champs** (Le générateur va te demander les détails) :
     - Champ 1 : `name` (String, requis)
     - Champ 2 : `price` (Number, requis)
     - Champ 3 : `description` (String)
     - etc.

👉 Cela crée automatiquement :
- `model/product.schema.js` (La structure de données)
- `route/products.routes.js` (Les URLs API)

### 🚀 NOUVEAU : La Puissance du `routerFactory`
Depuis la version 3.5, tu n'as plus besoin de créer 5 fichiers de contrôleurs séparés. La **`routerFactory`** s'occupe de tout.

Exemple dans `route/products.routes.js` :
```javascript
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const router = buildCrudRouter('Product', ProductSchema, {
  auth: { create: 'admin', update: 'admin', delete: 'admin' },
  caching: { list: 300 }
});
```

## 3️⃣ Personnaliser ton Code
Le code généré est fonctionnel à 100%, mais tu peux le modifier.

### Modifier le Modèle (`schema.js`)
Ouvre `dryApp/MonSuperProjet/features/products/model/product.schema.js`.
Tu peux ajouter des règles de validation Mongoose classiques.

### Modifier la Logique (Hooks & Transformers)
Si tu as besoin de modifier les données avant de les enregistrer (ex: upload d'images), utilise les `crudOptions` dans ton routeur :

```javascript
crudOptions: {
  transformInput: async ({ req, payload }) => {
    if (req.files) payload.images = req.files.map(f => f.path);
    return payload;
  }
}
```

## 4️⃣ Tester
Une fois ta feature générée :
1. Va dans le dossier de ta feature : `dryApp/MonSuperProjet/features/products/`.
2. Ouvre le fichier **`TEST_CURL.md`**.
3. Copie-colle les commandes dans ton terminal (Git Bash) pour tester immédiatement !

---

## ⏭️ Prochaine étape
Comprends comment tester efficacement avec le **[Guide de Test](./04_TESTING_GUIDE.md)**.

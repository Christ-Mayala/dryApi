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
- `controller/...` (Toutes les actions CRUD : Créer, Lire, Modifier, Supprimer)
- `route/products.routes.js` (Les URLs API)
- `TEST_CURL.md` (Les commandes pour tester tout de suite !)

## 3️⃣ Personnaliser ton Code
Le code généré est fonctionnel à 100%, mais tu peux le modifier.

### Modifier le Modèle (`schema.js`)
Ouvre `dryApp/MonSuperProjet/features/products/model/product.schema.js`.
Tu peux ajouter des règles :
```javascript
price: { 
    type: Number, 
    required: true, 
    min: [0, 'Le prix ne peut pas être négatif'] // Ajout d'une validation
}
```

### Modifier la Logique (`controller.js`)
Les contrôleurs sont dans `dryApp/MonSuperProjet/features/products/controller/`.
Par défaut, ils utilisent la `crudFactory` (magique). Si tu veux changer le comportement :

1. Ouvre le fichier du contrôleur (ex: `products.create.controller.js`).
2. Remplace la logique par la tienne.

## 4️⃣ Tester
Une fois ta feature générée :
1. Va dans le dossier de ta feature : `dryApp/MonSuperProjet/features/products/`.
2. Ouvre le fichier **`TEST_CURL.md`**.
3. Copie-colle les commandes dans ton terminal (Git Bash) pour tester immédiatement !

---

## ⏭️ Prochaine étape
Comprends comment tester efficacement avec le **[Guide de Test](./04_TESTING_GUIDE.md)**.

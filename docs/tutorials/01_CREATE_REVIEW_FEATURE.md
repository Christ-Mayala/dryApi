# 🛠️ Tutoriel : Créer ta première Feature "Review"

Dans ce tutoriel, nous allons ajouter un système de **Commentaires (Reviews)** à une application existante. 

Nous allons utiliser la méthode **Ultra-DRY** avec la `routerFactory`.

---

## Étape 1 : Créer le dossier
Va dans `dryApp/MaSuperApp/features/` et crée un dossier `review/`.
À l'intérieur, crée trois dossiers : `model/`, `route/` et `controller/`.

## Étape 2 : Définir le Schéma (`model/review.schema.js`)
C'est ici que tu décris à quoi ressemble un commentaire.

```javascript
const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  author: { type: String, required: true },
  content: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }
});

module.exports = ReviewSchema;
```

## Étape 3 : Créer les Routes (`route/review.routes.js`)
On utilise la `routerFactory` pour éviter d'écrire du code répétitif.

```javascript
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const ReviewSchema = require('../model/review.schema');

// Cette commande génère les 5 routes CRUD d'un coup !
const router = buildCrudRouter('Review', ReviewSchema, {
  auth: { 
    create: 'user', // N'importe quel utilisateur connecté peut commenter
    delete: 'admin' // Seul l'admin peut supprimer
  },
  caching: { list: 60 } // On cache la liste pendant 1 minute
});

module.exports = router;
```

## Étape 4 : Tester ! 🚀
1.  Lance ton serveur : `npm run dev`.
2.  Ouvre **Swagger** : `http://localhost:5000/api-docs`.
3.  Cherche la section de ton application.
4.  Tu verras les nouvelles routes `/review` apparaître par magie !

---

### 💡 Le savais-tu ?
Grâce au **Plugin DRY**, tes commentaires auront automatiquement :
- Un `slug` (si tu ajoutes un champ title).
- Des champs `createdAt` et `updatedAt`.
- Un champ `status` (active/deleted) pour le Soft Delete.
- Les infos de l'utilisateur qui a créé le commentaire via `createdBy`.

---
*Tu as fini le tutoriel ! Tu es prêt à construire des APIs complexes à la vitesse de l'éclair.*

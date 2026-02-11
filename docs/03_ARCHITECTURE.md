# 🏗️ Architecture & Concepts (Under the Hood)

Ce document explique comment DRY fonctionne "sous le capot". Utile pour comprendre la magie.

## 🧠 Le Noyau (Kernel) vs Les Apps
Le projet est séparé en deux mondes :

1. **`dry/` (Le Framework)** : C'est le moteur. Il contient tout ce qui est technique et répétitif (Connexion BDD, Sécurité, Gestion d'erreurs). **On ne touche jamais à ce dossier** pour des besoins métier.
2. **`dryApp/` (Les Applications)** : C'est ton code métier. Chaque dossier ici est une application isolée.

## 🏢 Le Multi-Tenant (Isolation des Données)
DRY est conçu pour héberger plusieurs clients sur le même serveur sans mélanger leurs données.

### Comment ça marche ?
1. Une requête arrive sur `/api/v1/lastreet/products`.
2. Le système détecte le segment `lastreet`.
3. Il active la connexion à la base de données `LaStreetDB`.
4. Si une autre requête arrive sur `/api/v1/immopro/products`, il active `ImmoProDB`.

**Résultat** : Même si le code est le même, les données sont physiquement séparées.

## 🔌 Le Plugin Mongoose (Champs Automatiques)
Tu as remarqué que tes objets ont des champs que tu n'as pas créés (`slug`, `status`, `deletedAt`) ? C'est le **Plugin DRY**.

Il est injecté automatiquement dans tous tes modèles et gère :
- **Soft Delete** : Quand tu supprimes, ça met juste `status: 'deleted'`. La donnée reste en base mais devient invisible.
- **Audit** : Remplit `createdBy` et `updatedBy` automatiquement avec l'ID de l'utilisateur connecté.
- **Slugs** : Génère une URL propre (ex: "Mon Super Produit" -> "mon-super-produit") pour le SEO.

## 🏭 Les Factories (Usines à Code)
Pour éviter de copier-coller 50 fois le même code CRUD (Create, Read, Update, Delete), DRY utilise des "Factories".

- **`modelFactory`** : Charge le bon modèle pour la bonne base de données.
- **`crudFactory`** : Génère les fonctions de contrôleur standard (getAll, getOne, create, update, delete).

## 🛡️ Sécurité (Par défaut)
Tout est sécurisé sans que tu y penses :
- **Helmet** : Cache les infos du serveur.
- **Mongo Sanitize** : Empêche les pirates d'injecter des commandes NoSQL.
- **Rate Limit** : Bloque les gens qui spam ton API.
- **JWT** : Authentification par token sécurisée.

---

## ⏭️ Prochaine étape
Découvre les outils pour valider ton travail dans le **[Guide de Test](./04_TESTING_GUIDE.md)**.

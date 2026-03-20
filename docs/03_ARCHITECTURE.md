# 🏗️ Architecture & Concepts (Niveau Expert)

Ce document décortique le fonctionnement interne du framework DRY. Comprendre ces concepts est essentiel pour ne pas "subir" l'architecture mais la maîtriser pour bâtir des systèmes complexes.

---

## 1. La Séparations des Responsabilités : Kernel vs Business

L'architecture est scindée en deux couches hermétiques :

### 🛡️ Le Kernel (`dry/`)
C'est le "Cœur" du système. On n'y touche **JAMAIS** pour du code métier. Il contient :
- **Services Globaux** : Alertes (Resend), Uploads (Cloudinary), Notifications (Socket.io).
- **Middlewares Core** : Identification du tenant, Protection Auth, Audit, Cache.
- **Factories** : `crudFactory` et `routerFactory`.
- **Infrastructure** : Connexion MongoDB, gestion des erreurs chirurgicales.

### 💼 Le Business Layer (`dryApp/`)
C'est ton espace de travail. Ici, tu définis la valeur de ton application :
- **Apps (Tenants)** : Chaque dossier est un client isolé.
- **Features** : Chaque dossier est un module métier (ex: `product`, `order`).
- **Modèles** : Définis par des Schémas Mongoose simples.

---

## 2. Le Moteur Multi-Tenant Dynamique 🏢

L'un des plus grands atouts de DRY est sa capacité à gérer des bases de données multiples avec un seul code source.

### Comment se fait la commutation ?
Lorsqu'une requête arrive, le middleware `tenantContext` (dans `dry/middlewares/context`) analyse l'URL. 
Si l'URL contient `spiritemeraude`, le système :
1. Récupère la configuration de base de données spécifique à ce client.
2. Utilise `modelFactory` pour "linker" tes schémas à cette base précise.
3. Injecte cette connexion dans `req.getModel()`.

> [!IMPORTANT]
> Ne fais jamais `const MyModel = mongoose.model(...)`. 
> Utilise toujours `const Model = req.getModel(...)` pour garantir que tu parles à la bonne base de données du bon client.

---

## 3. Le Plugin DRY (L'ADN de tes données) 🔌

Chaque modèle dans DRY reçoit automatiquement un "ADN" technique via un plugin Mongoose global. 
Cela signifie que même si tu ne les définis pas, tes objets auront toujours :

- **`status`** : `active`, `inactive`, `deleted`, `banned`.
- **`slug`** : Une version textuelle "URL-friendly" générée depuis ton champ `label`.
- **Soft Delete** : La donnée n'est jamais supprimée de `MongoDB`. Elle passe juste en `status: deleted` et disparait des API via des filtres globaux.
- **Audit Trace** : `createdBy` et `updatedBy` stockent automatiquement l'ID de l'utilisateur ayant fait l'action.

---

## 4. La Puissance des Factories 🏭

Pourquoi écrire 100 lignes quand 5 suffisent ?

- **`routerFactory`** : Un robot qui assemble les middlewares (auth, cache, audit, validation) et les branche sur les handlers CRUD.
- **`crudFactory`** : Une usine qui génère les fonctions de contrôleur en gérant de base :
  - La pagination intelligente via `queryBuilder`.
  - Le tri dynamique.
  - La gestion des erreurs 404 automatique.

---

## 🚀 Résumé pour le Développeur
Tu fournis le **Schéma** (quoi stocker) et le **Routeur** (comment sécuriser). 
DRY s'occupe de la **Base de données**, de la **Sécurité**, du **Cache** et du **Monitoring**.

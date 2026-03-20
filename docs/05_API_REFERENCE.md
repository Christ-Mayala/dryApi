# 📚 Référence API & Standardisation

Ce document définit les standards de communication de l'API DRY. Toutes les features respectent ces règles sans exception.

---

## 1. Format de Réponse Standard (JSON) 📦

Toutes les réponses suivent cette structure pour faciliter l'intégration frontend :

```json
{
  "success": true,
  "message": "Opération réussie",
  "data": { ... },
  "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "pages": 10
  }
}
```

---

## 2. Query Builder (Filtrage de Niveau Expert) 🔍

Grâce au `queryBuilder` intégré dans la `crudFactory`, toutes tes routes `GET /` supportent des filtres ultra-puissants sans coder une seule ligne supplémentaire.

### Paramètres de base :
- **Pagination** : `?page=2&limit=20`
- **Tri** : `?sort=-createdAt` (Le signe `-` inverse l'ordre).
- **Sélection de champs** : `?select=title,price` (Réduit la taille de la réponse).

### Filtres Avancés :
- **Comparaison** : `?price[gt]=100` (plus grand que), `?price[lte]=50` (plus petit ou égal).
- **Recherche textuelle** : `?label[regex]=TermeDeRecherche&label[options]=i` (insensible à la casse).

---

## 3. Codes HTTP Utilisés 🚥

- **200 OK** : Tout s'est bien passé.
- **201 Created** : Un nouvel objet a été créé.
- **400 Bad Request** : Erreur de validation (Joi/Mongoose).
- **401 Unauthorized** : Pas de token ou token expiré.
- **403 Forbidden** : Privilèges insuffisants (ex: Admin requis).
- **404 Not Found** : La ressource n'existe pas.
- **429 Too Many Requests** : Spam détecté (Rate Limit).

---

## 4. Champs Automatiques (DRY Meta) 🧬

Chaque objet retourné par l'API contient des métadonnées générées par le Kernel :
- `_id` : Identifiant unique MongoDB.
- `slug` : URL propre (ex: `mon-super-produit`).
- `status` : État (`active`, `deleted`).
- `createdBy` / `updatedBy` : Identifiants des auteurs.

---

## 💡 Conseil pour le Frontend
Utilise toujours le champ `slug` pour tes URLs côté client (ex: `/product/mon-super-produit`) plutôt que l'ID (`/product/64f1a2...`). C'est bien meilleur pour le SEO et l'expérience utilisateur.

---
*L'API est ton langage, la standardisation est ta grammaire.*

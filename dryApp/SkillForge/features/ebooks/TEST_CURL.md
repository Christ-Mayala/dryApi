# 🚀 Commandes cURL pour tester ebooks

Ces commandes permettent de tester rapidement votre API depuis un terminal.
Assurez-vous d'avoir un token JWT valide (login admin).

## 🌍 Variables d'environnement
Copiez ces lignes dans votre terminal (Git Bash recommandé sur Windows) :

```bash
export BASE_URL="http://localhost:5000/api/v1/skillforge/ebooks"
# Remplacez par votre token réel.
# Pour obtenir un token, faites un POST sur : http://localhost:5000/api/v1/skillforge/user/login
export TOKEN="votre_token_jwt_ici"
```

## 1️⃣ Lister (GET)
Récupérer la liste paginée des éléments.

```bash
curl -X GET "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

## 2️⃣ Créer (POST)
Créer un nouvel élément.

```bash
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
  "title": "exemple_title",
  "author": "exemple_author",
  "price": 100,
  "summary": "exemple_summary",
  "pages": 100,
  "format": "exemple_format",
  "coverUrl": "exemple_coverUrl",
  "fileUrl": "exemple_fileUrl",
  "label": "exemple_label"
}'
```

## 3️⃣ Voir détails (GET ID)
Remplacez `ID_ICI` par l'ID retourné lors de la création.

```bash
# Exemple ID: 64f1a2b3c4d5e6f7a8b9c0d1
curl -X GET "$BASE_URL/ID_ICI" \
  -H "Authorization: Bearer $TOKEN"
```

## 4️⃣ Mettre à jour (PUT)
Modifier un élément existant.

```bash
curl -X PUT "$BASE_URL/ID_ICI" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
  "title": "exemple_title",
  "author": "exemple_author",
  "price": 100,
  "summary": "exemple_summary",
  "pages": 100,
  "format": "exemple_format",
  "coverUrl": "exemple_coverUrl",
  "fileUrl": "exemple_fileUrl",
  "label": "exemple_label"
}'
```

## 5️⃣ Supprimer (DELETE)
Suppression logique (soft delete).

```bash
curl -X DELETE "$BASE_URL/ID_ICI" \
  -H "Authorization: Bearer $TOKEN"
```

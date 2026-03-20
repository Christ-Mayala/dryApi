# 🧪 Guide de Test & Validation (Surgical Testing)

Un expert ne teste pas au hasard. Ce guide t'apprend à valider ton travail avec la précision d'un ingénieur senior.

---

## 1. La Méthode "CURL Rapide" (L'Essentiel) ⚡

Chaque feature générée possède son propre fichier **`TEST_CURL.md`**. 
C'est ta première ligne de défense.

### Workflow d'Expert :
1.  **Authentification** : Récupère ton token JWT via `POST /api/v1/{app}/user/login`.
2.  **Export du Token** : `export TOKEN="ton_token_ici"` dans ton terminal.
3.  **Exécution** : Copie-colle les commandes du fichier pour tester le CRUD (Lister, Créer, Voir, Modifier, Supprimer).

---

## 2. Validation Industrielle (Automatisée) 🤖

DRY inclut un moteur de test automatisé. Il ne se contente pas de vérifier si "ça répond", il vérifie la structure des données.

### Lancer les tests :
- **Tous les tests** : `npm run test`
- **Uniquement ton application** : `npm run test:app -- --app=TestGuru`
- **Une seule feature spécifique** : `npm run test:feature -- --app=TestGuru --feature=lesson`

---

## 3. Débogage Chirurgical (Que faire en cas d'erreur ?) 🐞

Grâce au **Surgical Error Handling**, tu ne devrais jamais être perdu.

- **400 Bad Request** : Joi a bloqué la requête. Regarde le champ `message` pour voir quel champ est invalide.
- **401/403** : Problème de permissions. Vérifie si tu as le rôle `admin` dans ton profil utilisateur.
- **500 Internal Error** : Consulte immédiatement tes emails ! Tu recevras un rapport avec l'extrait de code exact de l'erreur.
- **Délai de Réponse Long** : Vérifie l'état de Redis ou de MongoDB via `GET http://localhost:5000/status`.

---

## 4. Outils Graphiques (Postman / Swagger) 🎨

- **Swagger (Recommandé)** : [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
  C'est l'outil le plus précis car il est généré directement depuis ton code. Utilise le bouton "Authorize" en haut à droite pour coller ton Token.
- **Postman** : Tu peux générer une collection Postman via `npm run postman:generate`.

---

## 💡 Pro Tip : Test de Charge (Stress Test)
Si tu veux tester la robustesse de ton API avant la mise en ligne, utilise l'outil `ab` (Apache Benchmark) :
`ab -n 100 -c 10 http://localhost:5000/api/v1/lastreet/product`
*(Envoie 100 requêtes avec 10 connexions simultanées)*

---
*Un test réussi est un test qui a tenté de casser le code.*

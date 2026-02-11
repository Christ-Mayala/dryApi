# 🧪 Guide de Test & Validation

Une fois ta fonctionnalité générée, comment savoir si elle marche ? Ce guide t'explique tout.

## 🚀 La Méthode "CURL Rapide"

À chaque génération de feature, DRY crée un fichier magique : **`TEST_CURL.md`**.
Il se trouve dans `dryApp/<TonApp>/features/<TaFeature>/TEST_CURL.md`.

### Comment l'utiliser ?

1. **Ouvre ton terminal** (Git Bash sur Windows est recommandé).
2. **Récupère un Token** (Si ta route est protégée) :
   - Connecte-toi via la route `/login` (voir section Auth).
   - Copie le token reçu (ex: `eyJhbGciOiJIUzI1...`).
   - Exporte-le dans une variable pour ne pas le retaper :
     ```bash
     export TOKEN="ton_token_ici"
     ```

3. **Copie-colle les commandes** :
   Le fichier `TEST_CURL.md` contient des commandes prêtes à l'emploi.

   *Exemple de création :*
   ```bash
   curl -X POST http://localhost:5000/api/v1/monapp/products \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"name": "Test Produit", "price": 100}'
   ```

## 🔍 Tester avec Postman / Insomnia (Alternative)

Si tu préfères une interface graphique :
1. Importe l'URL de ton API.
2. Dans l'onglet **Auth**, choisis **Bearer Token**.
3. Colle ton token JWT.
4. Lance tes requêtes.

## 🐞 En cas d'erreur

- **401 Unauthorized** : Ton token est invalide ou expiré. Refais un login.
- **403 Forbidden** : Tu es connecté, mais tu n'as pas le droit (ex: il faut être admin).
- **400 Bad Request** : Tu as oublié un champ obligatoire ou le format est mauvais. Regarde le message d'erreur, DRY te dit exactement ce qui manque (ex: `"price" is required`).
- **500 Internal Server Error** : Oups, un bug serveur. Regarde les logs dans ton terminal `npm run dev` pour comprendre.

---

## ⏭️ Prochaine étape
Consulte la **[Référence API](./05_API_REFERENCE.md)** pour connaître toutes les options de filtrage et de tri disponibles.

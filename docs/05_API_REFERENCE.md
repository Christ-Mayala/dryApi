# 📚 Référence API (QueryBuilder)

Toutes les routes de liste (`GET /`) dans DRY bénéficient d'un moteur de recherche surpuissant. Tu n'as rien à coder, ça marche tout seul.

## 🔍 Filtrage Simple
Ajoute simplement `?champ=valeur` dans l'URL.

- **Égalité** : `?role=admin`
- **Champs imbriqués** : `?address.city=Paris`

## ⚡ Opérateurs Avancés
Tu peux utiliser des opérateurs spéciaux pour affiner ta recherche :

| Opérateur | Description | Exemple URL |
| :--- | :--- | :--- |
| `gt` | Plus grand que (Greater Than) | `?price[gt]=100` (Prix > 100) |
| `gte` | Plus grand ou égal | `?price[gte]=100` |
| `lt` | Plus petit que (Less Than) | `?price[lt]=50` |
| `lte` | Plus petit ou égal | `?price[lte]=50` |
| `in` | Dans une liste | `?status[in]=active,pending` |
| `ne` | Différent de (Not Equal) | `?role[ne]=admin` |
| `regex` | Recherche textuelle (contient) | `?name[regex]=iphone` (Cherche "iphone" partout) |

## 📄 Pagination
Par défaut, l'API renvoie 10 résultats par page.

- **Choisir la page** : `?page=2`
- **Changer la limite** : `?limit=20`

## 🔃 Tri (Sorting)
- **Croissant** : `?sort=price` (du moins cher au plus cher)
- **Décroissant** : `?sort=-price` (du plus cher au moins cher, note le `-`)
- **Multiple** : `?sort=-createdAt,price` (Les plus récents d'abord, puis par prix)

## 🎯 Sélection de Champs (Projection)
Pour optimiser la bande passante, tu peux demander seulement certains champs.

- **Inclure** : `?fields=name,price` (Ne renvoie que le nom et le prix)
- **Exclure** : `?fields=-password,-v` (Renvoie tout SAUF le mot de passe et la version)

## 🗑️ Gestion du Soft Delete
Par défaut, les éléments supprimés sont masqués.
- **Voir les supprimés** : Ajoute `?includeDeleted=true` (nécessite souvent des droits admin).

---

## ⏭️ Prochaine étape
Prêt pour le grand saut ? Regarde comment **[Mettre en Production](./06_DEPLOYMENT.md)**.

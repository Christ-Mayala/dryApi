# Stockage des fichiers et des images

Ce guide décrit les services de stockage communs du noyau DRY et leur usage dans les applications. Les identifiants d'accès restent dans le fichier `.env` local : ils ne doivent jamais être copiés dans la documentation, le dépôt Git ou le frontend.

## Règle de stockage

| Contenu | Service prévu | Détails |
| --- | --- | --- |
| Images et couvertures | Cloudinary | Le service Cloudinary déjà utilisé par les projets reste inchangé. |
| Fichiers PDF privés | Cloudflare R2 | Le noyau DRY fournit un adaptateur S3 partagé et les lectures se font avec des URL signées temporaires. |

### État actuel de la bibliothèque numérique anglaise

- Les couvertures de livres et les images de catégories utilisent Cloudinary.
- Les PDF de livres sont stockés dans R2. MongoDB conserve leurs métadonnées et leur clé d'objet, pas le contenu PDF.
- Les 147 images de catégories ont été migrées de R2 vers Cloudinary (`english_digital_library/categories/`). MongoDB contient pour chacune l'identifiant public Cloudinary, l'URL sécurisée et les informations de source/licence disponibles.
- Le gestionnaire de catégories enregistre les nouvelles images directement dans Cloudinary.
- L'accès R2 avec les clés actuellement présentes dans `.env` renvoie `AccessDenied`, y compris pour une lecture via le SDK. Les clés doivent être renouvelées dans Cloudflare avant de stocker ou lire de nouveaux PDF dans R2.

## Configuration Cloudflare R2

La configuration est chargée par `config/database.js` depuis l'environnement de l'API.

| Variable | Description |
| --- | --- |
| `R2_ACCOUNT_ID` | Identifiant du compte Cloudflare. |
| `R2_ACCESS_KEY_ID` | Identifiant de la clé S3 du bucket. |
| `R2_SECRET_ACCESS_KEY` | Clé secrète S3. Garder cette valeur uniquement dans un gestionnaire de secrets ou le `.env` local ignoré par Git. |
| `R2_BUCKET_NAME` | Bucket par défaut de l'adaptateur. |
| `R2_JURISDICTION` | Juridiction R2 facultative : `eu`, `us` ou `fedramp`. Ne la renseigner que si le bucket appartient réellement à cette juridiction. |
| `R2_ENDPOINT` | Endpoint S3 facultatif. Pour un bucket juridictionnel, utiliser `https://<account-id>.<juridiction>.r2.cloudflarestorage.com`. Le bucket est renseigné séparément. |
| `R2_PUBLIC_BASE_URL` | Domaine public facultatif. Laisser vide pour un bucket privé et utiliser des URL signées. |

Pour cette installation, le bucket configuré est `bibliotheque-pdf-client`. L'endpoint du compte sans suffixe de juridiction est utilisé et l'adaptateur signe les requêtes avec la région `auto`. Ne pas ajouter le nom du bucket à `R2_ENDPOINT`.

Les clés S3 ont été partagées dans une conversation et doivent être renouvelées dans Cloudflare. Tant que ce n'est pas fait, les lectures et écritures R2 échouent avec `AccessDenied` ; c'est pourquoi les images de catégories ont été déplacées vers Cloudinary. Le fichier [.env.example](../.env.example) contient seulement les noms de variables, jamais les valeurs secrètes.

## Réutiliser R2 dans une autre application DRY

Le service partagé se trouve dans [`dry/services/storage/r2ObjectStorage.service.js`](../dry/services/storage/r2ObjectStorage.service.js). Il permet d'envoyer, lire, signer et supprimer des objets sans ajouter une implémentation S3 dans chaque application.

Depuis le service d'une feature sous `dryApp/<Application>/features/<feature>/service/` :

```js
const { createR2Storage } = require('../../../../../dry/services/storage/r2ObjectStorage.service');

// Le préfixe réserve un espace de noms à cette application dans le bucket partagé.
const stockage = createR2Storage({ prefix: 'mon-application' });

const fichier = await stockage.upload({
  key: 'rapports/rapport.pdf',
  body: bufferPdf,
  contentType: 'application/pdf',
  cacheControl: 'private, no-store',
});

// Enregistrer fichier.key dans MongoDB, puis signer une lecture après autorisation.
const urlTemporaire = await stockage.signedReadUrl(fichier.key, { expiresIn: 300 });
await stockage.remove(fichier.key);
```

Méthodes disponibles : `upload`, `get`, `signedReadUrl`, `remove` et `objectUrl`. `createR2Storage()` reprend la configuration partagée ; les options `bucket`, `endpoint`, `accountId`, `accessKeyId`, `secretAccessKey` et `prefix` permettent de la spécialiser. Utiliser un préfixe par application pour éviter les collisions. En base, stocker la clé d'objet ; une URL signée expire et doit être générée au moment de la lecture.

## Organisation des fichiers de la bibliothèque

- PDF : `english_digital_library/documents/` dans R2.
- Images de catégories : `english_digital_library/categories/` dans Cloudinary.
- MongoDB conserve les clés, les URL et les métadonnées associées.
- Les URL de lecture des PDF sont signées à la demande ; le bucket R2 peut donc rester privé.
- Les visuels des catégories peuvent être réimportés ou réparés avec `npm run seed:library-category-images`. Le script ignore les catégories déjà présentes dans Cloudinary et utilise les visuels locaux en repli si Wikimedia Commons ne répond pas.

## Fichiers de référence

- Configuration centralisée : [`config/database.js`](../config/database.js) et [`.env.example`](../.env.example)
- Adaptateur R2 commun : [`dry/services/storage/r2ObjectStorage.service.js`](../dry/services/storage/r2ObjectStorage.service.js)
- Service de fichiers de la bibliothèque : [`dryApp/EnglishDigitalLibrary/features/books/service/storage.service.js`](../dryApp/EnglishDigitalLibrary/features/books/service/storage.service.js)
- Catégories de la bibliothèque : [`dryApp/EnglishDigitalLibrary/features/categories/service/category.service.js`](../dryApp/EnglishDigitalLibrary/features/categories/service/category.service.js)

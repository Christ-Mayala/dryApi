# NOVA — guide de déploiement et d'exploitation

Date : 2026-11-21. Ce document décrit la procédure à suivre **après** validation des modifications locales. Les migrations réelles (hormis la 006 en développement local), la rotation de clé, la suppression définitive et la configuration sensible nécessitent une autorisation explicite.

## 1. Pré-requis

### Variables d'environnement serveur

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `NOVA_CONNECTION_ENCRYPTION_KEY` | Oui dès qu'une connexion stocke un secret | Clé base64 de 32 octets pour AES-256-GCM. Sans clé valide, l'écriture **et** la lecture d'un secret chiffré échouent explicitement, sans repli en clair. |
| `NOVA_WEBHOOK_HOSTS` | Recommandé | Liste d'hôtes autorisés pour les webhooks de connexion (séparés par des virgules). Par défaut : `hooks.slack.com`. HTTPS obligatoire, DNS privé/loopback/link-local refusé. |

Génération de la clé :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

La clé doit être fournie dans l'environnement du processus, jamais commitée ni stockée dans la base. Si elle est perdue ou remplacée, les secrets déjà chiffrés ne peuvent plus être lus : prévoir un plan de réchiffrement avec la migration 004 ou une procédure équivalente.

### Vérifications avant déploiement

Depuis `D:\Alvine\dryApi` :

```powershell
node --check <chaque fichier JS modifié>
npx eslint <fichiers modifiés et nouveaux>
npx prettier --check <fichiers NOVA modifiés>
npx jest tests/unit/nova --runInBand --silent
npm run test:unit
```

Résultats observés au 2026-11-21 : **8 suites / 51 tests NOVA réussis** et **28 suites / 224 tests unitaires réussis** (avertissements Jest non bloquants : `setupFilesAfterFramework` inconnu, worker forcé à sortir, journaux `TrividaReferral`).

Depuis `D:\Alvine\notion` :

```powershell
npm run typecheck
npm run build
```

Résultat attendu : compilation réussie et 22 pages générées. `npm run lint` n'est pas utilisable en non-interactif tant qu'ESLint n'a pas été configuré ; la phase lint/type du build passe.

## 2. Migrations

Les migrations 004 et 005 sont fournies mais **non exécutées** ; la 006 a été exécutée sur la base de développement `NovaDB` avec accord explicite. Elles doivent être lues et validées d'abord sur un environnement non productiel.

### 003 — rôles NOVA globaux : obsolète

`migrations/003-nova-explicit-roles.js` ne fait plus rien : le modèle « un rôle NOVA par compte » a été remplacé par une appartenance par espace de travail. Elle est conservée uniquement pour l'historique et un éventuel rollback d'un déploiement antérieur. **Ne pas la présenter comme une migration de backfill.**

### 004 — chiffrement des secrets historiques

`migrations/004-nova-encrypt-connection-secrets.js` chiffre les configurations de connexion restées en clair. `NOVA_CONNECTION_ENCRYPTION_KEY` doit être présente avant l'exécution. Le `down` déchiffre les valeurs concernées.

### 005 — appartenances workspace-scoped (nouvelle)

`migrations/005-nova-workspace-memberships.js` est non destructive et idempotente. Elle :

1. crée la fiche propriétaire manquante pour chaque workspace dont le créateur existe ;
2. traduit les anciens rôles globaux du compte en rôle local dans le workspace qu'il a créé ;
3. renseigne `pages.workspaceId` depuis l'espace d'équipe ou le workspace créé par l'auteur ;
4. retire `espaceId` des pages privées ;
5. crée les index uniques composites sur `membres` (nom de collection corrigé).

Les champs `novaRole` / `novaPermissions` / `novaEspaceIds` des comptes ne sont **pas supprimés** : ils restent disponibles pour un rollback manuel et sont ignorés par le runtime. `down` n'effectue aucun rollback automatique.

### 006 — retrait de l'index e-mail global (exécutée en local)

`migrations/006-nova-drop-global-member-email-index.js` supprime uniquement l'index unique `email_1` de `membres`, qui interdisait à un même compte d'appartenir à plusieurs workspaces (E11000 lors du `afterCreate` de `/workspaces`). Elle ignore les bases sans collection `membres`, recrée les index composites `{workspaceId, email}`, `{workspaceId, utilisateurId}` et `{workspaceId, role}`, et ne modifie aucun document.

Exécution réelle déjà faite sur la base de développement `NovaDB` (accord explicite) : `email_1` supprimé, index composites confirmés. À prévoir sur chaque environnement ciblé, toujours après validation et autorisation. `down` refuse volontairement de restaurer l'index global.

### Simulation (sans écriture)

```powershell
$env:NOVA_MIGRATION_DRY_RUN='1'
npm run migrate:up
```

Depuis la correction apportée à `scripts/migrations/migrate.js`, un dry-run **n'enregistre aucune migration comme exécutée** et ne change aucun statut, y compris en rollback simulé. Vérifier la sortie avant de retirer la variable.

### Exécution réelle

À ne lancer qu'après autorisation explicite :

```powershell
Remove-Item Env:\NOVA_MIGRATION_DRY_RUN -ErrorAction SilentlyContinue
npm run migrate:up
```

## 3. Comportements à connaître en exploitation

- Les droits sont lus dans les fiches `Membre` du workspace courant. Le créateur d'un workspace en est propriétaire ; un même compte peut posséder plusieurs espaces et n'avoir aucun droit ailleurs. Le rôle global DRY (`admin`/`superadmin`) n'accorde aucun droit NOVA et n'est jamais modifié.
- `User.novaRole`, `User.novaPermissions` et `User.novaEspaceIds` sont dépréciés et ignorés : les laisser en place est sans effet, les supprimer n'accorde rien.
- Le frontend envoie `X-Workspace-Id` à chaque requête NOVA. Sans en-tête et avec plusieurs appartenances, le backend applique le fail-closed (aucun droit). Un en-tête qui ne correspond pas à une appartenance réelle n'élargit pas le périmètre.
- Une page privée n'a aucun `espaceId` et n'est visible que par son créateur, y compris pour un propriétaire/admin du workspace. Une sous-page de page privée reste privée. Le rattachement à un espace d'équipe est une décision explicite qui change la section.
- Le nouveau membre révoqué voit son rôle local passer à `invite` avec lecture seule et aucun espace ; son compte et les autres workspaces ne sont pas touchés.
- Les suppressions sont logiques par défaut (`status: 'deleted'`). Une purge définitive exige `req.allowPermanentDelete === true` et `?includeDeleted=true` via le middleware dédié.
- Seuls deux endpoints restent anonymes : `GET /api/v1/nova/pages/:id/public` et `GET /api/v1/nova/pages/:id/public/blocs`. Ils vérifient publication active, portée web, domaine et niveau d'accès ; les niveaux `edition`/`complet` ne permettent pas d'écriture anonyme.
- Le temps réel vérifie lecture/édition et périmètre d'espace avant d'accepter un `join` ou une diffusion de bloc.
- Le test d'un webhook est réservé aux administrateurs du workspace courant et refuse toute URL non HTTPS ou résolvant vers une adresse privée.
- Ne pas lancer `npm run build` pendant que `npm run dev` tourne dans le même dossier : les deux partagent `.next` et l'un écrase les chunks de l'autre (404 sur `/_next/static/chunks/*`). Arrêter le dev ou configurer un `distDir` distinct pour la vérification de production ; en cas de corruption locale, supprimer `.next` puis relancer le dev (cache régénérable, aucune donnée applicative).

## 4. Procédure de déploiement recommandée

1. Sauvegarde de la base (non effectuée ici).
2. Configuration de `NOVA_CONNECTION_ENCRYPTION_KEY` et de `NOVA_WEBHOOK_HOSTS` dans l'environnement cible.
3. Simulation des migrations 004 et 005 avec `NOVA_MIGRATION_DRY_RUN=1`, puis relecture de la sortie. La 006 est déjà appliquée en développement ; la simuler également sur la cible si elle ne l'est pas.
4. Exécution réelle des migrations 004 et 005 après autorisation, et de la 006 sur tout environnement qui en a besoin.
5. Redémarrage du serveur pour charger la clé et les hooks de schéma.
6. Vérification manuelle :
   - un compte sans appartenance ne peut rien faire, même s'il est `admin` global ;
   - un propriétaire dans A n'a aucun droit dans B ;
   - une page privée d'un autre compte est inaccessible, y compris pour un admin ;
   - une sous-page privée n'a pas d'`espaceId` ;
   - l'invitation et la révocation d'un membre ne modifient que le workspace courant.
7. Exécution des suites d'intégration/E2E automatisées dans un environnement dédié. Les parcours ont été vérifiés manuellement avec chrome-devtools en développement : 22 routes sans « Accès refusé » ni erreur API, création et bascule de workspace, cloisonnement des pages, page privée en 200 pour son créateur et 403 pour un autre workspace.

## 5. Déploiement frontend sur Cloudflare (effectué le 2026-11-21)

Le frontend a été publié **du dépôt de travail local** via Wrangler (pas de commit ni de push Git) :

- Worker : `nova-workspace`
- URL publique : `https://nova-workspace.mayalachristgottlieb-cc9.workers.dev`
- Version ID : `f8e5b34f-d1f9-46db-b34e-122fc6c463c2`
- Adaptateur : `@opennextjs/cloudflare@1.15.1` (compatible Next 14.2.35), Wrangler `4.166.0`
- Fichiers ajoutés : `open-next.config.ts` (cache dummy, aucun R2), `wrangler.jsonc`, `public/_headers` ; scripts `deploy:cloudflare`, `preview:cloudflare`, `upload:cloudflare`, `cf-typegen`.

Commandes utilisées (build puis déploiement, avec le serveur de dev arrêté pour libérer `.next`) :

```powershell
$env:DRY_API_URL = 'https://dryapi.onrender.com'
$env:NEXT_PUBLIC_SOCKET_URL = 'https://dryapi.onrender.com'
$env:NEXT_PUBLIC_DRY_API_URL = 'https://dryapi.onrender.com'
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy -- --keep-vars
```

Points importants :

- `DRY_API_URL` est lu par `next.config.mjs` **au build** pour les rewrites `/api`, `/v1` et `/socket.io` : le définir seulement dans le dashboard Cloudflare ne suffit pas. Les variables `NEXT_PUBLIC_*` sont également inlinées au build. Il faut donc fournir les mêmes valeurs au build (local ou Workers Builds → « Build variables and secrets »).
- `--keep-vars` préserve les variables définies dans le dashboard Cloudflare lors des prochains déploiements.
- Le backend Render doit autoriser l'origine `https://nova-workspace.mayalachristgottlieb-cc9.workers.dev` dans `CORS_ORIGINS` / `ALLOWED_ORIGINS` : le client appelle directement `https://dryapi.onrender.com` pour Socket.IO et pour l'assistant IA (`NEXT_PUBLIC_*`), en dehors des rewrites same-origin.
- OpenNext avertit que le support Windows n'est pas optimal (conseil WSL) ; le build et le déploiement ont néanmoins réussi ici.

Vérifications après publication : `GET /`, `/connexion`, `/recherche`, `/parametres/membres`, `/sw.js`, `/manifest.webmanifest` → **200** ; la page hydrate dans Chrome et redirige vers `/connexion` sans session ; `GET /api/v1/nova/workspaces` → **401** depuis le backend Render, ce qui confirme que le rewrite fonctionne. Le serveur de développement local a été relancé après le build.

## 6. Opérations interdites sans accord

- Migration réelle 004, 005 ou 006 hors du périmètre de développement déjà autorisé (et toute réactivation de la migration 003 obsolète).
- Fourniture, rotation ou suppression de `NOVA_CONNECTION_ENCRYPTION_KEY`.
- Purge définitive de données.
- Achat/configuration d'un fournisseur LLM payant.
- Commit ou push Git. L'installation des dépendances Cloudflare et le relancement des serveurs locaux ont été autorisés et effectués dans cette session ; toute nouvelle installation reste soumise à accord.

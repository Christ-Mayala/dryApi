# NOVA — suivi d'exécution

Dernière mise à jour : 2026-11-22.

- Backend : `D:\Alvine\dryApi` (CommonJS, Express 5, Mongoose 9, Jest 30).
- Frontend : `D:\Alvine\notion` (`nova-workspace`, Next.js 14.2.35, TypeScript).
- Backend : commité et poussé sur `origin/main` (commit `96f5105`, puis mise à jour de `render.yaml` avec les origines autorisées). Frontend : modifications **non commitées**, publiées directement sur Cloudflare depuis l'état de travail local.
- `@opennextjs/cloudflare@1.15.1`, `wrangler@4.166.0`, `@cloudflare/next-on-pages@1.13.15` et `vercel@46.1.1` ont été installés côté frontend avec accord. Aucune donnée de production modifiée. Les serveurs locaux ont été arrêtés pour les builds puis doivent être relancés.
- Frontend actif : **Cloudflare Pages `novaworkspace` → `https://novaworkspace.pages.dev`** (23 routes Edge). Ancien déploiement Worker `nova-workspace` → `https://nova-workspace.mayalachristgottlieb-cc9.workers.dev` (version `f8e5b34f-d1f9-46db-b34e-122fc6c463c2`) conservé pour retour arrière. Le backend reste sur Render.
- Une seule migration réelle a été exécutée, sur la base de développement `NovaDB` uniquement et avec accord explicite : la migration 006 (retrait de l'ancien index global `email_1`). Aucun document modifié. Les migrations 004 et 005 restent non exécutées.

## Modèle de droits retenu (refonte workspace-scoped)

Chaque utilisateur est un compte ordinaire. **Créer un espace de travail le rend propriétaire de cet espace** ; il peut y administrer les membres et inviter. Un même compte peut posséder plusieurs espaces distincts et n'avoir aucun droit dans un espace créé par un autre. Les droits et invitations sont stockés dans une fiche `Membre` par `{workspaceId, utilisateurId|email}` : il n'existe plus de rôle NOVA global.

## Avancement par phase

| Phase | Contenu | État |
| --- | --- | --- |
| P0.1 | Rôles NOVA explicites, fin de l'inférence depuis l'absence de permissions ou le rôle global DRY | TERMINÉ (historique) |
| P0.2 | IDOR : filtres par espace/page/base/propriétaire et contrôle ressource par id sur toutes les familles de routes | TERMINÉ |
| P0.3 | Permissions fines lecture / édition / commentaire / partage / administration appliquées côté serveur | TERMINÉ |
| P0.4 | Secrets de connexion chiffrés AES-256-GCM + garde-fou SSRF des webhooks | TERMINÉ |
| P0.5 | Soft-delete par défaut, purge conditionnée, restauration de versions avec sauvegarde préalable | TERMINÉ |
| P0.6 | Effets asynchrones attendus, journalisation structurée, `afterDelete` pour la révocation | TERMINÉ |
| P0.7 | Tests de sécurité ACL/IDOR/requête/chiffrement/SSRF/migration | TERMINÉ |
| P1.1 | `queryBuilder` : `search` sans `fields`, `$and` ACL conservé, erreurs propagées, pagination plafonnée | TERMINÉ |
| P1.2 | Recherche globale frontend sans nouveau endpoint : `pages.lister({search})`, `blocs.lister({search, fields})`, `elements.lister({search})` | TERMINÉ |
| P1.3 | Alignement IA, notifications, médias et publications sur l'ACL centrale | TERMINÉ |
| P2 | Frontend : lecture publique réellement anonyme et sans appel authentifié, éditeur verrouillé en lecture seule | TERMINÉ (voir limite ESLint ci-dessous) |
| P3 | IA / automatismes : contrôles d'accès appliqués ; configuration d'un fournisseur payant non traitée | EN ATTENTE D'EXPLOITATION |
| P4 | Durcissement opérationnel : clé de chiffrement et migrations à exécuter par un responsable | EN ATTENTE D'AUTORISATION |
| P5 | Tests : suite unitaire complète verte ; intégration/E2E non exécutés dans cette session | PARTIEL |
| P6 | Documentation de livraison : 4 documents NOVA à jour | TERMINÉ |
| W1 | Refonte des droits par espace de travail (propriété locale, invitations locales, ACL workspace-scoped) | TERMINÉ |
| W2 | Confidentialité des pages privées et sous-pages privées (aucun `espaceId`, cascade confinée) | TERMINÉ |
| W3 | Frontend workspace-scoped : `X-Workspace-Id`, droits dérivés de l'appartenance active, UI par espace | TERMINÉ |
| W4 | Correctif 403 sur page privée dont `createdBy` est populé (objet User) | TERMINÉ et vérifié en navigateur réel |
| W5 | Création de workspace fiable : `afterCreate` critique, archivage en cas d'échec, migration 006 locale de l'index `email_1` | TERMINÉ et vérifié en navigateur réel |
| W6 | Tour complet des fonctionnalités avec chrome-devtools (DOM, console, réseau) | TERMINÉ |
| W7 | Déploiement frontend Cloudflare via Wrangler (sans commit/push) | TERMINÉ |
| W8 | Migration vers Cloudflare Pages et URL `novaworkspace.pages.dev` (sans nom de compte) | TERMINÉ |

## Décisions techniques retenues

- Source de vérité : fiches `Membre` portant `workspaceId`. Rôles locaux : `proprietaire`, `admin`, `membre`, `invite`.
- Le rôle `proprietaire` est créé automatiquement pour le créateur d'un workspace (CRUD `workspaces` et espace par défaut). Aucun rôle global n'est écrit sur `User`.
- `User.novaRole`, `User.novaPermissions` et `User.novaEspaceIds` sont **dépréciés et ignorés au runtime**. Ils ne subsistent que pour le diagnostic et un éventuel rollback manuel ; le rôle DRY `role: admin|superadmin` reste intact et sans effet NOVA.
- Fail-closed strict : sans adhésion valide dans le workspace courant, tous les droits sont faux (`SANS_ACCES`). Un en-tête `X-Workspace-Id` ne peut pas élargir le périmètre : il doit correspondre à une appartenance réelle.
- Contexte ACL résolu depuis `X-Workspace-Id`, `?workspaceId`, `req.params.workspaceId`, `req.body.workspaceId`, `req.novaWorkspaceId`, ou l'unique adhésion si le compte n'en a qu'une.
- `section: 'prive'` reste réservée à son créateur, **y compris pour un propriétaire ou un admin du workspace**. `workspaceId` est le périmètre d'appartenance ; `espaceId` doit être `null` pour toute page privée. Le rattachement à un espace d'équipe est toujours une décision explicite.
- Une sous-page hérite du workspace, de l'espace et de la section de son parent. Une sous-page de page privée reste privée et sans espace ; une sous-page de page d'équipe ne peut pas être privée.
- Les cascades de suppression/restauration sont confinées au même workspace et au même espace (ou, pour le privé, au même créateur sans espace).
- `queryBuilder` conserve toujours le `$and` ACL. Recherche, JSON invalide ou erreur ne contournent jamais les filtres et ne masquent jamais la panne.
- Lectures historiquement publiques : authentifiées et filtrées, sauf publication web explicitement active. Seuls deux endpoints restent anonymes : `GET /pages/:id/public` et `GET /pages/:id/public/blocs`.
- Secrets Connexion chiffrés AES-256-GCM via `NOVA_CONNECTION_ENCRYPTION_KEY` : sans clé valide, écriture **et** lecture d'un secret chiffré échouent explicitement, jamais de repli en clair.
- Suppression logique par défaut. Purge définitive uniquement avec `req.allowPermanentDelete === true` et un middleware dédié.
- La révocation (`revoquerAccesUtilisateur`) ne modifie que la fiche `Membre` du workspace concerné (rôle `invite`, permissions de lecture seule, `espaceIds: []`) ; elle ne touche ni au compte ni aux autres workspaces.
- Réparation auto au premier `GET /workspaces` : un compte historique dont le workspace existe mais qui n'a aucune fiche `Membre` reçoit automatiquement son appartenance `proprietaire`. Seule la fiche réellement persistée est ajoutée au contexte : jamais de droits synthétiques qui disparaîtraient à la requête suivante.
- Les plugins DRY peuvent peupler `createdBy` (objet User) même sur une requête `.lean()`. Toute comparaison d'auteur passe par un extracteur d'identifiant (`idDe` / `memeUtilisateur`) : `String({ _id })` produisait `[object Object]` et refusait à tort le créateur d'une page privée (403 sur `GET`/`PUT`).
- L'appartenance propriétaire créée après `POST /workspaces` est un **effet critique** : l'option `effetsCritiques: ['afterCreate']` du `crudFactory` propage l'erreur au lieu d'un simple journal, et le workspace tout juste créé est archivé (`status: 'deleted'`) pour ne pas laisser un espace invisible.
- L'ancien index unique global `email_1` de `NovaDB.membres` empêchait la deuxième appartenance d'un même compte (E11000). La migration 006 le retire et garantit les index composites `{workspaceId, email}` / `{workspaceId, utilisateurId}` / `{workspaceId, role}` ; aucun document n'est modifié.

## Preuves de test (commandes et résultats réels)

Backend, depuis `D:\Alvine\dryApi` :

| Commande | Résultat |
| --- | --- |
| `node --check` sur les fichiers JS modifiés/nouveaux | OK |
| `npx eslint <fichiers modifiés et nouveaux>` | Exit 0 |
| `npx prettier --check` sur les fichiers NOVA modifiés | OK après formatage |
| `npx jest tests/unit/nova --runInBand --silent` | 8 suites / 51 tests réussis |
| `npm run test:unit` | 28 suites / 224 tests réussis |

Avertissements Jest observés, non bloquants : option de configuration inconnue `setupFilesAfterFramework`, arrêt forcé d'un worker et journaux de tests existants (`TrividaReferral`). Aucun test NOVA en échec.

Frontend, depuis `D:\Alvine\notion` :

| Commande | Résultat |
| --- | --- |
| `npm run typecheck` | OK |
| `npm run build` | OK — 22 pages générées, compilation et vérification des types réussies |
| `npm run lint` | Non vérifiable en non-interactif : `next lint` demande de configurer ESLint et sort avec le code 1. La phase « Linting and checking validity of types » du build passe. |

Aucun test frontend n'est déclaré dans `package.json`.

Scénarios couverts par les tests NOVA : propriétaire dans A sans droit dans B, admin global sans adhésion sans droit, matrice propriétaire/admin/membre/invité/lecture seule/sans accès, permissions fines, filtres inter-workspaces, page privée creator-only, `section:'prive'` sans `espaceId`, cohérence parent/enfant, cascade confinée, invitation/révocation workspace-scoped et création de l'appartenance propriétaire. Les nouveaux tests verrouillent aussi le `createdBy` populé (créateur autorisé, autre compte refusé), l'échec de création d'appartenance (workspace archivé), l'effet `afterCreate` critique et la migration 006 (base sans collection ignorée, simulation sans écriture).

## Vérification en navigateur réel (chrome-devtools)

Parcours effectué sur `http://localhost:3000` avec la session restaurée, en inspectant DOM, console et réseau :

- 22 routes visitées (accueil, recherche, inbox, messagerie, réunions, tâches, IA, modèles, corbeille, paramètres et sous-pages, pages privée/équipe, espace d'équipe) : aucune bannière « Accès refusé », aucune erreur visible, aucune requête API en 4xx/5xx.
- Seule erreur console : `404` sur l'avatar externe `res.cloudinary.com/.../avatar-1794203270806.jpg` (ressource externe non bloquante).
- Page privée `6b01dd38193f2f62080f936d` : `GET` et `PUT` en **200** avec le bon en-tête `X-Workspace-Id` (avant correctif : 403).
- Création d'un workspace via l'API : **200**, workspace visible dans la liste, fiche `Membre` `proprietaire` persistée. Avant migration 006 : 409 explicite et workspace archivé, au lieu d'un espace invisible.
- Bascule de workspace dans la barre latérale : l'en-tête change, la liste de pages du workspace précédent disparaît (30 pages dans A, 0 dans B), et la page privée de A renvoie bien **403** sous l'en-tête de B. C'est le cloisonnement attendu, distinct du défaut d'accueil corrigé.
- Écran « Membres » du nouveau workspace : 1 membre propriétaire et bouton « Inviter » actif. Aucune invitation réelle n'a été envoyée (envoi d'e-mail externe non autorisé).

Artefacts locaux laissés en place (aucune purge sans accord) : `Workspace validation 006` (actif, `6b01e662194b6eacfc61ee52`), `Workspace test correction 21-11` et `Workspace validation migration 006` (archivés, `status: 'deleted'`).

## Opérations nécessitant une autorisation explicite

- Exécuter `migrations/004-nova-encrypt-connection-secrets.js` et `migrations/005-nova-workspace-memberships.js` sur une base réelle. La migration `003-nova-explicit-roles.js` est obsolète (modèle global supprimé) et ne fait plus rien.
- La migration 006 a été exécutée uniquement sur la base de développement `NovaDB` avec accord ; son exécution sur tout autre environnement reste soumise à autorisation explicite.
- Fournir et rotationner `NOVA_CONNECTION_ENCRYPTION_KEY` en production.
- Toute purge définitive de données.
- Configuration ou achat d'un fournisseur LLM payant.

## Reste à faire avant mise en production

1. Relire puis simuler les migrations 004 et 005 (`NOVA_MIGRATION_DRY_RUN=1`) sur un environnement non productiel, puis exécuter avec accord. La 006 est déjà appliquée en local.
2. Définir `NOVA_CONNECTION_ENCRYPTION_KEY` et `NOVA_WEBHOOK_HOSTS` dans l'environnement serveur avant la première écriture de secret ; prévoir un plan de réchiffrement si la clé change.
3. Vérifier manuellement après déploiement : un compte sans adhésion ne peut rien faire ; un propriétaire dans A n'a aucun droit dans B ; une page privée d'un autre compte est inaccessible ; une sous-page privée n'a pas d'`espaceId`. Ces points ont été vérifiés en local avec chrome-devtools, pas encore en environnement déployé.
4. Décider du sort de `npm run lint` côté frontend (ajout d'une configuration ESLint) si un lint autonome est exigé en CI.
5. Exécuter les suites d'intégration/E2E automatisées dans un environnement de test dédié (non faites ici : les parcours ont été vérifiés manuellement dans le navigateur, sans suite E2E scriptée).
6. Éviter de lancer `npm run build` pendant que `npm run dev` tourne sur le même dossier : les deux partagent `.next` et se écrasent mutuellement (chunks 404). Utiliser un `distDir` distinct ou arrêter le dev avant le build.

## Audit Notion Desktop (distinct, non bloquant)

Aucune preuve d'exécution de Notion Desktop n'a été observée dans cette session. L'analyse REA conservée porte uniquement sur des artefacts réellement vus (`app.asar`, SHA-256 `25387b740ed24c1388451d3c0bf347fb735307b4032aba40f62a8f9ea18413ef`) et ne doit pas être confondue avec `D:\Alvine\notion`, qui est le frontend NOVA. Aucun profil privé n'a été lu.

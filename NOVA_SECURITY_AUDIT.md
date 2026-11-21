# NOVA — audit de sécurité et état des contrôles

Date : 2026-11-21. Périmètre : backend `D:\Alvine\dryApi\dryApp\Nova`, noyau DRY utilisé par NOVA, et points d'accès frontend concernés dans `D:\Alvine\notion`.

## 1. Périmètre initial et constats

La cartographie initiale a recensé **92 routes NOVA** et **18 endpoints sans protection apparente**. Les failles prioritaires identifiées étaient :

- élévation implicite depuis l'absence de `novaPermissions` ou depuis `role: admin|superadmin` ;
- IDOR par `req.params.id` sur blocs, éléments, commentaires, notifications, favoris, versions, médias, connexions, etc. ;
- contournement des filtres ACL via `?search=` (`queryBuilder` supprimait le `$and` avant d'ajouter le `$or`) ;
- silences dangereux : JSON invalide ignoré, erreurs de requête transformées en liste vide, erreurs d'effets asynchrones non journalisées ;
- secrets de connexion potentiellement stockés en clair et webhooks arbitraires (SSRF) ;
- publication web servie sans vérification réelle de `acces`/`domaine`, avec renvoi d'informations internes ;
- restauration de version écrasante et suppressions définitives trop faciles à déclencher.

Une seconde passe a supprimé le rôle NOVA global au profit d'une **appartenance par espace de travail** : c'est le changement de modèle décrit ci-dessous.

## 2. Modèle d'autorisation retenu

Les droits sont portés par une fiche `Membre` par `{workspaceId, utilisateurId/email}`. Le créateur d'un workspace en devient automatiquement propriétaire. Rôles locaux : `proprietaire`, `admin`, `membre`, `invite`.

| Profil (dans le workspace courant) | Lecture | Édition | Commentaire | Partage | Administration | Espaces d'équipe |
| --- | --- | --- | --- | --- | --- | --- |
| `proprietaire` | oui | oui | oui | oui | oui | tous ceux du workspace |
| `admin` | oui | oui | oui | oui | oui | tous ceux du workspace |
| `membre` | oui | oui | oui | non | non | `espaceIds` de sa fiche |
| `invite` | oui | non | non | non | non | `espaceIds` de sa fiche |
| Sans appartenance au workspace courant (y compris `role: admin|superadmin`) | non | non | non | non | non | aucun |
| Membre révoqué (`lecture: false`) | non | non | non | non | non | aucun |

Précisions :

- `contexteDe(req)` résout le workspace depuis `X-Workspace-Id`, la query, les paramètres, le corps ou l'unique adhésion. Sans fiche correspondante → `SANS_ACCES`, toutes permissions fausses.
- Un en-tête `X-Workspace-Id` ne peut **jamais** élargir le périmètre : il doit correspondre à une appartenance réelle du compte. Un propriétaire dans A n'a aucun droit dans B.
- `User.novaRole`, `User.novaPermissions` et `User.novaEspaceIds` sont dépréciés et ignorés ; le rôle global DRY n'accorde aucun droit NOVA et n'est jamais modifié par NOVA (vérifié par test).
- Les `permissions` explicites d'une fiche `Membre` affinent son rôle local ; `admin: true` implique tous les droits, `lecture: false` implique l'absence de droits.
- `idsEspacesAutorises()` renvoie `null` pour un propriétaire/admin du workspace courant et `[]` pour toute fiche sans espace attribué.

## 3. Contrôles mis en place

### 3.1 ACL centrale, workspace et filtres

`dryApp/Nova/services/acl.service.js` expose les middleware et helpers utilisés par toutes les familles de routes :

- `exigerLectureNova`, `exigerEditionNova`, `exigerCommentaireNova`, `exigerPartageNova`, `exigerAdministrationNova` — tous workspace-scoped ;
- `filtrerWorkspace` / `filtrerWorkspaceMiddleware` : imposent `workspaceId = contexte.workspaceId`, ou un filtre impossible sans contexte (fail-closed) ;
- `filtrerEspaces`, `filtrerParPages`, `filtrerParBases`, `filtrerParProprietaire` : contraignent les listes avant `queryBuilder` ;
- `exigerAccesRessource({ modelName, droit, resoudreEspaceId, proprieteProprietaire, ... })` : charge la ressource par id, vérifie le propriétaire, la section privée, l'espace remonté depuis `espaceId`, `pageId`, `blocId` ou `baseId`, **et le `workspaceId` du document** ;
- `verifierPayloadAcces` : refuse une référence de page/bloc/base inconnue ou hors périmètre à la création/mise à jour ; valide `parentId` avec le bon modèle et peut exiger une référence explicite ;
- `forcerProprietaire` : empêche l'usurpation de `createdBy` ;
- `peutAccederEspace` est asynchrone : un espace d'un autre workspace est refusé même à un admin.

Les filtres sont fusionnés sous `$and` avec les filtres existants sans écraser `page`, `limit`, `sort`, `select` ou un `$or` client. `protect` charge `req.novaMembres` (toutes les fiches actives du compte) pour chaque requête NOVA, en fail-closed si la lecture échoue.

### 3.2 Appartenances, invitations et workspaces

- `membres.schema.js` : `workspaceId`, rôle `proprietaire`, index uniques composites `{workspaceId, email}` et `{workspaceId, utilisateurId}`. L'ancien index unique global `email_1` est incompatible avec plusieurs appartenances : la migration 006 le retire (exécutée localement sur `NovaDB`) tout en conservant les index composites.
- `workspaces.routes.js` : création ouverte à tout compte connecté (5 maximum) ; `afterCreate` crée la fiche propriétaire **et est déclaré effet critique** : sans fiche persistée, l'erreur est propagée et le workspace archivé, au lieu de répondre succès pour un espace invisible. La liste est filtrée sur les appartenances ; update/delete exigent le rôle propriétaire/admin **du workspace visé** ; un espace par défaut est créé pour les comptes historiques sans workspace, et l'appartenance propriétaire est réparée si le workspace historique existe déjà sans fiche `Membre` (aucun droit synthétique n'est accordé).
- `invitation.service.js` : n'écrit plus aucune donnée sur `User` ; `synchroniserAccesUtilisateur` ne lie que `utilisateurId`, `revoquerAccesUtilisateur` ne modifie que la fiche du workspace concerné, `creerAppartenanceProprietaire` est idempotente.
- `Nova/index.js` ne synchronise plus les membres vers le compte global.
- `tempsReel.service.js` : rooms et présence dérivées des appartenances `Membre` et d'un contexte ACL synthétique, jamais des anciens champs `nova*`.

### 3.3 Requêtes et recherche

`dry/middlewares/query/queryBuilder.js` :

- conserve le `$and` ACL lors de l'ajout d'une recherche, y compris sans `fields` ;
- échappe les métacaractères regex, limite le terme à 200 caractères et la page à 100 éléments ;
- refuse un `?json=` invalide ou contenant `$where`, `$expr`, `$function`, `$accumulator`, `$jsonSchema` ;
- propage les erreurs à `next(err)` au lieu de renvoyer une liste vide « réussie ».

La recherche globale frontend utilise les endpoints de liste existants (`pages`, `blocs`, `elements`), désormais ACL-sûrs. Aucun endpoint `/recherche` contournable n'a été ajouté.

### 3.4 Confidentialité des pages privées

- `normaliserPayloadPrive` impose `workspaceId = contexte.workspaceId` et, si `section === 'prive'`, `espaceId = null` : une page privée n'est jamais rattachée à un espace d'équipe.
- La liste des pages exclut toute page privée dont le créateur n'est pas l'utilisateur courant, y compris dans la corbeille ; un propriétaire/admin ne voit pas les pages privées des autres.
- `cohererPageParent` : une sous-page hérite du workspace/de l'espace/de la section de son parent ; une sous-page de page privée reste privée et sans espace (contrôle du créateur), une sous-page de page d'équipe ne peut pas être privée.
- `collecterIds` confine les cascades de suppression/restauration au même workspace et au même espace, ou pour le privé au même créateur sans espace. Aucun descendant rattaché ailleurs n'est entraîné.
- `idDe` / `memeUtilisateur` normalisent un `createdBy` populé par les plugins DRY : sans cela, `String({ _id })` donnait `[object Object]` et le créateur était refusé sur sa propre page privée (403). Le contrôle reste strict pour tout autre compte.
- Frontend : `navigation.ts` force un lien `/page/:id` pour le contenu privé ; `DonneesContext` ignore `espaceId` pour le regroupement privé et n'affiche les pages privées qu'à leur créateur.

### 3.5 Publication web

Deux endpoints restent volontairement anonymes :

- `GET /pages/:id/public` ;
- `GET /pages/:id/public/blocs`.

Ils partagent la même vérification : page existante, publication `actif: true` et `portee: 'web'`, domaine hôte exact si `domaine` est défini, niveau `acces` reconnu. La réponse est réduite aux champs d'affichage et aux blocs ; elle n'inclut ni `invites`, ni `domaine`, ni identifiant interne de publication. Les niveaux `edition`/`complet` ne permettent pas d'écriture anonyme. Toutes les autres routes NOVA sont authentifiées et ACL-sûres.

### 3.6 Secrets et SSRF

- `crypto.service.js` : AES-256-GCM, AAD versionné, IV aléatoire, tag d'authentification, chiffrement/déchiffrement récursif des clés sensibles (`token`, `webhook`, `apiKey`, `secret`, etc.), masquage systématique dans `toJSON`.
- Absence ou longueur invalide de `NOVA_CONNECTION_ENCRYPTION_KEY` : exception explicite à l'écriture **et** à la lecture, sans repli en clair.
- `connexions.schema.js` : hooks `save`, `findOneAndUpdate` et `post('init')`, plus `toJSON` masqué.
- `migrations/004-nova-encrypt-connection-secrets.js` : chiffre les configurations historiques en clair, non destructive, non exécutée ; `down` déchiffre les valeurs concernées.
- `connexions.service.js` : HTTPS obligatoire, allowlist `NOVA_WEBHOOK_HOSTS` (par défaut `hooks.slack.com`), refus des credentials dans l'URL, refus des IP privées/loopback/link-local/multicast et de tout DNS résolvant vers une adresse interdite. Le test est réservé aux administrateurs du workspace et porte sur une connexion existante vérifiée par ACL.

### 3.7 Suppression, versions, effets et temps réel

- `crudFactory.deleteOne` : `status: 'deleted'` + `deletedAt` par défaut ; purge réelle uniquement si `req.allowPermanentDelete === true` **et** `?includeDeleted=true`.
- `afterCreate`, `afterUpdate`, `afterDelete` sont attendus, journalisés en JSON avec modèle/action/id/tentative, et retentés une fois en cas d'échec. L'option `effetsCritiques` permet de propager un effet après échec des deux tentatives : c'est le cas de l'appartenance propriétaire d'un workspace, pour ne jamais valider une ressource inutilisable.
- La suppression d'un membre appelle `revoquerAccesUtilisateur()` sur sa fiche : rôle `invite`, permissions de lecture seule, `espaceIds: []`, sans toucher au compte ni aux autres workspaces.
- La restauration d'une version exige édition + accès à l'espace de la page, crée une sauvegarde de l'état courant, archive les blocs au lieu de les supprimer et journalise l'opération.
- Les rooms d'espace ne sont rejointes que si l'utilisateur a le droit de lecture dans le workspace courant et un périmètre compatible ; `page:rejoindre` vérifie le caractère privé de la page ; les diffs de blocs exigent une page rejointe et le droit d'édition.

### 3.8 Frontend workspace-scoped

- `api.ts` : toutes les requêtes NOVA (y compris l'assistant IA) envoient `X-Workspace-Id` ; `definirWorkspaceActif()` / `lireWorkspaceActif()` gèrent la sélection ; un `changerWorkspace` recharge le contenu avec le nouvel en-tête.
- `AuthContext` : `estAdmin`, `permissions`, `peutEditer`, `peutCommenter`, `peutPartager` et `roleWorkspace` sont dérivés de la fiche `Membre` du workspace courant, jamais du compte global.
- `DonneesContext` : charge d'abord workspaces + appartenances, applique l'en-tête, puis charge le contenu ; `membreActif` est la source des droits, `appartientWorkspaceActif` empêche toute fuite inter-workspaces ; la création d'un workspace est ouverte à tous, sa gestion reste conditionnée aux droits locaux.
- Les pages de paramètres (membres, espaces, espaces de travail, connexions, publications…) utilisent ces droits locaux ; la fiche « propriétaire » affichée vient de l'API et non plus des champs `nova*` du compte.

## 4. Vérifications effectuées

| Contrôle | Commande / preuve | Résultat |
| --- | --- | --- |
| Matrice des rôles par workspace, IDOR inter-workspace, rôle global ignoré, fusion de filtres | `tests/unit/nova/acl.service.test.js` | OK |
| Appartenances workspace-scoped, aucune écriture globale, création propriétaire, révocation locale | `tests/unit/nova/invitation.service.test.js` | OK |
| Page privée sans espace, sous-page privée, cohérence parent/enfant, cascade confinée | `tests/unit/nova/pages.privacy.test.js` | OK |
| Chiffrement récursif, masquage, absence de clé | `tests/unit/nova/crypto.service.test.js` | OK |
| Allowlist SSRF et adresses privées | `tests/unit/nova/connexions.ssrf.test.js` | OK |
| Migration 004 avec faux client MongoDB | `tests/unit/nova/migration.chiffrement.test.js` | OK |
| Non-contournement ACL par `search`/`$and`/JSON | `tests/unit/middlewares/queryBuilder.test.js` | OK |
| Soft-delete, purge conditionnée, effets et `afterDelete` | `tests/unit/factories/crudFactory.softDelete.test.js` | OK |
| Suite NOVA ciblée | `npx jest tests/unit/nova --runInBand --silent` | 8 suites / 51 tests réussis |
| Suite unitaire complète | `npm run test:unit` | 28 suites / 224 tests réussis |
| Migration 006 (base sans collection, retrait ciblé, dry-run) | `tests/unit/nova/migration.membres.index.test.js` | OK |
| Effet `afterCreate` critique propagé | `tests/unit/factories/crudFactory.softDelete.test.js` | OK |
| Parcours navigateur réels (DOM/console/réseau) | chrome-devtools sur `localhost:3000` | 22 routes sans « Accès refusé » ni erreur API ; seule la 404 externe de l'avatar Cloudinary |

`node --check`, ESLint et Prettier sur les fichiers modifiés sont également passés. `npm run typecheck` et `npm run build` (22 pages) passent côté frontend. Voir `NOVA_PROJECT_STATUS.md` pour les commandes exactes.

## 5. Risques résiduels et limites de l'audit

- Aucune suite d'intégration/E2E **automatisée** n'a été exécutée : les parcours ont été vérifiés manuellement dans un navigateur réel avec chrome-devtools, sur la base de développement locale. Les garanties automatisées reposent donc sur des tests unitaires avec mocks.
- La migration 005 de backfill workspace-scoped n'a pas été exécutée. Tant qu'elle ne l'est pas, les données historiques peuvent manquer de `workspaceId` ou porter un `espaceId` sur une page privée ; le runtime applique les invariants aux nouvelles écritures, mais l'ancien contenu doit être migré après validation.
- La migration 006 a été exécutée uniquement sur `NovaDB` (développement, avec accord) : l'index `email_1` y a été supprimé sans modification de documents. Les autres environnements restent à traiter sous réserve d'autorisation.
- L'envoi d'e-mail d'invitation n'a pas été déclenché pendant le parcours navigateur (action externe non autorisée) : seule l'affichage de la liste des membres et du bouton « Inviter » a été vérifié.
- La migration 003 (rôles globaux) est devenue un no-op ; elle est conservée uniquement pour l'historique/rollback et ne doit pas être présentée comme une migration de backfill.
- `npm run lint` frontend reste non vérifiable en non-interactif (`next lint` demande une configuration ESLint) ; la phase lint/type du build passe.
- Le fournisseur LLM, la clé de chiffrement et la liste `NOVA_WEBHOOK_HOSTS` restent à configurer par un responsable ; aucun secret ni configuration sensible n'a été écrit.
- L'audit REA de Notion Desktop est distinct et non bloquant : aucun lancement, aucune lecture de profil privé, aucune inférence à partir d'artefacts non observés.

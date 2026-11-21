# NOVA — journal des modifications

Toutes les entrées ci-dessous sont datées du 2026-11-21 et concernent des modifications **locales, non commitées**, dans `D:\Alvine\dryApi` et `D:\Alvine\notion`. Le frontend a en revanche été **déployé sur Cloudflare** depuis cet état de travail local (sans commit ni push).

## 2026-11-21 — Déploiement frontend Cloudflare (frontend uniquement)

- Ajout de la configuration OpenNext/Cloudflare : `open-next.config.ts`, `wrangler.jsonc` (Worker `nova-workspace`), `public/_headers`, scripts npm `deploy:cloudflare`, `preview:cloudflare`, `upload:cloudflare`, `cf-typegen`, et entrées `.gitignore`.
- Dépendances installées avec accord : `@opennextjs/cloudflare@1.15.1` (dernière version compatible Next 14.2.35) et `wrangler@4.166.0`.
- Build effectué avec les variables Render déjà documentées (`DRY_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_DRY_API_URL` = `https://dryapi.onrender.com`), puis déploiement via `npx opennextjs-cloudflare deploy -- --keep-vars`.
- URL publique : `https://nova-workspace.mayalachristgottlieb-cc9.workers.dev` (version `f8e5b34f-d1f9-46db-b34e-122fc6c463c2`). Vérifications HTTP : 6 routes en 200, hydratation Chrome OK, redirection vers `/connexion` sans session, rewrite `/api` → backend Render (401 attendu sans jeton).
- Le backend reste sur Render ; aucune migration ni secret supplémentaire, aucun commit/push. L'origine Workers doit être ajoutée aux origines autorisées côté Render pour Socket.IO et les appels IA directs.

## 2026-11-21 — Correctifs de validation navigateur (page privée, workspace, index)

Deux défauts observés en navigateur réel ont été corrigés, puis l'ensemble des parcours a été revérifié avec chrome-devtools.

### 1. Page privée : 403 pour son propre créateur

- Cause : les plugins DRY peuplent `createdBy` (objet `User`) même sur une requête `.lean()` ; `String(doc.createdBy)` renvoyait `[object Object]` et `verifierAccesPage` concluait que l'auteur était un autre compte.
- `pages.routes.js` : nouveaux helpers `idDe` / `memeUtilisateur`, utilisés pour le détail de page, la cohérence parent/enfant et la cascade privée. Le journal temporaire `[DEBUG PAGE]` et l'import invalide `purgerContexteNova` ont été retirés.
- Aucun assouplissement de l'invariant privé : un autre compte, même propriétaire/admin du workspace, reste refusé ; `espaceId` reste `null`.
- Preuve réelle : `GET` et `PUT /api/v1/nova/pages/6b01dd38193f2f62080f936d` passent de 403 à **200**.

### 2. Création de workspace : index e-mail global hérité

- Cause : l'ancien index unique `email_1` de `NovaDB.membres` interdisait la deuxième fiche `Membre` du même compte ; le `afterCreate` échouait en E11000 et le workspace restait créé mais invisible (aucun propriétaire).
- `crudFactory.js` : nouvelle option `effetsCritiques` ; un effet critique est retenté puis **propagé** au lieu d'être seulement journalisé (plus de faux succès).
- `workspaces.routes.js` : `creerAppartenanceApresCreation` vérifie la fiche persistée, archive le workspace en cas d'échec puis propage l'erreur. Résultat observé avant migration : 409 explicite et aucun espace orphelin actif.
- `migrations/005-nova-workspace-memberships.js` : correction du nom de collection (`membres`, pas `members`).
- `migrations/006-nova-drop-global-member-email-index.js` (nouvelle) : ignore les bases sans collection `membres` (le premier essai plantait sur `dryapi` en `NamespaceNotFound`), supprime uniquement `email_1`, recrée les index composites. Non destructive, idempotente, avec dry-run.
- **Exécution locale autorisée** sur `NovaDB` (développement uniquement) : `email_1` supprimé, aucun document modifié, index composites confirmés. Après migration, `POST /workspaces` répond **200**, le workspace apparaît dans la liste et sa fiche `proprietaire` est persistée.

### Tests et vérifications

- Nouveaux tests : `tests/unit/nova/pages.privacy.test.js` (createdBy populé, autre compte refusé, autre workspace refusé), `tests/unit/nova/workspaces.repair.test.js` (appartenance à la création, archivage sur échec), `tests/unit/factories/crudFactory.softDelete.test.js` (effet critique propagé), `tests/unit/nova/migration.membres.index.test.js` (base sans collection, suppression ciblée, dry-run).
- Résultats : `npx jest tests/unit/nova --runInBand --silent` **8 suites / 51 tests** ; `npm run test:unit` **28 suites / 224 tests** ; `node --check`, ESLint, Prettier, `npm run typecheck` et `npm run build` (22 pages) OK.
- Tour chrome-devtools : 22 routes sans « Accès refusé » ni erreur API, seule la 404 externe de l'avatar Cloudinary ; bascule de workspace et isolation vérifiées (30 pages dans A, 0 dans B, page privée de A en 403 sous l'en-tête de B).
- Le cache `.next` a été régénéré avec accord après qu'un `npm run build` l'a écrasé sous le serveur de développement ; le serveur local a été relancé. Aucune donnée applicative supprimée.

## 2026-11-21 — Refonte des droits par espace de travail (workspace-scoped)

Décision validée : « un utilisateur simple crée un espace de travail, en devient le propriétaire, administre et invite dans cet espace ; un même compte peut posséder plusieurs espaces ». Les anciens rôles globaux NOVA sont supprimés du modèle actif.

### Backend — modèle et ACL

- `dryApp/Nova/services/acl.service.js`
  - `contexteDe(req)` résout le workspace courant depuis `X-Workspace-Id`, query, params, corps, `req.novaWorkspaceId`, ou l'unique adhésion ; met en cache `req.novaContexte` ;
  - `SANS_ACCES` : permissions toutes fausses lorsque l'appartenance est absente ou invalide ; `estAdminNova` ne s'applique qu'au workspace courant ;
  - `filtrerWorkspace` / `filtrerWorkspaceMiddleware` imposent le périmètre ; `peutAccederEspace` est async et refuse un espace d'un autre workspace, même à un admin ;
  - `exigerAccesRessource` vérifie aussi le `workspaceId` du document chargé ;
  - prévention des croisements workspaces dans `pageIdsAccessibles`, `filtrerParBases` et les listes liées.
- `dry/middlewares/protection/auth.middleware.js` : charge `req.novaMembres` (fiches actives du compte) pour NOVA, en fail-closed.
- `dryApp/Nova/features/membres/model/membres.schema.js` : `workspaceId`, rôle `proprietaire`, index uniques composites `{workspaceId, email}` / `{workspaceId, utilisateurId}`.
- `dryApp/Nova/validation/schemas.js` : accepte `workspaceId` et le rôle `proprietaire`.
- `dryApp/Nova/features/membres/services/invitation.service.js` : plus aucune écriture sur `User` ; `synchroniserAccesUtilisateur` ne lie que `utilisateurId` ; `revoquerAccesUtilisateur` ne modifie que la fiche locale ; nouveau `creerAppartenanceProprietaire` idempotent.
- `dryApp/Nova/features/workspaces/route/workspaces.routes.js` : création ouverte à tout compte (limite 5), création automatique de l'appartenance propriétaire, liste filtrée par appartenance, gestion réservée au propriétaire/admin du workspace visé, espace par défaut pour les comptes historiques, suppression du gate global.
- `dryApp/Nova/features/espaces/route/espaces.routes.js` : espace imposé au workspace courant, filtrage par workspace, `espaceIds` mis à jour sur la fiche membre après création.
- `dryApp/Nova/index.js` : plus de synchronisation des membres vers le compte global.
- `dryApp/Nova/services/tempsReel.service.js` : rooms et présence basées sur les appartenances `Membre` et un contexte ACL synthétique.

### Backend — confidentialité des pages privées

- `dryApp/Nova/features/pages/route/pages.routes.js`
  - `normaliserPayloadPrive` : `section:'prive'` ⇒ `espaceId: null`, `workspaceId` imposé par le contexte ;
  - `cohererPageParent` : une sous-page hérite du workspace/espace/section du parent ; sous-page privée obligatoirement sans espace et creator-only ; sous-page de page d'équipe ne peut pas être privée ;
  - `collecterIds` : cascade confinée au même workspace et au même espace, ou pour le privé au même créateur sans espace ;
  - filtrage workspace du détail et des listes de pages.
- `router.__test` expose ces invariants pour les tests unitaires.

### Réparation des comptes historiques (correctif « Accès refusé » à l'accueil)

- `workspaces.routes.js` : l'auto-réparation ne se limitait pas aux comptes sans workspace. Un compte possédant déjà un workspace créé avant la refonte mais aucune fiche `Membre` restait en `SANS_ACCES` : l'accueil affichait « Accès refusé » (notamment via `GET /favoris`). La liste des workspaces crée désormais l'appartenance `proprietaire` manquante et n'ajoute au contexte que la fiche réellement persistée ; `req.novaContexte` est purgé pour éviter un contexte vide mis en cache.
- `invitation.service.js` : `creerAppartenanceProprietaire` réutilise et promeut une fiche existante trouvée par email (cas d'une invitation historique non liée au compte) au lieu de tenter un insert qui violerait l'index unique.
- `tests/unit/nova/workspaces.repair.test.js` (nouveau) : réparation d'un workspace historique, création du workspace par défaut, compte déjà membre, échec de persistance sans droits synthétiques.

Résultats à ce stade du correctif : suite NOVA **7 suites / 43 tests réussis** ; `npm run test:unit` **27 suites / 215 tests réussis** (voir la première section de ce fichier pour les résultats finaux après les correctifs de validation navigateur).

### Migrations

- `migrations/003-nova-explicit-roles.js` : devenue **obsolète**, no-op explicite (modèle global supprimé), conservée pour l'historique/rollback.
- `migrations/004-nova-encrypt-connection-secrets.js` : inchangée et toujours valide (chiffrement AES-256-GCM des secrets historiques), non exécutée.
- `migrations/005-nova-workspace-memberships.js` (nouvelle, non exécutée) : crée les appartenances propriétaires manquantes, traduit les rôles historiques dans le workspace créé par le compte, renseigne `pages.workspaceId`, retire `espaceId` des pages privées, crée les index composites. Non destructive et idempotente.

### Frontend workspace-scoped

- `notion/src/lib/types.ts` : `RoleMembre` inclut désormais `proprietaire` ; `Membre.workspaceId` ajouté ; champs `nova*` du compte documentés dépréciés.
- `notion/src/lib/api.ts` : `X-Workspace-Id` sur toutes les requêtes (y compris `demanderIA`), `lireWorkspaceActif()` / `definirWorkspaceActif()`, option `workspaceId` par requête.
- `notion/src/context/AuthContext.tsx` : `permissionsEffectivesMembre()`, `roleWorkspace`, droits et `estAdmin` dérivés de l'appartenance active ; plus aucun privilège depuis le rôle global.
- `notion/src/context/DonneesContext.tsx` : charge workspaces + appartenances avant le contenu, expose `membres` / `membreActif`, recharge à la bascule de workspace, filtre strictement par workspace, conservation du privé creator-only.
- `notion/src/lib/navigation.ts` : une page privée garde un lien `/page/:id` même si une donnée historique porte un `espaceId`.
- PagesParamètres : création d'un espace de travail ouverte à tous ; gestion conditionnée aux droits locaux ; liste des membres sans fabrication de ligne depuis les champs `nova*` ; plus de rechargement de profil pour `novaEspaceIds`.
- Correctifs antérieurs conservés sur `modeles/page.tsx`, `ModaleAgentIA.tsx`, `ModaleAppliquerIA.tsx` et `iaAgent.ts`.

### Tests

- `tests/unit/nova/acl.service.test.js` réécrit : propriétaire dans A sans droits dans B, admin global sans adhésion, matrice des rôles, workspace unique, permissions fines, cross-workspace, pages privées.
- `tests/unit/nova/invitation.service.test.js` réécrit : aucune écriture globale, liaison `utilisateurId`, révocation locale, création propriétaire et idempotence.
- `tests/unit/nova/pages.privacy.test.js` (nouveau) : invariant privé, sous-pages, cohérence parent/enfant, cascade confinée.

Résultats : suite NOVA **6 suites / 39 tests réussis** ; `npm run test:unit` **26 suites / 211 tests réussis** ; `npm run typecheck` et `npm run build` (22 pages) OK.

## 2026-11-21 — Sécurisation P0 et finition des parcours d'accès (historique)

### Sécurité / ACL

- `dryApp/Nova/services/acl.service.js` : réécriture autour de `novaRole`, suppression de l'inférence depuis l'absence de permissions ou le rôle global, ajout/généralisation de `exigerAccesRessource`, `verifierPayloadAcces`, `filtrerParPages`, `filtrerParBases`, `filtrerParProprietaire`, `forcerProprietaire` et des helpers temps réel.
- Toutes les familles de routes NOVA (bases, blocs, commentaires, connexions, elements, espaces, favoris, ia, medias, membres, messages, modeles, notifications, pages, parametres, publications, versions, workspaces) ont été câblées sur ces contrôles.

### Requêtes et recherche

- `dry/middlewares/query/queryBuilder.js` : `$and` ACL conservé, `?search=` échappé/borné, `?json=` invalide refusé, erreurs propagées, pagination plafonnée.
- `notion/src/lib/api.ts` : `rechercherGlobalement()` passe par les endpoints de liste ACL-sûrs ; aucun endpoint `/recherche` n'a été créé.

### Secrets, webhooks et migrations

- `dryApp/Nova/services/crypto.service.js` (nouveau) : AES-256-GCM, masquage, erreurs explicites si clé manquante/invalide.
- `connexions.schema.js` et `connexions.service.js` : hooks de chiffrement, HTTPS obligatoire, allowlist SSRF, refus des adresses privées.
- `scripts/migrations/migrate.js` : un dry-run n'enregistre plus de migration comme exécutée.

### Suppression, versions, effets et publication

- `crudFactory.js` : soft-delete par défaut, purge conditionnée, effets attendus/journalisés/retentés.
- `versions.routes.js` : restauration protégée avec sauvegarde et blocs archivés.
- `pages.routes.js` : endpoints anonymes `/public` et `/public/blocs` vérifiant publication active, portée web, domaine et niveau d'accès ; réponse réduite.
- Frontend : page publiée en lecture seule, sans Socket.IO.

## Aucune modification de production

Aucun commit, push, installation de dépendance, suppression définitive ou rotation de clé n'a été effectué. Les serveurs locaux ont été relancés avec accord après réparation du cache de développement. La migration **006** a été exécutée sur la base de développement `NovaDB` avec accord explicite ; les migrations 004 et 005 restent non exécutées et la migration 003 est obsolète.

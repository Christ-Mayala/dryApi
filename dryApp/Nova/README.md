# Nova

Application multi-tenant DRY exposant l'API backend d'un clone de Nova :
un espace de travail tout-en-un qui combine **éditeur de blocs**, **bases de
données**, **wikis** et **documents**, organisés en espaces et pages
hiérarchisées. Montée sur `/api/v1/nova` (base Mongo `NovaDB`) ; tous les
modèles sont enregistrés au démarrage via `index.js` (`bootstrap`).

## Features et routes

| Feature | Modèle | Route de base |
| --- | --- | --- |
| Espaces | `Espace` | `/api/v1/nova/espaces` |
| Pages | `Page` | `/api/v1/nova/pages` |
| Blocs | `Bloc` | `/api/v1/nova/blocs` |
| Bases | `Base` | `/api/v1/nova/bases` |
| Éléments | `Element` | `/api/v1/nova/elements` |
| Commentaires | `Commentaire` | `/api/v1/nova/commentaires` |
| Modèles | `Modele` | `/api/v1/nova/modeles` |
| Connexions | `Connexion` | `/api/v1/nova/connexions` |
| Favoris | `Favori` | `/api/v1/nova/favoris` |
| Notifications | `Notification` | `/api/v1/nova/notifications` |
| Paramètres | `Parametre` | `/api/v1/nova/parametres` |
| Publications | `Publication` | `/api/v1/nova/publications` |
| IA | `RequeteIA` | `/api/v1/nova/ia` |

Chaque routeur expose le CRUD standard du noyau (`GET /`, `GET /:id`, `POST /`,
`PUT /:id`, `DELETE /:id`) via `buildCrudRouter`.

## Rôles et sécurité

- **Lecture** : publique. **Écriture** : réservée au rôle `admin`.
- Le plugin Mongoose global DRY ajoute `slug`, `label` (dérivé du champ métier
  `nom`/`titre`/...), `status`, `deletedAt`, `createdBy`, `updatedBy`, et gère le
  soft-delete.

## Données de démonstration (seed)

`seed.js` crée un jeu de données réaliste et interconnecté (2 espaces, pages,
blocs, 2 bases avec éléments, modèles, connexions, favoris, notifications,
paramètres, publications, requêtes IA). **Idempotent et additif** : recherche par
clé naturelle, création uniquement si absent, jamais de `deleteMany`/`drop`.

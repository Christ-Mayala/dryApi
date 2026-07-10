# Contribuer à DRY API

## Avant de commencer

- Copier `.env.example` → `.env` et `.env.test.example` → `.env.test` (base isolée, jamais le cluster de production — voir [docs/04_TESTING_GUIDE.md](docs/04_TESTING_GUIDE.md)).
- `npm install`
- `npm run dev`

## Workflow

1. Créer une branche depuis `main`.
2. Faire les changements. Si tu touches `dry/` (le noyau partagé par toutes les apps), lis d'abord [docs/08_KERNEL_BOUNDARIES.md](docs/08_KERNEL_BOUNDARIES.md).
3. Avant de commit :
   ```bash
   npm run lint
   npm run test:unit
   ```
   Le hook `.husky/pre-commit` fait déjà ça automatiquement.
4. Pour les changements touchant une feature applicative, ajoute un test dans `tests/<App>/` correspondant.
5. Ouvrir une pull request vers `main`. La CI (`.github/workflows/ci.yml`) lance lint, format, tests unitaires, d'intégration et de fumée contre un MongoDB éphémère.

## Style de code

- ESLint + Prettier font foi (`npm run lint:fix`, `npm run format`).
- Pas de logique métier dans les routes — tout dans les contrôleurs/services.
- Toute donnée sensible (mot de passe, token, clé API) doit passer par `maskSensitiveData` avant d'être loguée.

## Ajouter une app ou une feature

Utilise le générateur plutôt que d'écrire la structure à la main :

```bash
npm run create-app        # nouvelle application
npm run create-frontend   # frontend pour une app existante
```

Voir [docs/00_PROJECT_MAP.md](docs/00_PROJECT_MAP.md) pour comprendre où chaque chose vit avant de modifier.

## Rapporter un bug / proposer une feature

Ouvrir une issue GitHub avec :

- Ce que tu attendais
- Ce qui s'est passé
- Étapes pour reproduire (si bug)

# Guide de test

Les tests sont maintenant separes par niveau:

```text
tests/
  unit/         noyau DRY, middlewares, bootstrap, config
  integration/  routes et features applicatives
  e2e/          parcours complets reserves aux scenarios bout en bout
```

## Commandes

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run coverage
```

## Regles recommandees

- toute modification dans `dry/` doit ajouter ou ajuster un test unitaire
- toute nouvelle feature dans `dryApp/` doit avoir au moins un test d'integration
- les tests e2e doivent rester limites a quelques parcours critiques

## Ce qui est deja couvert

- validation runtime de la configuration
- bootstrap HTTP et CORS
- auth middleware
- cache middleware
- router factory
- cache de connexions tenant

## Objectif de couverture

La couverture prioritaire doit porter sur `dry/` et `config/`, car c'est le moteur commun du framework.

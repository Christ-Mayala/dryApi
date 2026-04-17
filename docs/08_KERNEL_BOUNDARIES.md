# Conventions kernel vs app

Ce document formalise la frontiere entre `dry/` et `dryApp/`.

## Mettre dans `dry/`

- middleware reutilisable
- auth, validation, audit, cache
- factories CRUD et helpers HTTP
- bootstrap serveur
- integrations transverses
- conventions de test et scripts communs

## Mettre dans `dryApp/`

- routes propres a une app
- controllers metier
- schemas specifiques
- regles fonctionnelles propres a un tenant
- payloads, permissions ou workflows qui n'ont de sens que pour une app

## Ce qu'une app peut surcharger

- ses schemas
- ses routes
- ses controllers
- ses tests
- ses integrations optionnelles

## Ce qu'une app ne doit pas faire

- modifier `dry/` pour un besoin client isole
- contourner `req.getModel(...)` avec un `mongoose.model(...)` global
- redefinir localement les conventions de securite sans raison explicite
- dupliquer un middleware framework dans une feature metier

## Check avant merge

- est-ce reutilisable par au moins deux apps
- est-ce transverse au framework
- est-ce du metier pur

Si c'est transverse, `dry/`.
Si c'est metier, `dryApp/`.

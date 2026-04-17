# Scope produit

DRY n'a pas vocation a etre une boite noire qui fait tout. Le cadre recommande est:

## Ce que DRY promet

- un noyau API multi-tenant
- des conventions fortes pour livrer plus vite
- des scripts pour operer, tester et documenter
- un chemin propre entre framework et apps clientes

## Ce que DRY n'a pas besoin d'imposer partout

- Redis
- Cloudinary
- Stripe
- Socket.IO
- scraping
- media tooling

Ces modules sont utiles, mais doivent rester optionnels tant qu'une app n'en depend pas.

## Apps vitrine recommandees

Mettre surtout en avant:

- `SCIM`: reservation, notifications, administration
- `SkillForge`: catalogue, commandes, paiement
- `MediaDL`: traitement media et batchs

Elles montrent trois facettes differentes du framework sans diluer le message.

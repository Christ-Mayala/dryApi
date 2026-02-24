# Plan Reservation Web SCIM (Version Beton)

## Objectif
Donner au client un parcours reservation fiable sur le web, meme sans messagerie temps reel:

1. Demande de reservation immediate (statut `en attente`)
2. Accuse de reception automatique (reference + delai de reponse)
3. Suivi asynchrone clair dans l'espace client
4. Fallback WhatsApp optionnel pour les cas urgents

## Probleme a resoudre
- Le web n'est pas garanti temps reel pour la messagerie.
- Le client a besoin d'un retour instantane apres demande.
- Le support doit garder une trace exploitable (statut, reference, historique).

## Solution cible (Web)
### 1) Tunnel reservation dedie
- La reservation reste un flux metier (`/reservation`) et non un simple message libre.
- A la creation:
  - generation d'une reference unique (`RSV-...`)
  - statut initial `en attente`
  - historique de statut initialise

### 2) Accuse automatique
- Un message automatique est envoye au client (depuis admin configure) avec:
  - reference de reservation
  - delai cible de traitement (SLA)
  - lien WhatsApp optionnel (fallback)

### 3) Suivi asynchrone visible
- Dashboard client:
  - statut current (`en attente`, `confirmee`, `annulee`)
  - reference
  - historique (timeline simplifiee)
  - bouton WhatsApp si disponible

### 4) Workflow proprietaire/admin
- Confirmation/annulation met a jour:
  - statut
  - historique
  - notification message au client

## Variables de configuration
- `SCIM_WHATSAPP_PHONE`: numero support WhatsApp (optionnel)
- `SCIM_RESERVATION_SLA_MINUTES`: delai cible (par defaut 30)
- `SCIM_CONTACT_EMAIL`: admin de reference (deja utilise)

## Resultat attendu pour le client
- "Ma reservation est bien enregistree"
- "J'ai une reference et un delai"
- "Je peux suivre l'etat sur le site"
- "Si urgent, je peux basculer sur WhatsApp sans perdre le contexte"

## Perimetre de cette version
- Inclus: logique web asynchrone robuste + fallback WhatsApp.
- Exclu: push temps reel mobile (reserve a la version mobile).

## Criteres d'acceptation
1. Creation reservation retourne reference + support (SLA, WhatsApp si configure).
2. Message auto de prise en charge recu par le client.
3. Dashboard client affiche statut/reference/suivi.
4. Confirmation ou annulation met a jour le suivi + notifie le client.
5. Le flux marche sans WhatsApp configure (degradation propre).

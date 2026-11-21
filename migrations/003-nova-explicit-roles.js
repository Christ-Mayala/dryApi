/**
 * Migration 003 — RÔLES NOVA GLOBAUX : OBSOLETE, NE PAS EXÉCUTER.
 *
 * Le modèle « un rôle NOVA par compte » a été remplacé par une appartenance
 * par espace de travail (`Membre.workspaceId`). Le runtime ignore désormais
 * `User.novaRole`, `User.novaPermissions` et `User.novaEspaceIds`.
 *
 * Cette migration est conservée uniquement pour l'historique et le rollback
 * d'un éventuel déploiement antérieur. `up()` et `down()` sont donc des no-op
 * explicites : aucune donnée n'est écrite. Le backfill compatible est la
 * migration `005-nova-workspace-memberships.js`.
 */

'use strict';

const up = async () => {
  console.log('[Migration 003] Obsolète (modèle global supprimé) — aucune donnée modifiée.');
};

const down = async () => {
  console.log('[Migration 003] Obsolète — aucun rollback disponible, aucune donnée modifiée.');
};

module.exports = { up, down };

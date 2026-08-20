/**
 * Service du pipeline d'import automatique des podcasts (dryApp/Pelerin).
 *
 * Consigne chaque décision du pipeline (import auto/discover + modération
 * admin) dans la collection `PodcastImportDecision` et expose la lecture de
 * l'historique pour l'écran admin « Pipeline ».
 *
 * Le modèle est passé en paramètre (pattern tenant : chaque app a sa DB, le
 * schéma est compilé par req.getModel / getModel au point d'usage).
 */

/**
 * Consigne une décision du pipeline.
 * @param {object} params
 * @param {import('mongoose').Model} params.Decision — modèle PodcastImportDecision
 * @param {object} [params.show] — document PodcastShow concerné (après mise à jour)
 * @param {{status: string}|string|null} [params.decision] — décision appliquée
 *   (résultat de decideAutoPublish ou statut manuel)
 * @param {'auto'|'discover'|'manual'|'moderation'} [params.source]
 * @param {'import'|'approve'|'reject'|'reactivate'} [params.action]
 * @param {string} [params.reason] — motif de modération (optionnel)
 * @param {string} [params.moderatedBy] — id de l'admin (optionnel)
 * @returns {Promise<object|null>} l'entrée créée, ou null si aucun modèle
 */
async function recordPipelineDecision({
  Decision,
  show = null,
  decision = null,
  source = 'auto',
  action = 'import',
  reason = null,
  moderatedBy = null,
}) {
  if (!Decision) return null;

  const status = typeof decision === 'object' && decision !== null ? decision.status : decision;

  return Decision.create({
    showId: show?._id || null,
    showTitle: show?.title || null,
    rssUrl: show?.rssUrl || null,
    source,
    action,
    decision: status || 'manual',
    score: show?.score ?? null,
    scoreBreakdown: show?.scoreBreakdown || [],
    reason: reason || null,
    moderatedBy: moderatedBy || null,
    isPublished: !!show?.isPublished,
  });
}

/**
 * Récupère l'historique des décisions du pipeline, du plus récent au plus ancien.
 * @param {object} params
 * @param {import('mongoose').Model} params.Decision
 * @param {string} [params.status] — filtre sur la décision (auto/pending/rejected/manual)
 * @param {string} [params.source] — filtre sur l'origine (auto/discover/manual/moderation)
 * @param {string} [params.showId] — filtre sur un podcast précis
 * @param {number} [params.limit] — nombre max d'entrées (défaut 100, plafond 500)
 * @returns {Promise<object[]>}
 */
async function fetchPipelineHistory({ Decision, status, source, showId, limit = 100 }) {
  const query = {};
  if (status && ['auto', 'pending', 'rejected', 'manual'].includes(String(status))) {
    query.decision = String(status);
  }
  if (source && ['auto', 'discover', 'manual', 'moderation'].includes(String(source))) {
    query.source = String(source);
  }
  if (showId) {
    query.showId = showId;
  }

  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
  return Decision.find(query).sort({ createdAt: -1 }).limit(safeLimit).lean();
}

module.exports = { recordPipelineDecision, fetchPipelineHistory };

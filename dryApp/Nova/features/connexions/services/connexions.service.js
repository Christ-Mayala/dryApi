/**
 * Tests de connexion des intégrations tierces.
 *
 * Chaque test effectue un appel réseau réel et renvoie un résultat normalisé :
 *   { supporte, ok, message }
 * - `supporte` : un test automatique existe pour ce type d'intégration ;
 * - `ok`       : l'appel externe a réussi ;
 * - `message`  : compte rendu lisible pour l'utilisateur.
 *
 * Un échec réseau (DNS, pare-feu…) n'est pas une erreur serveur : il est
 * renvoyé comme un test en échec, l'API répondant toujours en succès.
 */

const DELAI_MAX_MS = 8000;

/** Exécute un `fetch` avec un délai maximal, en libérant le minuteur ensuite. */
async function avecDelai(url, options = {}) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MAX_MS);
  try {
    return await globalThis.fetch(url, { ...options, signal: controleur.signal });
  } finally {
    clearTimeout(minuteur);
  }
}

/** Lit une valeur de configuration sous forme de chaîne nettoyée. */
function valeurConfig(config, cle) {
  const brut = config ? config[cle] : undefined;
  if (brut === undefined || brut === null) return '';
  return String(brut).trim();
}

/**
 * Teste une connexion selon son type.
 * @param {{ type: string, nom: string, config?: Object }} connexion
 * @returns {Promise<{ supporte: boolean, ok: boolean, message: string }>}
 */
async function testerConnexion(connexion) {
  if (typeof globalThis.fetch !== 'function') {
    return { supporte: true, ok: false, message: 'Le runtime Node ne fournit pas `fetch`.' };
  }

  const config = connexion.config || {};

  try {
    switch (connexion.type) {
      case 'slack': {
        const webhook = valeurConfig(config, 'webhook');
        if (!webhook) {
          return { supporte: true, ok: false, message: 'Renseignez l’URL de webhook Slack.' };
        }
        const reponse = await avecDelai(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Test de connexion NOVA ✅' }),
        });
        return {
          supporte: true,
          ok: reponse.ok,
          message: reponse.ok
            ? 'Message de test envoyé sur Slack.'
            : `Slack a répondu avec le statut ${reponse.status}.`,
        };
      }

      case 'github': {
        const jeton = valeurConfig(config, 'jeton');
        if (!jeton) {
          return { supporte: true, ok: false, message: 'Renseignez un jeton d’accès GitHub.' };
        }
        const reponse = await avecDelai('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${jeton}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'NOVA',
          },
        });
        if (!reponse.ok) {
          return {
            supporte: true,
            ok: false,
            message: `GitHub a répondu avec le statut ${reponse.status}.`,
          };
        }
        const profil = await reponse.json().catch(() => null);
        const identifiant = profil && profil.login ? ` (${profil.login})` : '';
        return { supporte: true, ok: true, message: `Jeton GitHub valide${identifiant}.` };
      }

      case 'google_drive': {
        const jeton = valeurConfig(config, 'jeton');
        if (!jeton) {
          return {
            supporte: true,
            ok: false,
            message: 'Renseignez un jeton d’accès Google (OAuth).',
          };
        }
        const reponse = await avecDelai(
          'https://www.googleapis.com/drive/v3/about?fields=user',
          { headers: { Authorization: `Bearer ${jeton}` } }
        );
        if (!reponse.ok) {
          return {
            supporte: true,
            ok: false,
            message: `Google Drive a répondu avec le statut ${reponse.status}.`,
          };
        }
        const infos = await reponse.json().catch(() => null);
        const compte = infos?.user?.emailAddress ? ` (${infos.user.emailAddress})` : '';
        return { supporte: true, ok: true, message: `Jeton Google valide${compte}.` };
      }

      default:
        return {
          supporte: false,
          ok: false,
          message: 'Le test automatique n’est pas disponible pour cette intégration.',
        };
    }
  } catch (erreur) {
    const detail = erreur && erreur.message ? erreur.message : 'erreur inconnue';
    return { supporte: true, ok: false, message: `Échec de l’appel externe : ${detail}` };
  }
}

module.exports = { testerConnexion };

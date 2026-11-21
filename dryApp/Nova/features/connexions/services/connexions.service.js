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

const dns = require('dns').promises;
const net = require('net');

const DELAI_MAX_MS = 8000;

/**
 * Hôtes de webhook autorisés. La valeur par défaut est volontairement
 * restrictive (Slack) : une intégration supplémentaire doit être ajoutée
 * explicitement dans l'environnement du serveur, jamais par un simple
 * utilisateur via le champ `config`.
 */
const HOTES_WEBHOOK = (process.env.NOVA_WEBHOOK_HOSTS || 'hooks.slack.com')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** True pour une adresse IP loopback/privée/réservée (cible SSRF classique). */
function estAdressePrivee(adresse) {
  const ip = String(adresse || '').toLowerCase();
  if (ip.startsWith('::ffff:')) return estAdressePrivee(ip.slice(7));
  if (ip === '::1' || ip === 'unspecified' || ip === '0.0.0.0') return true;
  if (net.isIPv6(ip)) return /^(fc|fd|fe[89ab])/i.test(ip) || ip.startsWith('::');
  if (!net.isIPv4(ip)) return true;

  const [a, b] = ip.split('.').map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

/** Valide l'URL d'un webhook avant tout appel réseau (protection SSRF). */
async function estUrlWebhookAutorisee(url) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  const hote = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!HOTES_WEBHOOK.includes(hote)) return false;

  if (net.isIP(hote)) return !estAdressePrivee(hote);
  const resolutions = await dns.lookup(hote, { all: true });
  if (!resolutions.length) return false;
  return resolutions.every(({ address }) => !estAdressePrivee(address));
}

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
        if (!(await estUrlWebhookAutorisee(webhook))) {
          return {
            supporte: true,
            ok: false,
            message: 'URL de webhook refusée : seul un hôte HTTPS autorisé par l’administrateur peut être testé.',
          };
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

module.exports = { testerConnexion, estUrlWebhookAutorisee, estAdressePrivee };

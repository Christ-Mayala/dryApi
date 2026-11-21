/**
 * Chiffrement authentifié des secrets NOVA au repos (AES-256-GCM).
 *
 * La clé est fournie exclusivement par l'environnement du serveur :
 *   NOVA_CONNECTION_ENCRYPTION_KEY = clé base64 de 32 octets
 *     (génération : node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
 *
 * Aucune clé = aucune écriture de secret possible (fail-closed) : on ne
 * retombe jamais sur un stockage en clair. Les valeurs historiques en clair
 * restent lisibles jusqu'à leur prochaine écriture ou à la migration dédiée.
 */

const crypto = require('crypto');

const Env = 'nova-secret-v1';
const CLES_SENSIBLES =
  /(token|jeton|secret|password|motDePasse|webhook|apiKey|api_key|clientSecret|accessToken|refreshToken|privateKey)/i;

let cleEnCache = null;
let cleResolue = false;

function cleChiffrement() {
  if (cleResolue) return cleEnCache;
  cleResolue = true;
  const brut = process.env.NOVA_CONNECTION_ENCRYPTION_KEY;
  if (!brut) return null;
  try {
    const cle = Buffer.from(brut, 'base64');
    cleEnCache = cle.length === 32 ? cle : null;
  } catch {
    cleEnCache = null;
  }
  return cleEnCache;
}

function estChiffre(valeur) {
  return Boolean(valeur && typeof valeur === 'object' && valeur.env === Env && valeur.data);
}

function chiffrer(valeur) {
  if (valeur === undefined || valeur === null || estChiffre(valeur)) return valeur;
  const cle = cleChiffrement();
  if (!cle) {
    throw new Error(
      'NOVA_CONNECTION_ENCRYPTION_KEY doit être définie (base64, 32 octets) pour enregistrer un secret.'
    );
  }
  const iv = crypto.randomBytes(12);
  const chiffreur = crypto.createCipheriv('aes-256-gcm', cle, iv);
  chiffreur.setAAD(Buffer.from(Env));
  const data = Buffer.concat([chiffreur.update(JSON.stringify(valeur), 'utf8'), chiffreur.final()]);
  return {
    env: Env,
    iv: iv.toString('base64'),
    tag: chiffreur.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

function dechiffrer(valeur) {
  if (!estChiffre(valeur)) return valeur;
  const cle = cleChiffrement();
  if (!cle) {
    throw new Error(
      'NOVA_CONNECTION_ENCRYPTION_KEY est requise pour lire un secret chiffré. Clé absente ou invalide.'
    );
  }
  try {
    const dechiffreur = crypto.createDecipheriv(
      'aes-256-gcm',
      cle,
      Buffer.from(valeur.iv, 'base64')
    );
    dechiffreur.setAAD(Buffer.from(Env));
    dechiffreur.setAuthTag(Buffer.from(valeur.tag, 'base64'));
    const clair = Buffer.concat([
      dechiffreur.update(Buffer.from(valeur.data, 'base64')),
      dechiffreur.final(),
    ]).toString('utf8');
    return JSON.parse(clair);
  } catch (erreur) {
    // Un secret illisible n'est jamais transformé en « valeur absente » : on
    // prévient une réponse trompeuse du type « renseignez l'URL du webhook ».
    throw new Error(`Impossible de déchiffrer un secret NOVA : ${erreur.message}`);
  }
}

function transformerConfig(valeur, transformer, sensible = false) {
  if (sensible) return transformer(valeur);
  if (Array.isArray(valeur))
    return valeur.map((element) => transformerConfig(element, transformer));
  if (!valeur || typeof valeur !== 'object' || estChiffre(valeur)) return valeur;
  const resultat = {};
  for (const [cle, element] of Object.entries(valeur)) {
    resultat[cle] = transformerConfig(element, transformer, CLES_SENSIBLES.test(cle));
  }
  return resultat;
}

/** Chiffre récursivement les valeurs sensibles d'une configuration. */
function chiffrerConfig(config) {
  if (!config || typeof config !== 'object' || estChiffre(config)) return config;
  return transformerConfig(config, chiffrer);
}

/** Déchiffre récursivement les valeurs sensibles d'une configuration. */
function dechiffrerConfig(config) {
  if (!config || typeof config !== 'object') return config;
  if (estChiffre(config)) return dechiffrer(config);
  return transformerConfig(config, dechiffrer);
}

/** Copie sûre d'une configuration pour les réponses API et les logs. */
function masquerConfig(config) {
  if (!config || typeof config !== 'object') return config;
  if (estChiffre(config)) return '••••••••';
  return transformerConfig(config, () => '••••••••');
}

module.exports = {
  chiffrer,
  dechiffrer,
  chiffrerConfig,
  dechiffrerConfig,
  masquerConfig,
  estChiffre,
};

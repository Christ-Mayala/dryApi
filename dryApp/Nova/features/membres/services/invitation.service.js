const crypto = require('crypto');
const config = require('../../../../../config/database');
const emailService = require('../../../../../dry/services/auth/email.service');
const logger = require('../../../../../dry/utils/logging/logger');
const { notificationsEmailActives } = require('../../parametres/services/notifications.service');
const MembresSchema = require('../model/membres.schema');

/** Libellés français des rôles d'un membre de l'espace. */
const LIBELLES_ROLES = {
  admin: 'Administrateur',
  membre: 'Membre',
  invite: 'Invité',
};

/**
 * Correspondance rôle d'espace NOVA → rôle de compte utilisateur DRY.
 * Seul le rôle « Administrateur » ouvre les droits d'administration réels.
 */
const ROLE_UTILISATEUR = {
  admin: 'admin',
  membre: 'user',
  invite: 'user',
};

/**
 * Permissions par défaut associées à chaque rôle d'espace NOVA.
 * Elles restent personnalisables membre par membre par un administrateur.
 */
const PERMISSIONS_PAR_ROLE = {
  admin: { lecture: true, edition: true, commentaire: true, partage: true, admin: true },
  membre: { lecture: true, edition: true, commentaire: true, partage: false, admin: false },
  invite: { lecture: true, edition: false, commentaire: false, partage: false, admin: false },
};

const CLES_PERMISSIONS = ['lecture', 'edition', 'commentaire', 'partage', 'admin'];

/** Copie des permissions par défaut d'un rôle. */
function permissionsPourRole(role) {
  return { ...(PERMISSIONS_PAR_ROLE[role] || PERMISSIONS_PAR_ROLE.membre) };
}

/**
 * Normalise des permissions : complète les clés absentes avec les valeurs du
 * rôle, force la lecture et applique l'implication « admin ⇒ tous les droits ».
 */
function normaliserPermissions(role, permissions) {
  const base = permissionsPourRole(role);
  const resultat = { ...base };

  if (permissions && typeof permissions === 'object') {
    for (const cle of CLES_PERMISSIONS) {
      if (permissions[cle] !== undefined) resultat[cle] = Boolean(permissions[cle]);
    }
  }

  resultat.lecture = true;
  if (resultat.admin) {
    resultat.edition = true;
    resultat.commentaire = true;
    resultat.partage = true;
  }
  return resultat;
}

/**
 * Normalise une liste d'identifiants d'espaces : renvoie `null` lorsque la
 * valeur est absente (aucun filtrage) ou un tableau de chaînes triées.
 */
function normaliserEspaceIds(espaceIds) {
  if (espaceIds === undefined || espaceIds === null) return null;
  if (!Array.isArray(espaceIds)) return null;
  return espaceIds
    .map((id) => {
      if (!id) return null;
      // ObjectId (Mongoose/BSON) ou document populé : on privilégie `_id`,
      // puis on convertit en chaîne hexadécimale.
      const brut = typeof id === 'object' ? id._id || id : id;
      return String(brut);
    })
    .filter(Boolean)
    .sort();
}

/**
 * Applique le rôle, les permissions et les espaces d'un membre au compte
 * utilisateur. Ne modifie jamais un super-administrateur global. Renvoie `true`
 * si le document a changé (l'appelant décide de l'enregistrement).
 */
function appliquerAccesUtilisateur({ utilisateur, role, permissions, espaceIds }) {
  if (!utilisateur) return false;
  if (utilisateur.role === 'superadmin') return false;

  let modifie = false;
  const roleCible = ROLE_UTILISATEUR[role] || 'user';
  if (utilisateur.role !== roleCible) {
    utilisateur.role = roleCible;
    modifie = true;
  }
  if (utilisateur.novaRole !== role) {
    utilisateur.novaRole = role;
    modifie = true;
  }

  const cible = normaliserPermissions(role, permissions);
  const actuel = utilisateur.novaPermissions || {};
  const differentes = CLES_PERMISSIONS.some((cle) => Boolean(actuel[cle]) !== cible[cle]);
  if (differentes || !utilisateur.novaPermissions) {
    utilisateur.novaPermissions = cible;
    modifie = true;
  }

  const espacesCible = normaliserEspaceIds(espaceIds);
  if (espacesCible !== null) {
    const espacesActuels = normaliserEspaceIds(utilisateur.novaEspaceIds) || [];
    if (JSON.stringify(espacesActuels) !== JSON.stringify(espacesCible)) {
      utilisateur.novaEspaceIds = espacesCible;
      modifie = true;
    }
  }
  return modifie;
}

/** Échappe les caractères HTML des valeurs interpolées dans l'e-mail. */
function echapper(valeur) {
  return String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Nom de l'espace de travail configuré (repli : « NOVA »). */
function nomPlateforme() {
  return config.APP_NAME && config.APP_NAME !== 'CyberFusion' ? config.APP_NAME : 'NOVA';
}

/** Construit le lien d'acceptation de l'invitation (écran connexion). */
function resoudreLienInvitation(email) {
  const base = String(config.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
  return `${base.replace(/\/+$/, '')}/connexion?email=${encodeURIComponent(email)}`;
}

/**
 * Génère un mot de passe provisoire robuste : 12 caractères mêlant minuscules,
 * majuscules, chiffres et caractères spéciaux, tirés par `crypto.randomInt`
 * (cryptographiquement sûr) puis mélangés.
 */
function genererMotDePasseTemporaire() {
  const minuscules = 'abcdefghijkmnpqrstuvwxyz';
  const majuscules = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const chiffres = '23456789';
  const speciaux = '!@#$%*?';
  const tous = minuscules + majuscules + chiffres + speciaux;
  const tirer = (jeu) => jeu[crypto.randomInt(0, jeu.length)];

  // Au moins un caractère de chaque catégorie, pour satisfaire les politiques
  // de mot de passe courantes.
  const caracteres = [tirer(minuscules), tirer(majuscules), tirer(chiffres), tirer(speciaux)];
  while (caracteres.length < 12) caracteres.push(tirer(tous));

  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

/**
 * Crée le compte utilisateur associé à un membre invité, ou le relie s'il
 * existe déjà. Le compte est créé avec un mot de passe provisoire et le
 * drapeau `mustChangePassword` (changement obligatoire à la première connexion).
 *
 * @param {Object} params
 * @param {boolean} [params.regenererMotDePasse=false] - Si le compte existe
 *   déjà, réinitialise son mot de passe par un nouveau mot de passe provisoire
 *   (utilisé par le renvoi d'invitation lorsqu'on n'a plus le premier e-mail).
 * @returns {Promise<{ utilisateur: Object|null, motDePasseTemporaire: string|null }>}
 */
async function creerOuLierCompteMembre({ req, membre, regenererMotDePasse = false }) {
  const email = String(membre?.email || '').trim().toLowerCase();
  if (!email) return { utilisateur: null, motDePasseTemporaire: null };

  const User = req.getModel('User');
  const permissions = normaliserPermissions(membre.role, membre.permissions);

  const existant = await User.findOne({ email }).select('+password');
  if (existant) {
    await lierCompteAuMembre({ req, membre, utilisateurId: existant._id });

    // Le rôle et les permissions de la fiche membre font foi : on les reporte
    // sur le compte afin qu'une rétrogradation révoque immédiatement les droits.
    const accesModifie = appliquerAccesUtilisateur({
      utilisateur: existant,
      role: membre.role,
      permissions,
      espaceIds: membre.espaceIds,
    });

    // Renvoi d'invitation : on remplace l'ancien mot de passe provisoire par un
    // nouveau, afin que l'e-mail réexpédié contienne des identifiants valides.
    if (regenererMotDePasse) {
      const nouveauTemporaire = genererMotDePasseTemporaire();
      existant.password = nouveauTemporaire;
      existant.mustChangePassword = true;
      await existant.save();
      return { utilisateur: existant, motDePasseTemporaire: nouveauTemporaire };
    }

    if (accesModifie) await existant.save();

    return { utilisateur: existant, motDePasseTemporaire: null };
  }

  const motDePasseTemporaire = genererMotDePasseTemporaire();
  const utilisateur = await User.create({
    name: membre.nom || email,
    nom: membre.nom || undefined,
    email,
    password: motDePasseTemporaire,
    role: ROLE_UTILISATEUR[membre.role] || 'user',
    novaRole: membre.role || 'membre',
    novaPermissions: permissions,
    novaEspaceIds: normaliserEspaceIds(membre.espaceIds) || undefined,
    mustChangePassword: true,
  });

  await lierCompteAuMembre({ req, membre, utilisateurId: utilisateur._id });
  return { utilisateur, motDePasseTemporaire };
}

/** Renseigne `utilisateurId` sur le membre (sans écraser un lien existant). */
async function lierCompteAuMembre({ req, membre, utilisateurId }) {
  if (!membre?._id || !utilisateurId) return;
  if (String(membre.utilisateurId || '') === String(utilisateurId)) return;
  const Membre = req.getModel('Membre', MembresSchema);
  await Membre.findByIdAndUpdate(membre._id, { $set: { utilisateurId } });
}

/**
 * Reporte le rôle et les permissions d'une fiche Membre sur le compte
 * utilisateur correspondant. Utilisé après création/mise à jour d'un membre :
 * une rétrogradation ou un retrait de droits est ainsi immédiatement effectif
 * (le middleware `protect` recharge l'utilisateur depuis la base à chaque
 * requête, donc aucun jeton n'a besoin d'être réémis).
 *
 * @returns {Promise<boolean>} true si le compte a été mis à jour.
 */
async function synchroniserAccesUtilisateur({ req, membre }) {
  if (!membre?.email) return false;

  const User = req.getModel('User');
  const utilisateur = membre.utilisateurId
    ? await User.findById(membre.utilisateurId)
    : await User.findOne({ email: String(membre.email).trim().toLowerCase() });
  if (!utilisateur) return false;

  const modifie = appliquerAccesUtilisateur({
    utilisateur,
    role: membre.role || 'membre',
    permissions: membre.permissions,
    espaceIds: membre.espaceIds,
  });
  if (modifie) await utilisateur.save();
  return modifie;
}

/** Gabarit HTML de l'e-mail d'invitation avec identifiants et consignes. */
function gabaritInvitation({ email, nom, role, lien, motDePasseTemporaire, nomEspace, expediteur, annee }) {
  const roleLibelle = LIBELLES_ROLES[role] || 'Membre';
  const badgeIdentifiants = motDePasseTemporaire
    ? `
      <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 20px">
        <p style="margin:0 0 10px;font-size:13px;font-weight:bold;color:#0f172a">Vos identifiants de connexion</p>
        <p style="margin:0 0 6px;font-size:13px;color:#334155">
          <span style="color:#64748b">Adresse e-mail :</span>
          <strong>${echapper(email)}</strong>
        </p>
        <p style="margin:0;font-size:13px;color:#334155">
          <span style="color:#64748b">Mot de passe provisoire :</span>
          <strong style="font-family:Consolas,Menlo,monospace;font-size:15px;letter-spacing:0.5px">${echapper(motDePasseTemporaire)}</strong>
        </p>
      </div>`
    : '';

  const etapeMotDePasse = motDePasseTemporaire
    ? 'Saisissez votre adresse e-mail ainsi que le <strong>mot de passe provisoire</strong> ci-dessus.'
    : 'Saisissez votre adresse e-mail et votre mot de passe habituel.';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.55">
    <div style="padding:20px 0;border-bottom:1px solid #e5e7eb">
      <span style="font-size:18px;font-weight:bold">${echapper(nomEspace)}</span>
    </div>

    <h2 style="margin:22px 0 12px;font-size:19px">Vous êtes invité(e) à rejoindre ${echapper(nomEspace)}</h2>
    <p style="margin:0 0 12px">
      Bonjour${nom ? ` ${echapper(nom)}` : ''}, <strong>${echapper(expediteur)}</strong> vous invite à collaborer sur
      <strong>${echapper(nomEspace)}</strong>, l'espace de travail tout-en-un pour vos notes, bases et projets.
    </p>
    <p style="margin:0 0 18px">Votre rôle dans cet espace : <strong>${echapper(roleLibelle)}</strong>.</p>

    ${badgeIdentifiants}

    <p style="margin:0 0 14px">
      <a href="${lien}"
         style="display:inline-block;padding:11px 20px;border-radius:8px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:bold">
        Activer mon compte
      </a>
    </p>

    <h3 style="margin:24px 0 8px;font-size:15px">Votre première connexion en 3 étapes</h3>
    <ol style="margin:0 0 20px;padding-left:20px;color:#334155">
      <li style="margin-bottom:6px">Cliquez sur « Activer mon compte » (ou ouvrez le lien fourni plus bas).</li>
      <li style="margin-bottom:6px">${etapeMotDePasse}</li>
      <li>${
        motDePasseTemporaire
          ? 'Choisissez un <strong>nouveau mot de passe personnel</strong> : le mot de passe provisoire doit être modifié dès cette première connexion.'
          : 'Vous accédez directement à votre espace de travail.'
      }</li>
    </ol>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;margin:0 0 20px">
      <p style="margin:0;font-size:12.5px;color:#92400e">
        <strong>Sécurité :</strong> ne partagez jamais ce mot de passe. Il vous est strictement personnel et
        expire dès que vous le remplacez. Si vous n'êtes pas à l'origine de cette invitation, ignorez ce message.
      </p>
    </div>

    <p style="margin:0 0 22px;color:#6b7280;font-size:12px;word-break:break-all">
      Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br />
      <a href="${lien}" style="color:#0ea5e9">${lien}</a>
    </p>

    <div style="border-top:1px solid #e5e7eb;padding-top:14px;color:#6b7280;font-size:11.5px">
      <p style="margin:0 0 6px">
        <strong>Mentions légales.</strong> Cette invitation est envoyée par ${echapper(nomEspace)} dans le cadre de
        la gestion des accès à son espace de travail collaboratif. Votre adresse e-mail est utilisée uniquement
        pour la création de votre compte et les notifications liées au service. Conformément à la réglementation
        applicable sur la protection des données personnelles, vous disposez d'un droit d'accès, de rectification
        et de suppression de vos données : vous pouvez l'exercer en écrivant à l'administrateur de l'espace
        ou en vous adressant au support de ${echapper(nomEspace)}.
      </p>
      <p style="margin:0">
        Cet e-mail vous a été adressé automatiquement, merci de ne pas y répondre.<br />
        © ${annee} ${echapper(nomEspace)}. Tous droits réservés.
      </p>
    </div>
  </div>`;
}

/** Nom de l'espace de travail configuré (repli : « NOVA »). */
async function nomEspaceDe(req) {
  try {
    const Parametre = req.getModel('Parametre');
    const parametre = await Parametre.findOne().sort('createdAt').lean();
    if (parametre?.nomEspace) return parametre.nomEspace;
  } catch (e) {
    logger(`[Nova] Lecture du nom de l'espace impossible: ${e.message}`, 'warning');
  }
  return nomPlateforme();
}

/**
 * Prépare le compte du nouveau membre (création d'un compte utilisateur avec
 * mot de passe provisoire) puis lui envoie l'e-mail d'invitation.
 *
 * L'envoi respecte le réglage « notifications e-mail » de l'espace ;
 * la création du compte, elle, a toujours lieu.
 *
 * @param {Object} params
 * @param {import('express').Request} params.req
 * @param {Object} params.membre - Document (ou objet) Membre après enregistrement.
 * @param {boolean} [params.regenererMotDePasse=false] - Régénère un mot de passe
 *   provisoire pour un compte déjà existant (renvoi d'invitation).
 * @returns {Promise<boolean>} true si l'e-mail a été envoyé.
 */
async function notifierInvitationMembre({ req, membre, regenererMotDePasse = false }) {
  const email = String(membre?.email || '').trim();
  if (!email) return false;

  let motDePasseTemporaire = null;

  try {
    const resultat = await creerOuLierCompteMembre({ req, membre, regenererMotDePasse });
    motDePasseTemporaire = resultat.motDePasseTemporaire;
    if (motDePasseTemporaire) {
      logger(
        `[Nova] ${regenererMotDePasse ? 'Mot de passe provisoire réinitialisé' : 'Compte créé'} pour ${email}`,
        'info',
      );
    }
  } catch (e) {
    logger(`[Nova] Création du compte impossible pour ${email}: ${e.message}`, 'error');
  }

  if (!(await notificationsEmailActives(req))) {
    logger(`[Nova] Invitation membre non envoyée à ${email} (notifications e-mail désactivées)`, 'info');
    return false;
  }

  const expediteur = nomPlateforme();
  const lien = resoudreLienInvitation(email);
  const nomEspace = await nomEspaceDe(req);

  try {
    const ok = await emailService.sendGenericEmail({
      email,
      subject: `Invitation à rejoindre ${nomEspace}`,
      html: gabaritInvitation({
        email,
        nom: membre.nom,
        role: membre.role,
        lien,
        motDePasseTemporaire,
        nomEspace,
        expediteur,
        annee: new Date().getFullYear(),
      }),
    });
    if (ok) logger(`[Nova] Invitation membre envoyée à ${email}`, 'info');
    return ok;
  } catch (e) {
    logger(`[Nova] Invitation membre non envoyée à ${email}: ${e.message}`, 'error');
    return false;
  }
}

module.exports = {
  notifierInvitationMembre,
  resoudreLienInvitation,
  genererMotDePasseTemporaire,
  synchroniserAccesUtilisateur,
  permissionsPourRole,
  normaliserPermissions,
};

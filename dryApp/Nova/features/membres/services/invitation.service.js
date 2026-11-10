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
  const destinataire = String(nom || '').trim();
  const salutation = destinataire ? `Bonjour ${echapper(destinataire)},` : 'Bonjour,';
  // L'invitant et l'espace portent parfois le même nom : on évite alors la
  // formulation « NOVA vous invite à rejoindre NOVA ».
  const invitation = expediteur && expediteur !== nomEspace
    ? `<strong>${echapper(expediteur)}</strong> vous invite à rejoindre <strong>${echapper(nomEspace)}</strong>`
    : `Vous êtes invité(e) à rejoindre <strong>${echapper(nomEspace)}</strong>`;

  const blocIdentifiants = motDePasseTemporaire
    ? `
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;background-color:#fafafa;border:1px solid #eaeaea;border-radius:12px;">
                    <tr>
                      <td style="padding:18px 20px;">
                        <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.6px;text-transform:uppercase;color:#8a8a90;">
                          Vos identifiants de connexion
                        </p>
                        <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#3f3f46;">
                          <span style="color:#8a8a90;">Adresse e-mail&nbsp;:</span>
                          <strong style="color:#111114;">${echapper(email)}</strong>
                        </p>
                        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#3f3f46;">
                          <span style="color:#8a8a90;">Mot de passe provisoire&nbsp;:</span>
                          <strong style="color:#111114;font-family:Consolas,Menlo,monospace;font-size:15px;letter-spacing:0.5px;">${echapper(motDePasseTemporaire)}</strong>
                        </p>
                      </td>
                    </tr>
                  </table>`
    : '';

  const etapeMotDePasse = motDePasseTemporaire
    ? 'Saisissez votre adresse e-mail puis le <strong style="color:#111114;">mot de passe provisoire</strong> indiqué ci-dessus.'
    : 'Saisissez votre adresse e-mail et votre mot de passe habituel.';

  const derniereEtape = motDePasseTemporaire
    ? 'Choisissez un <strong style="color:#111114;">mot de passe personnel</strong> : le mot de passe provisoire doit être remplacé dès cette première connexion.'
    : 'Vous accédez directement à l’espace de travail.';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <title>Invitation à rejoindre ${echapper(nomEspace)}</title>
  <style>
    /* Améliorations mobiles ; sans support, les styles en ligne suffisent. */
    @media (max-width: 600px) {
      .conteneur { width: 100% !important; }
      .rembourrage { padding-left: 22px !important; padding-right: 22px !important; }
      .retourligne { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-text-size-adjust:100%;">

  <!-- Aperçu affiché par la boîte de réception. -->
  <div style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${echapper(expediteur || nomEspace)} vous invite à collaborer sur ${echapper(nomEspace)}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" class="conteneur" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">

          <!-- En-tête : identité de l'espace -->
          <tr>
            <td align="center" style="background-color:#0b0b0d;padding:30px 24px;border-bottom:4px solid #f5c518;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:900;letter-spacing:2px;color:#f5c518;text-transform:uppercase;">${echapper(nomEspace)}</span>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#8b8b90;text-transform:uppercase;margin-top:6px;">
                Espace de travail collaboratif
              </div>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td class="rembourrage" style="padding:40px 40px 8px 40px;font-family:Arial,Helvetica,sans-serif;">

              <h1 style="margin:0 0 16px 0;font-size:23px;line-height:1.35;font-weight:800;color:#111114;">
                ${salutation}
              </h1>

              <p style="margin:0 0 16px 0;font-size:15.5px;line-height:1.7;color:#3f3f46;">
                ${invitation}, l’espace de travail tout-en-un pour vos notes, vos bases de données et vos projets.
              </p>

              <p style="margin:0 0 26px 0;font-size:15.5px;line-height:1.7;color:#3f3f46;">
                Votre rôle dans cet espace&nbsp;:
                <span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:#fff8e1;border:1px solid #f5c518;color:#7a5c00;font-size:13px;font-weight:bold;">
                  ${echapper(roleLibelle)}
                </span>
              </p>

              ${blocIdentifiants}

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 30px auto;">
                <tr>
                  <td align="center" bgcolor="#f5c518" style="border-radius:12px;">
                    <a href="${lien}"
                       style="display:inline-block;padding:15px 36px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;color:#0b0b0d;text-decoration:none;border-radius:12px;">
                      Activer mon compte
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Première connexion -->
          <tr>
            <td class="rembourrage" style="padding:0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #eaeaea;border-radius:12px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.6px;text-transform:uppercase;color:#8a8a90;">
                      Votre première connexion en 3 étapes
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="30" valign="top" style="padding:0 0 12px 0;">
                          <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background-color:#f5c518;color:#0b0b0d;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;">1</span>
                        </td>
                        <td valign="top" style="padding:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:#3f3f46;">
                          Cliquez sur « Activer mon compte » (ou copiez le lien fourni plus bas).
                        </td>
                      </tr>
                      <tr>
                        <td width="30" valign="top" style="padding:0 0 12px 0;">
                          <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background-color:#f5c518;color:#0b0b0d;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;">2</span>
                        </td>
                        <td valign="top" style="padding:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:#3f3f46;">
                          ${etapeMotDePasse}
                        </td>
                      </tr>
                      <tr>
                        <td width="30" valign="top" style="padding:0;">
                          <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background-color:#f5c518;color:#0b0b0d;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;">3</span>
                        </td>
                        <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:#3f3f46;">
                          ${derniereEtape}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Avertissement de sécurité -->
          <tr>
            <td class="rembourrage" style="padding:18px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff8e1;border:1px solid #f5c518;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#7a5c00;">
                    <strong>Sécurité.</strong> Ne partagez jamais ce mot de passe&nbsp;: il vous est strictement
                    personnel et cesse d’être valable dès que vous le remplacez. Si vous n’êtes pas à l’origine
                    de cette invitation, ignorez simplement ce message.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Lien de secours -->
          <tr>
            <td class="rembourrage" style="padding:22px 40px 30px 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8a8a90;">
              Le bouton ne fonctionne pas&nbsp;? Copiez ce lien dans votre navigateur&nbsp;:<br>
              <a href="${lien}" style="color:#b58800;word-break:break-all;">${lien}</a>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="background-color:#0b0b0d;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#a1a1aa;">
                <strong style="color:#f5c518;">${echapper(nomEspace)}</strong> · Espace de travail tout-en-un
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#71717a;">
                Cette invitation vous est adressée dans le cadre de la gestion des accès à l’espace de travail.
                Votre adresse e-mail sert uniquement à la création de votre compte et aux notifications du
                service. Vous disposez d’un droit d’accès, de rectification et de suppression de vos données,
                à exercer auprès de l’administrateur de l’espace.<br>
                © ${annee} ${echapper(nomEspace)}. Tous droits réservés.
              </p>
            </td>
          </tr>

        </table>

        <p style="margin:18px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a1a1aa;">
          Cet e-mail vous a été adressé automatiquement, merci de ne pas y répondre directement.
        </p>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Version texte brut de l'e-mail d'invitation (délivrabilité et clients sans HTML). */
function texteInvitation({ email, nom, role, lien, motDePasseTemporaire, nomEspace, expediteur }) {
  const roleLibelle = LIBELLES_ROLES[role] || 'Membre';
  const destinataire = String(nom || '').trim();
  const lignes = [
    destinataire ? `Bonjour ${destinataire},` : 'Bonjour,',
    '',
    `${expediteur || nomEspace} vous invite à rejoindre ${nomEspace} (rôle : ${roleLibelle}).`,
    '',
    'Vos identifiants de connexion :',
    `- Adresse e-mail : ${email}`,
  ];
  if (motDePasseTemporaire) {
    lignes.push(`- Mot de passe provisoire : ${motDePasseTemporaire}`);
  }
  lignes.push(
    '',
    `Activez votre compte : ${lien}`,
    '',
    motDePasseTemporaire
      ? 'Vous devrez choisir un nouveau mot de passe personnel dès la première connexion.'
      : 'Connectez-vous avec votre mot de passe habituel.',
    '',
    `Sécurité : ne partagez jamais ce mot de passe. Si vous n'êtes pas à l'origine de cette invitation, ignorez ce message.`,
    '',
    `© ${new Date().getFullYear()} ${nomEspace}. Tous droits réservés.`,
  );
  return lignes.join('\n');
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

  const lien = resoudreLienInvitation(email);
  const nomEspace = await nomEspaceDe(req);
  // L'invitant est l'utilisateur qui effectue l'ajout ; à défaut, l'invitation
  // est présentée au nom de l'espace de travail.
  const expediteur =
    String(req?.user?.name || req?.user?.nom || '').trim() || nomEspace;
  const annee = new Date().getFullYear();
  const invitation = {
    email,
    nom: membre.nom,
    role: membre.role,
    lien,
    motDePasseTemporaire,
    nomEspace,
    expediteur,
    annee,
  };

  try {
    const ok = await emailService.sendGenericEmail({
      email,
      subject: `Invitation à rejoindre ${nomEspace}`,
      html: gabaritInvitation(invitation),
      text: texteInvitation(invitation),
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

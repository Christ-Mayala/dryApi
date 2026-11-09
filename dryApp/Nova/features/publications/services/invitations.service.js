const config = require('../../../../../config/database');
const emailService = require('../../../../../dry/services/auth/email.service');
const logger = require('../../../../../dry/utils/logging/logger');
const { notificationsEmailActives } = require('../../parametres/services/notifications.service');

/** Libellés français des rôles/niveaux d'accès d'une publication. */
const LIBELLES_ACCES = {
  lecture: 'Lecture seule',
  commentaire: 'Peut commenter',
  edition: 'Peut modifier',
  complet: 'Accès complet',
  lecteur: 'Lecteur',
  commentateur: 'Commentateur',
  editeur: 'Éditeur',
  admin: 'Administrateur',
};

/** Normalise une adresse email pour la comparaison. */
const normaliser = (valeur) => String(valeur || '').trim().toLowerCase();

/** Construit le lien public d'une publication (domaine sinon lien interne). */
function resoudreLien(publication) {
  const domaine = String(publication?.domaine || '').trim();
  if (domaine) {
    return /^https?:\/\//i.test(domaine) ? domaine : `https://${domaine}`;
  }
  const base = String(config.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
  return `${base.replace(/\/+$/, '')}/page/${publication?.pageId ?? ''}`;
}

/** Gabarit HTML de l'email d'invitation. */
function gabaritInvitation({ titrePage, role, lien, expediteur }) {
  const roleLibelle = LIBELLES_ACCES[role] || role || 'Lecture seule';
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
    <h2 style="margin:0 0 12px">Vous êtes invité à consulter une page</h2>
    <p style="margin:0 0 12px">
      <strong>${expediteur}</strong> vous invite à consulter la page
      <strong>« ${titrePage} »</strong> sur NOVA Workspace.
    </p>
    <p style="margin:0 0 20px">Votre niveau d'accès : <strong>${roleLibelle}</strong>.</p>
    <p style="margin:0 0 24px">
      <a href="${lien}"
         style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0ea5e9;color:#ffffff;text-decoration:none">
        Ouvrir la page
      </a>
    </p>
    <p style="margin:0;color:#6b7280;font-size:12px">
      Si le bouton ne fonctionne pas, copiez ce lien : ${lien}
    </p>
  </div>`;
}

/**
 * Envoie un email d'invitation à une adresse.
 * @returns {Promise<boolean>} true si l'envoi a réussi.
 */
async function envoyerInvitation({ email, role, titrePage, lien, expediteur }) {
  return emailService.sendGenericEmail({
    email,
    subject: `${expediteur} vous invite à consulter « ${titrePage} »`,
    html: gabaritInvitation({ titrePage, role, lien, expediteur }),
  });
}

/**
 * Notifie par email uniquement les personnes nouvellement invitées d'une publication.
 * Les adresses déjà présentes dans `emailsPrecedents` sont ignorées (pas de renvoi).
 *
 * @param {Object} params
 * @param {import('express').Request} params.req
 * @param {Object} params.publication - Document Publication après enregistrement.
 * @param {string[]} [params.emailsPrecedents] - Emails déjà invités (cas d'une mise à jour).
 * @returns {Promise<number>} Nombre d'emails effectivement envoyés.
 */
async function notifierNouvellesInvitations({ req, publication, emailsPrecedents = [] }) {
  if (!(await notificationsEmailActives(req))) {
    logger('[Nova] Invitations de publication non envoyées (notifications e-mail désactivées)', 'info');
    return 0;
  }

  const invites = Array.isArray(publication?.invites) ? publication.invites : [];
  const dejaNotifies = new Set(emailsPrecedents.map(normaliser));

  const cibles = [
    ...new Set(invites.map((i) => String(i?.email || '').trim()).filter((e) => e && !dejaNotifies.has(normaliser(e)))),
  ];
  if (!cibles.length) return 0;

  const roleParEmail = new Map(invites.map((i) => [normaliser(i?.email), i?.role]));

  let titrePage = 'une page';
  try {
    const Page = req.getModel('Page');
    const page = await Page.findById(publication.pageId).lean();
    if (page?.titre) titrePage = page.titre;
  } catch (e) {
    logger(`[Nova] Invitation: page introuvable (${e.message})`, 'warning');
  }

  const lien = resoudreLien(publication);
  const expediteur = config.APP_NAME && config.APP_NAME !== 'CyberFusion' ? config.APP_NAME : 'NOVA';

  let envoyes = 0;
  for (const email of cibles) {
    try {
      const ok = await envoyerInvitation({
        email,
        role: roleParEmail.get(normaliser(email)) || publication.acces,
        titrePage,
        lien,
        expediteur,
      });
      if (ok) envoyes += 1;
    } catch (e) {
      logger(`[Nova] Invitation non envoyée à ${email}: ${e.message}`, 'error');
    }
  }

  if (envoyes) logger(`[Nova] ${envoyes} invitation(s) envoyée(s) pour la page « ${titrePage} »`, 'info');
  return envoyes;
}

module.exports = { notifierNouvellesInvitations, resoudreLien };

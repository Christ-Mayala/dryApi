/**
 * Temps réel NOVA : rooms Socket.IO par espace d'équipe, diffusion des
 * événements (messages, commentaires) et notifications d'activité d'équipe.
 *
 * Le service reste volontairement autonome : il retrouve Socket.IO via
 * `req.app.get('io')` (posé par `dry/bootstrap/socket.js`) et compile ses
 * modèles à la demande via la fabrique DRY.
 */

const getModel = require('../../../dry/core/factories/modelFactory');
const logger = require('../../../dry/utils/logging/logger');
const { contexteDe, peutLireNova, peutEditerNova } = require('./acl.service');

/** Tenant NOVA (nom du dossier dryApp). */
const APP = 'Nova';

/** Nom de la room Socket.IO d'un espace d'équipe. */
const roomEquipe = (espaceId) => `equipe:${espaceId}`;

/** Nom de la room Socket.IO personnelle d'un utilisateur. */
const roomUtilisateur = (userId) => String(userId);

/** Nom de la room Socket.IO d'une page (édition collaborative). */
const roomPage = (pageId) => `page:${pageId}`;

/** Teintes des pastilles de présence, attribuées par ordre d'arrivée. */
const COULEURS_PRESENCE = [
  '#e03e3e',
  '#d9730d',
  '#dfab01',
  '#0f7b6c',
  '#0b6e99',
  '#6940a5',
  '#ad1a72',
  '#787774',
];

/** Présence par page : `pageId` -> Map(socketId -> participant). */
const presencePages = new Map();

/** Récupère l'instance Socket.IO attachée à l'application Express. */
function ioDe(req) {
  try {
    return req?.app?.get?.('io') || null;
  } catch (_) {
    return null;
  }
}

/** Émet un événement vers une room, sans échouer si Socket.IO est absent. */
function emettre(req, room, evenement, donnees) {
  const io = ioDe(req);
  if (!io || !room) return false;
  io.to(String(room)).emit(evenement, donnees);
  return true;
}

/**
 * Identifiants des utilisateurs membres d'un espace d'équipe : fiches Membre
 * rattachées à l'espace, comptes dont le périmètre inclut l'espace, et auteur
 * de l'espace.
 *
 * @returns {Promise<Set<string>>} identifiants d'utilisateurs (chaînes).
 */
async function membresDeEspace(req, espaceId) {
  const ids = new Set();
  if (!espaceId) return ids;

  try {
    const Espace = req.getModel('Espace');
    const espace = await Espace.findById(espaceId).select('createdBy').lean();
    if (espace?.createdBy) ids.add(String(espace.createdBy));
  } catch (_) {
    /* espace introuvable : on poursuit */
  }

  try {
    const Membre = req.getModel('Membre');
    const fiches = await Membre.find({ espaceIds: espaceId }).select('utilisateurId email').lean();
    const emails = [];
    fiches.forEach((fiche) => {
      if (fiche.utilisateurId) ids.add(String(fiche.utilisateurId));
      else if (fiche.email) emails.push(String(fiche.email).toLowerCase());
    });
    if (emails.length) {
      const User = req.getModel('User');
      const comptes = await User.find({ email: { $in: emails } })
        .select('_id')
        .lean();
      comptes.forEach((compte) => ids.add(String(compte._id)));
    }
  } catch (_) {
    /* fiches membres indisponibles */
  }

  // L'ancien périmètre global `User.novaEspaceIds` n'est plus une source de
  // droits : seules les fiches d'appartenance aux workspaces sont consultées.

  return ids;
}

/** Toutes les fiches d'appartenance actives d'un compte. */
async function membresDuCompte(userId, email = null) {
  const Membre = getModel(APP, 'Membre');
  const filtre = {
    deletedAt: null,
    status: { $ne: 'deleted' },
    $or: [
      { utilisateurId: userId },
      ...(email ? [{ utilisateurId: { $exists: false }, email: String(email).toLowerCase() }] : []),
    ],
  };
  return Membre.find(filtre).select('workspaceId role permissions espaceIds').lean();
}

/** Union des espaces accessibles à un compte, tous workspaces confondus. */
function espacesDesMembres(membres) {
  const ids = new Set();
  membres.forEach((membre) => {
    (Array.isArray(membre.espaceIds) ? membre.espaceIds : []).forEach((id) => {
      const brut = typeof id === 'object' ? id._id || id : id;
      if (brut) ids.add(String(brut));
    });
  });
  return ids;
}

/** Contexte ACL synthétique pour une connexion Socket.IO. */
function contexteSocket(membres, workspaceId = null) {
  return {
    novaMembres: membres,
    getModel: (nom, schema) => getModel(APP, nom, schema),
    query: workspaceId ? { workspaceId } : {},
    headers: {},
    params: {},
    body: {},
  };
}

/**
 * Notifie (notification persistée + diffusion temps réel) tous les membres d'un
 * espace d'équipe, à l'exception de l'auteur de l'action.
 *
 * @returns {Promise<number>} nombre de notifications créées.
 */
async function notifierActiviteEquipe({
  req,
  espaceId,
  type = 'systeme',
  titre,
  message,
  pageId,
  exclureUserId,
}) {
  if (!espaceId || !titre) return 0;

  const Notification = req.getModel('Notification');
  const destinataires = await membresDeEspace(req, espaceId);
  if (exclureUserId) destinataires.delete(String(exclureUserId));
  if (!destinataires.size) return 0;

  let envoyees = 0;
  for (const destinataireId of destinataires) {
    try {
      const doc = await Notification.create({
        destinataireId,
        type,
        titre,
        message,
        pageId: pageId || undefined,
        createdBy: req.user?._id,
      });
      emettre(req, roomUtilisateur(destinataireId), 'notification:nouvelle', doc.toObject());
      envoyees += 1;
    } catch (e) {
      logger(`[Nova] Notification d'équipe non créée : ${e.message}`, 'warning');
    }
  }
  return envoyees;
}

/**
 * Identifiants des espaces dont un utilisateur est membre, tous workspaces
 * confondus. Un propriétaire/admin voit les espaces de ses propres workspaces
 * (aucune élévation globale).
 */
async function espacesDeUtilisateur(utilisateur) {
  const membres = await membresDuCompte(
    String(utilisateur._id || utilisateur.userId || ''),
    utilisateur.email
  );
  const ids = [...espacesDesMembres(membres)];
  const Espace = getModel(APP, 'Espace');
  const workspacesIds = membres.map((m) => String(m.workspaceId));
  if (workspacesIds.length) {
    const espaces = await Espace.find({ workspaceId: { $in: workspacesIds } })
      .select('_id')
      .lean();
    espaces.forEach((espace) => ids.push(String(espace._id)));
  }
  return [...new Set(ids)];
}

/**
 * Branche les rooms temps réel sur les connexions Socket.IO : chaque client
 * rejoint les rooms des espaces d'équipe dont il est membre (et peut demander à
 * en rejoindre un nouveau, vérifié côté serveur).
 */
function initTempsReelNova(io) {
  if (!io) return;

  io.on('connection', async (socket) => {
    const userId = String(socket.userId || '');
    if (!userId) return;
    let contexteEdition = null;
    let emailUtilisateur = null;

    // Rejoint la room personnelle de l'utilisateur pour recevoir ses notifications en direct.
    socket.join(roomUtilisateur(userId));

    try {
      const User = getModel(APP, 'User');
      const utilisateur = await User.findById(userId).select('nom email').lean();
      if (utilisateur) {
        emailUtilisateur = utilisateur.email || null;
        const ids = await espacesDeUtilisateur(utilisateur);
        ids.forEach((id) => socket.join(roomEquipe(id)));
      }
    } catch (e) {
      logger(`[Nova] Rooms temps réel indisponibles : ${e.message}`, 'warning');
    }

    // Rejoint un espace d'équipe créé pendant la session. L'espace doit
    // appartenir à un workspace auquel le compte appartient réellement.
    socket.on('equipe:rejoindre', async (espaceId) => {
      if (!espaceId) return;
      try {
        const Espace = getModel(APP, 'Espace');
        const espace = await Espace.findById(espaceId).select('workspaceId').lean();
        if (!espace) return;
        const membres = await membresDuCompte(userId, emailUtilisateur);
        const contexte = contexteSocket(membres, String(espace.workspaceId));
        const autorises = contexteDe(contexte);
        const ids = espacesDesMembres(membres);
        if (peutLireNova(contexte) && (autorises.permissions.admin || ids.has(String(espaceId)))) {
          socket.join(roomEquipe(String(espaceId)));
        }
      } catch (erreur) {
        logger(`[Nova] Refus rejoindre espace temps réel : ${erreur.message}`, 'warning');
      }
    });

    /* --- Édition collaborative : présence et synchronisation d'une page --- */

    /** Pages rejointes par cette connexion (nettoyage à la déconnexion). */
    const pagesRejointes = new Set();

    /** Diffuse la liste des participants d'une page à ses membres. */
    const diffuserPresence = (pageId) => {
      const liste = presencePages.get(String(pageId)) || new Map();
      io.to(roomPage(pageId)).emit('page:presence', {
        pageId: String(pageId),
        participants: Array.from(liste.values()),
      });
    };

    /** Retire la connexion d'une page et met à jour la présence. */
    const quitterPage = (pageId) => {
      const cle = String(pageId);
      const liste = presencePages.get(cle);
      if (liste) {
        liste.delete(socket.id);
        if (!liste.size) presencePages.delete(cle);
      }
      socket.leave(roomPage(cle));
      pagesRejointes.delete(cle);
      diffuserPresence(cle);
    };

    // Rejoint la room d'une page consultée, après vérification de l'accès.
    socket.on('page:rejoindre', async (payload) => {
      const pageId = String(payload?.pageId || payload || '');
      if (!pageId) return;
      try {
        const User = getModel(APP, 'User');
        const utilisateur = await User.findById(userId).select('nom email').lean();
        const membres = await membresDuCompte(userId, emailUtilisateur);
        const Page = getModel(APP, 'Page');
        const page = await Page.findById(pageId)
          .select('espaceId workspaceId createdBy section')
          .lean();
        if (!page) return;

        // Contexte ACL du workspace de la page : aucun droit n'est déduit du
        // rôle global ni d'un champ nova* stocké sur le compte.
        const contexte = contexteSocket(
          membres,
          page.workspaceId ? String(page.workspaceId) : null
        );
        if (!peutLireNova(contexte)) return;
        contexteEdition = contexte;

        if (page.section === 'prive' && String(page.createdBy) !== String(userId)) return;

        const acces = contexteDe(contexte);
        const idsEspace = espacesDesMembres(membres);
        if (!acces.permissions.admin && page.espaceId && !idsEspace.has(String(page.espaceId))) {
          return;
        }

        socket.join(roomPage(pageId));
        pagesRejointes.add(pageId);
        const liste = presencePages.get(pageId) || new Map();
        liste.set(socket.id, {
          socketId: socket.id,
          userId,
          nom: utilisateur?.nom || utilisateur?.email || 'Membre',
          couleur: COULEURS_PRESENCE[liste.size % COULEURS_PRESENCE.length],
        });
        presencePages.set(pageId, liste);
        diffuserPresence(pageId);
      } catch (e) {
        logger(`[Nova] Présence page indisponible : ${e.message}`, 'warning');
      }
    });

    socket.on('page:quitter', (payload) => {
      const pageId = String(payload?.pageId || payload || '');
      if (pageId) quitterPage(pageId);
    });

    // Relaie une modification de bloc aux autres éditeurs de la page.
    /** La diffusion collaborative est réservée aux comptes ayant le droit d'édition. */
    const peutDiffuserBloc = (pageId) =>
      Boolean(pageId && pagesRejointes.has(pageId) && peutEditerNova(contexteEdition));

    socket.on('bloc:diffuser', (payload) => {
      const pageId = String(payload?.pageId || '');
      if (!peutDiffuserBloc(pageId)) return;
      socket.to(roomPage(pageId)).emit('bloc:maj', payload);
    });

    socket.on('bloc:cree', (payload) => {
      const pageId = String(payload?.pageId || '');
      if (!peutDiffuserBloc(pageId)) return;
      socket.to(roomPage(pageId)).emit('bloc:cree', payload);
    });

    socket.on('bloc:supprime', (payload) => {
      const pageId = String(payload?.pageId || '');
      if (!peutDiffuserBloc(pageId)) return;
      socket.to(roomPage(pageId)).emit('bloc:supprime', payload);
    });

    socket.on('disconnect', () => {
      Array.from(pagesRejointes).forEach(quitterPage);
    });
  });
}

module.exports = {
  roomEquipe,
  roomUtilisateur,
  roomPage,
  emettre,
  membresDeEspace,
  notifierActiviteEquipe,
  initTempsReelNova,
};

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
const { idsEspacesAutorises } = require('./acl.service');

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
      const comptes = await User.find({ email: { $in: emails } }).select('_id').lean();
      comptes.forEach((compte) => ids.add(String(compte._id)));
    }
  } catch (_) {
    /* fiches membres indisponibles */
  }

  try {
    const User = req.getModel('User');
    const comptes = await User.find({ novaEspaceIds: espaceId }).select('_id').lean();
    comptes.forEach((compte) => ids.add(String(compte._id)));
  } catch (_) {
    /* périmètre utilisateurs indisponible */
  }

  return ids;
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

/** Identifiants des espaces dont un utilisateur est membre. */
async function espacesDeUtilisateur(utilisateur) {
  const autorises = idsEspacesAutorises(utilisateur);
  if (autorises !== null) return autorises;
  const Espace = getModel(APP, 'Espace');
  const espaces = await Espace.find({ status: { $ne: 'deleted' } }).select('_id').lean();
  return espaces.map((espace) => String(espace._id));
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

    // Rejoint la room personnelle de l'utilisateur pour recevoir ses notifications en direct.
    socket.join(roomUtilisateur(userId));

    try {
      const User = getModel(APP, 'User');
      const utilisateur = await User.findById(userId)
        .select('role novaPermissions novaEspaceIds')
        .lean();
      if (utilisateur) {
        const ids = await espacesDeUtilisateur(utilisateur);
        ids.forEach((id) => socket.join(roomEquipe(id)));
      }
    } catch (e) {
      logger(`[Nova] Rooms temps réel indisponibles : ${e.message}`, 'warning');
    }

    // Rejoint un espace d'équipe créé pendant la session.
    socket.on('equipe:rejoindre', async (espaceId) => {
      if (!espaceId) return;
      try {
        const User = getModel(APP, 'User');
        const utilisateur = await User.findById(userId)
          .select('role novaPermissions novaEspaceIds')
          .lean();
        const autorises = idsEspacesAutorises(utilisateur);
        if (autorises === null || autorises.includes(String(espaceId))) {
          socket.join(roomEquipe(String(espaceId)));
        }
      } catch (_) {
        /* le client ne rejoint simplement pas la room */
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
        const Page = getModel(APP, 'Page');
        const page = await Page.findById(pageId).select('espaceId').lean();
        if (!page) return;

        const User = getModel(APP, 'User');
        const utilisateur = await User.findById(userId)
          .select('nom email role novaPermissions novaEspaceIds')
          .lean();
        const autorises = idsEspacesAutorises(utilisateur);
        if (autorises !== null && page.espaceId && !autorises.includes(String(page.espaceId))) {
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
    socket.on('bloc:diffuser', (payload) => {
      const pageId = String(payload?.pageId || '');
      if (!pageId || !pagesRejointes.has(pageId)) return;
      socket.to(roomPage(pageId)).emit('bloc:maj', payload);
    });

    socket.on('bloc:cree', (payload) => {
      const pageId = String(payload?.pageId || '');
      if (!pageId || !pagesRejointes.has(pageId)) return;
      socket.to(roomPage(pageId)).emit('bloc:cree', payload);
    });

    socket.on('bloc:supprime', (payload) => {
      const pageId = String(payload?.pageId || '');
      if (!pageId || !pagesRejointes.has(pageId)) return;
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

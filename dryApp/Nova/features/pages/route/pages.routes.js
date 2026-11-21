const express = require('express');
const sendResponse = require('../../../../../dry/utils/http/response');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateNova } = require('../../../validation/middleware');
const {
  idsEspacesAutorises,
  forcerFiltre,
  estAdminNova,
  exigerEditionNova,
  verifierPayloadAcces,
  contexteDe,
  filtrerWorkspace,
} = require('../../../services/acl.service');
const {
  roomEquipe,
  emettre,
  notifierActiviteEquipe,
} = require('../../../services/tempsReel.service');
const PagesSchema = require('../model/pages.schema');
const BlocsSchema = require('../../blocs/model/blocs.schema');

/**
 * Les plugins DRY peuvent peupler `createdBy` (objet User) même sur une
 * requête `.lean()`. Une comparaison `String(doc.createdBy)` produirait alors
 * `[object Object]` et refuserait à tort le créateur d'une page privée.
 */
const idDe = (valeur) => {
  if (!valeur) return null;
  if (typeof valeur === 'object') return valeur._id || valeur.id || null;
  return valeur;
};

const memeUtilisateur = (a, b) => {
  const idA = idDe(a);
  const idB = idDe(b);
  return Boolean(idA && idB && String(idA) === String(idB));
};

/**
 * Restreint la liste :
 * - Le contenu privé n'est visible que par son propriétaire (y compris dans la corbeille).
 * - Pour un non-administrateur, les autres pages sont restreintes aux espaces autorisés.
 */
const filtrerListe = (req, res, next) => {
  const filtre = {
    // Le contenu privé n'appartient qu'à son propriétaire : personne d'autre ne
    // doit le voir (ni dans l'arbre, ni dans la corbeille).
    $nor: [{ section: 'prive', createdBy: { $ne: req.user._id } }],
  };
  const ids = idsEspacesAutorises(req);
  if (ids !== null) {
    filtre.$or = [{ espaceId: { $in: ids } }, { createdBy: req.user._id }];
  }
  forcerFiltre(req, filtre);
  filtrerWorkspace(req);
  next();
};

/**
 * Invariant confidentiel : une page `prive` n'est rattachée à AUCUN espace
 * d'équipe. Le rattachement est une décision explicite (déplacement via le
 * panneau de partage), qui change la section en `equipe`/`partage`.
 * Le workspace reste renseigné : il est le périmètre d'appartenance, pas un
 * espace d'équipe partagé avec les autres membres.
 */
const normaliserPayloadPrive = (req, res, next) => {
  const contexte = contexteDe(req);
  if (contexte?.workspaceId) req.body.workspaceId = contexte.workspaceId;
  if (req.body?.section === 'prive') {
    req.body.espaceId = null;
    req.body.parentId = req.body.parentId || null;
  }
  return next();
};

/**
 * Cohérence parent/enfant : une sous-page hérite du workspace et de l'espace de
 * son parent. Une sous-page de page privée reste privée et ne reçoit aucun
 * `espaceId`, même si le client envoie un `section`/`espaceId` différent.
 */
const cohererPageParent = async (req, res, next) => {
  const parentId = req.body?.parentId;
  if (!parentId) return next();
  const Page = req.getModel('Page', PagesSchema);
  const parent = await Page.findById(parentId)
    .select('espaceId workspaceId section createdBy')
    .lean();
  if (!parent) {
    return sendResponse(res, null, 'Page parent introuvable', false, undefined, 404);
  }
  if (parent.section === 'prive') {
    if (!memeUtilisateur(parent.createdBy, req.user?._id)) {
      return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
    }
    req.body.section = 'prive';
    req.body.espaceId = null;
  } else if (parent.espaceId) {
    req.body.espaceId = parent.espaceId;
    if (req.body.section === 'prive') {
      return sendResponse(
        res,
        null,
        'Une sous-page d’une page d’équipe ne peut pas être privée',
        false,
        undefined,
        400
      );
    }
    req.body.section = parent.section || 'equipe';
  }
  if (parent.workspaceId) req.body.workspaceId = parent.workspaceId;
  return next();
};

/**
 * Interdit l'accès (lecture, mise à jour, suppression) à une page hors du
 * périmètre autorisé. Laisse passer lorsque la page n'existe pas (le handler
 * renvoie le 404).
 */
const verifierAccesPage = async (req, res, next) => {
  const Model = req.getModel('Page', PagesSchema);
  const doc = await Model.findById(req.params.id)
    .select('espaceId workspaceId createdBy section')
    .lean();
  if (!doc) return next();

  const contexte = contexteDe(req);
  if (contexte.workspaceId && doc.workspaceId && String(doc.workspaceId) !== contexte.workspaceId) {
    return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
  }
  const ids = idsEspacesAutorises(req);
  const proprietaire = memeUtilisateur(doc.createdBy, req.user?._id);
  // Une page personnelle reste privée, y compris pour un administrateur NOVA.
  if ((doc.section || 'equipe') === 'prive' && !proprietaire) {
    return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
  }
  // Admin/propriétaire de workspace : accès aux espaces partagés uniquement.
  if (ids === null) return next();

  const espaceId = doc.espaceId ? String(doc.espaceId) : null;
  if ((espaceId && ids.includes(espaceId)) || proprietaire) return next();

  return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
};

/**
 * Collecte l'identifiant d'une page et de tous ses descendants.
 * Sert à propager la suppression/restauration aux sous-pages, comme Notion.
 *
 * La cascade est strictement confinée : même workspace, même espace d'équipe
 * (ou, pour une page privée, aucun espace et le même créateur). Une sous-page
 * rattachée ailleurs ne doit jamais être entraînée par une page autorisée.
 */
async function collecterIds(Model, racineId, racine = null) {
  const ids = [racineId];
  let niveau = [racineId];
  const filtreCascade = {};
  if (racine?.workspaceId) filtreCascade.workspaceId = racine.workspaceId;
  if (racine?.espaceId) filtreCascade.espaceId = racine.espaceId;
  else if (racine?.section === 'prive') {
    filtreCascade.espaceId = null;
    filtreCascade.createdBy = idDe(racine.createdBy) || racine.createdBy;
  }
  while (niveau.length) {
    // `includeDeleted` est indispensable pour retrouver les sous-pages déjà
    // archivées : le plugin masque par défaut les documents supprimés.
    const enfants = await Model.find({
      parentId: { $in: niveau },
      ...filtreCascade,
      includeDeleted: true,
    })
      .select('_id')
      .lean();
    niveau = enfants.map((enfant) => enfant._id);
    if (niveau.length) ids.push(...niveau);
  }
  return ids;
}

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Lecture et écriture réservées aux membres connectés ; l'accès est filtré par
// espace pour les non-administrateurs.
const crudRouter = buildCrudRouter('Page', PagesSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.pages.create,
    update: validateNova.pages.update,
  },
  middlewares: {
    list: [filtrerListe],
    get: [verifierAccesPage],
    create: [normaliserPayloadPrive, cohererPageParent, verifierPayloadAcces()],
    update: [
      exigerEditionNova,
      normaliserPayloadPrive,
      cohererPageParent,
      verifierPayloadAcces(),
      verifierAccesPage,
    ],
    delete: [exigerEditionNova, verifierAccesPage],
  },
  crudOptions: {
    populateFields: 'espaceId',
    transformInput: async ({ req, payload }) => {
      if (req.user?._id) {
        payload.createdBy = payload.createdBy || req.user._id;
        payload.updatedBy = req.user._id;
      }
      return payload;
    },
    // Toute création de page dans un espace d'équipe est notifiée aux membres.
    afterCreate: async ({ req, doc }) => {
      if (!doc?.espaceId) return;
      emettre(req, roomEquipe(doc.espaceId), 'page:nouveau', doc.toObject ? doc.toObject() : doc);
      await notifierActiviteEquipe({
        req,
        espaceId: doc.espaceId,
        type: 'systeme',
        titre: 'Nouvelle page dans votre équipe',
        message: doc.titre || 'Page',
        pageId: doc._id,
        exclureUserId: req.user?._id,
      });
    },
    // Un déplacement de page vers un autre espace est signalé aux deux équipes.
    afterUpdate: async ({ req, doc, previous }) => {
      const avant = previous?.espaceId ? String(previous.espaceId) : null;
      const apres = doc?.espaceId ? String(doc.espaceId) : null;
      if (apres) {
        emettre(req, roomEquipe(apres), 'page:maj', doc.toObject ? doc.toObject() : doc);
      }
      if (!apres || avant === apres) return;
      await notifierActiviteEquipe({
        req,
        espaceId: doc.espaceId,
        type: 'partage',
        titre: 'Une page a été partagée avec votre équipe',
        message: doc.titre || 'Page',
        pageId: doc._id,
        exclureUserId: req.user?._id,
      });
    },
  },
});

/**
 * Routeur NOVA des pages. La suppression est redéfinie « façon Notion » :
 * - `DELETE /:id` archive la page et ses sous-pages (soft delete → corbeille) ;
 * - `DELETE /:id?includeDeleted=true` purge définitivement (depuis la corbeille) ;
 * - `POST /:id/restaurer` rétablit la page et ses sous-pages.
 * Ces routes sont déclarées AVANT le CRUD générique pour le prendre de vitesse
 * sur `DELETE /:id`.
 */
const router = express.Router();

/**
 * Vérifie qu'une page est réellement exposée sur le Web. Factorisé entre la
 * fiche publique et ses blocs pour éviter deux interprétations divergentes.
 * Renvoie `null` après avoir envoyé une réponse d'erreur explicite.
 */
async function chargerPublicationPublique(req, res) {
  const Page = req.getModel('Page', PagesSchema);
  const page = await Page.findById(req.params.id).lean();
  if (!page) {
    sendResponse(res, null, 'Page introuvable', false, undefined, 404);
    return null;
  }

  const Publication = req.getModel('Publication');
  const publication = await Publication.findOne({
    pageId: req.params.id,
    portee: 'web',
    actif: true,
  }).lean();
  if (!publication) {
    sendResponse(res, null, 'Cette page n’est pas publiée sur le Web', false, undefined, 403);
    return null;
  }

  // Une publication peut être limitée à un domaine : l'hôte de la requête
  // doit alors correspondre exactement (port retiré).
  if (publication.domaine) {
    const domaineAttendu = String(publication.domaine).trim().toLowerCase().replace(/:\d+$/, '');
    const hote = String(req.headers.host || '')
      .toLowerCase()
      .replace(/:\d+$/, '');
    if (hote !== domaineAttendu) {
      sendResponse(res, null, 'Publication non autorisée sur ce domaine', false, undefined, 403);
      return null;
    }
  }

  // Les niveaux `edition`/`complet` n'autorisent pas une écriture anonyme :
  // ces endpoints restent strictement en lecture.
  const accesLecture = ['lecture', 'commentaire', 'edition', 'complet'].includes(publication.acces);
  if (!accesLecture) {
    sendResponse(res, null, 'Publication non autorisée', false, undefined, 403);
    return null;
  }
  return { page, publication };
}

/** Projecte une page sur les seuls champs utiles à un lecteur anonyme. */
function pagePublique(page) {
  return {
    _id: page._id,
    titre: page.titre,
    icone: page.icone,
    couverture: page.couverture,
    couvertureAjustement: page.couvertureAjustement,
    couverturePosition: page.couverturePosition,
    pleineLargeur: page.pleineLargeur,
    ordre: page.ordre,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

/** Lecture publique d'une page partagée sur le Web (aucune authentification). */
router.get('/:id/public', validateId, async (req, res, next) => {
  try {
    const contexte = await chargerPublicationPublique(req, res);
    if (!contexte) return;
    // Ne jamais renvoyer les invités, domaines ou identifiants internes.
    return sendResponse(
      res,
      {
        page: pagePublique(contexte.page),
        publication: { portee: contexte.publication.portee, acces: contexte.publication.acces },
      },
      'Page publiée',
      true
    );
  } catch (erreur) {
    return next(erreur);
  }
});

/** Blocs d'une page publique : le lecteur anonyme ne voit que le contenu. */
router.get('/:id/public/blocs', validateId, async (req, res, next) => {
  try {
    const contexte = await chargerPublicationPublique(req, res);
    if (!contexte) return;
    const Bloc = req.getModel('Bloc', BlocsSchema);
    const blocs = await Bloc.find({ pageId: req.params.id }).sort({ ordre: 1 }).lean();
    const publics = blocs.map((bloc) => ({
      _id: bloc._id,
      pageId: bloc.pageId,
      parentId: bloc.parentId,
      type: bloc.type,
      contenu: bloc.contenu,
      proprietes: bloc.proprietes,
      enfants: bloc.enfants,
      ordre: bloc.ordre,
      createdAt: bloc.createdAt,
      updatedAt: bloc.updatedAt,
    }));
    return sendResponse(res, publics, 'Blocs de la page publiée', true);
  } catch (erreur) {
    return next(erreur);
  }
});

/** La purge définitive est une opération administrative explicite. */
const exigerPurge = (req, res, next) => {
  if (req.query?.includeDeleted !== 'true') return next();
  if (!estAdminNova(req)) {
    return sendResponse(
      res,
      null,
      'Purge définitive réservée aux administrateurs',
      false,
      undefined,
      403
    );
  }
  return next();
};

router.delete(
  '/:id',
  validateId,
  protect,
  exigerEditionNova,
  exigerPurge,
  verifierAccesPage,
  async (req, res) => {
    const Model = req.getModel('Page', PagesSchema);

    // Espace de la page : sert à diffuser la suppression aux membres de l'équipe.
    const racine = await Model.findById(req.params.id)
      .select('espaceId workspaceId createdBy section')
      .lean();
    const espaceId = racine?.espaceId ? String(racine.espaceId) : null;
    const ids = await collecterIds(Model, req.params.id, racine);

    // Purge définitive depuis la corbeille : on efface réellement les documents.
    if (req.query?.includeDeleted === 'true') {
      const resultat = await Model.deleteMany({ _id: { $in: ids } });
      if (!resultat.deletedCount) {
        return sendResponse(res, null, 'Page introuvable', false, undefined, 404);
      }
      if (espaceId) emettre(req, roomEquipe(espaceId), 'page:supprime', { ids });
      return sendResponse(res, null, 'Page supprimée définitivement', true);
    }

    // Archivage : la page (et ses sous-pages) partent dans la corbeille.
    await Model.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'deleted', deletedAt: new Date(), updatedBy: req.user?._id } }
    );
    // Les autres clients de l'équipe retirent la page de leur arbre sans recharger.
    if (espaceId) emettre(req, roomEquipe(espaceId), 'page:supprime', { ids });
    return sendResponse(res, null, 'Page déplacée vers la corbeille', true);
  }
);

router.post(
  '/:id/restaurer',
  validateId,
  protect,
  exigerEditionNova,
  verifierAccesPage,
  async (req, res) => {
    const Model = req.getModel('Page', PagesSchema);
    const racine = await Model.findById(req.params.id)
      .select('espaceId workspaceId createdBy section')
      .lean();
    const espaceId = racine?.espaceId ? String(racine.espaceId) : null;
    const ids = await collecterIds(Model, req.params.id, racine);
    await Model.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'active', deletedAt: null, updatedBy: req.user?._id } }
    );
    // Les autres clients de l'équipe réaffichent la page restaurée.
    if (racine?.espaceId) emettre(req, roomEquipe(racine.espaceId), 'page:restaure', { ids });
    return sendResponse(res, { pageId: req.params.id }, 'Page restaurée', true);
  }
);

router.use(crudRouter);

/** Accès ciblé aux invariants privés pour les tests unitaires. */
router.__test = { normaliserPayloadPrive, cohererPageParent, verifierAccesPage, collecterIds };

module.exports = router;

const express = require('express');
const sendResponse = require('../../../../../dry/utils/http/response');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateNova } = require('../../../validation/middleware');
const { idsEspacesAutorises, forcerFiltre } = require('../../../services/acl.service');
const {
  roomEquipe,
  emettre,
  notifierActiviteEquipe,
} = require('../../../services/tempsReel.service');
const PagesSchema = require('../model/pages.schema');

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
  const ids = idsEspacesAutorises(req.user);
  if (ids !== null) {
    filtre.$or = [{ espaceId: { $in: ids } }, { createdBy: req.user._id }];
  }
  forcerFiltre(req, filtre);
  next();
};

/**
 * Interdit l'accès (lecture, mise à jour, suppression) à une page hors du
 * périmètre autorisé. Laisse passer lorsque la page n'existe pas (le handler
 * renvoie le 404).
 */
const verifierAccesPage = async (req, res, next) => {
  const Model = req.getModel('Page', PagesSchema);
  const doc = await Model.findById(req.params.id)
    .select('espaceId createdBy section')
    .lean();
  if (!doc) return next();

  const ids = idsEspacesAutorises(req.user);
  // Admin/propriétaire de workspace : accès total (bypass espace + section).
  if (ids === null) return next();

  const proprietaire = doc.createdBy && String(doc.createdBy) === String(req.user._id);
  // Membres : une page privée n'est accessible qu'à son propriétaire.
  if ((doc.section || 'equipe') === 'prive' && !proprietaire) {
    return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
  }

  const espaceId = doc.espaceId ? String(doc.espaceId) : null;
  if ((espaceId && ids.includes(espaceId)) || proprietaire) return next();

  return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
};

/**
 * Collecte l'identifiant d'une page et de tous ses descendants.
 * Sert à propager la suppression/restauration aux sous-pages, comme Notion.
 */
async function collecterIds(Model, racineId) {
  const ids = [racineId];
  let niveau = [racineId];
  while (niveau.length) {
    // `includeDeleted` est indispensable pour retrouver les sous-pages déjà
    // archivées : le plugin masque par défaut les documents supprimés.
    const enfants = await Model.find({ parentId: { $in: niveau }, includeDeleted: true })
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
    update: [verifierAccesPage],
    delete: [verifierAccesPage],
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
 * Lecture publique d'une page partagée sur le Web (aucune authentification).
 * La page n'est servie que si une publication active de portée `web` existe :
 * toute personne disposant du lien peut alors la consulter.
 */
router.get('/:id/public', validateId, async (req, res) => {
  const Page = req.getModel('Page', PagesSchema);
  const page = await Page.findById(req.params.id).lean();
  if (!page) return sendResponse(res, null, 'Page introuvable', false, undefined, 404);

  const Publication = req.getModel('Publication');
  const publication = await Publication.findOne({
    pageId: req.params.id,
    portee: 'web',
    actif: true,
  }).lean();
  if (!publication) {
    return sendResponse(res, null, 'Cette page n’est pas publiée sur le Web', false, undefined, 403);
  }

  return sendResponse(res, { page, publication }, 'Page publiée', true);
});

router.delete('/:id', validateId, protect, verifierAccesPage, async (req, res) => {
  const Model = req.getModel('Page', PagesSchema);
  const ids = await collecterIds(Model, req.params.id);

  // Espace de la page : sert à diffuser la suppression aux membres de l'équipe.
  const racine = await Model.findById(req.params.id).select('espaceId').lean();
  const espaceId = racine?.espaceId ? String(racine.espaceId) : null;

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
});

router.post('/:id/restaurer', validateId, protect, verifierAccesPage, async (req, res) => {
  const Model = req.getModel('Page', PagesSchema);
  const ids = await collecterIds(Model, req.params.id);
  const racine = await Model.findById(req.params.id).select('espaceId').lean();
  await Model.updateMany(
    { _id: { $in: ids } },
    { $set: { status: 'active', deletedAt: null, updatedBy: req.user?._id } }
  );
  // Les autres clients de l'équipe réaffichent la page restaurée.
  if (racine?.espaceId) emettre(req, roomEquipe(racine.espaceId), 'page:restaure', { ids });
  return sendResponse(res, { pageId: req.params.id }, 'Page restaurée', true);
});

router.use(crudRouter);

module.exports = router;

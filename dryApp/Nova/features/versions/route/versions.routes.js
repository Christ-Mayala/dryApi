const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const sendResponse = require('../../../../../dry/utils/http/response');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateNova } = require('../../../validation/middleware');
const VersionsSchema = require('../model/versions.schema');
const PagesSchema = require('../../pages/model/pages.schema');
const BlocsSchema = require('../../blocs/model/blocs.schema');

/** Ne conserve que les champs utiles d'un bloc dans un instantane. */
function extraireBloc(bloc, index) {
  return {
    type: bloc.type,
    contenu: bloc.contenu || '',
    proprietes: bloc.proprietes || {},
    ordre: typeof bloc.ordre === 'number' ? bloc.ordre : index,
    parentId: bloc.parentId || null,
    enfants: Array.isArray(bloc.enfants) ? bloc.enfants : [],
  };
}

const router = buildCrudRouter('Version', VersionsSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'admin' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.versions.create,
    update: validateNova.versions.update,
  },
  crudOptions: {
    populateFields: '',
    transformInput: async ({ req, payload }) => {
      if (req.user?._id) {
        payload.createdBy = payload.createdBy || req.user._id;
        payload.updatedBy = req.user._id;
      }
      return payload;
    },
  },
});

/**
 * POST /versions/:id/restaurer
 * Restaure une version : l'etat courant est d'abord archive (pour rester
 * reversible), puis la page et ses blocs sont remplaces par l'instantane.
 */
router.post('/:id/restaurer', validateId, protect, async (req, res) => {
  const Version = req.getModel('Version', VersionsSchema);
  const Page = req.getModel('Page', PagesSchema);
  const Bloc = req.getModel('Bloc', BlocsSchema);

  const version = await Version.findById(req.params.id).lean();
  if (!version) return sendResponse(res, null, 'Version introuvable', false, undefined, 404);

  const page = await Page.findById(version.pageId);
  if (!page) return sendResponse(res, null, 'Page introuvable', false, undefined, 404);

  const blocsActuels = await Bloc.find({ pageId: page._id }).sort('ordre').lean();
  await Version.create({
    pageId: page._id,
    titre: page.titre,
    icone: page.icone,
    couverture: page.couverture,
    publie: page.publie,
    blocs: blocsActuels.map(extraireBloc),
    auteurNom: 'Sauvegarde avant restauration',
    createdBy: req.user?._id,
    updatedBy: req.user?._id,
  });

  page.titre = version.titre ?? page.titre;
  page.icone = version.icone ?? page.icone;
  page.couverture = version.couverture ?? page.couverture;
  page.publie = Boolean(version.publie);
  await page.save();

  await Bloc.deleteMany({ pageId: page._id });
  const blocs = Array.isArray(version.blocs) ? version.blocs : [];
  for (let index = 0; index < blocs.length; index += 1) {
    await Bloc.create({
      pageId: page._id,
      ...extraireBloc(blocs[index], index),
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });
  }

  return sendResponse(res, { pageId: page._id }, 'Version restauree', true);
});

module.exports = router;

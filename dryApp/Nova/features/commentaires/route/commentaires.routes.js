const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const CommentairesSchema = require('../model/commentaires.schema');
const { roomEquipe, emettre, notifierActiviteEquipe } = require('../../../services/tempsReel.service');

/**
 * Espace d'équipe auquel appartient la page d'un commentaire (ou `null`).
 * Le commentaire ne porte pas d'`espaceId` : on relit la page.
 */
async function espaceDuCommentaire(req, doc) {
  try {
    const pageId = doc?.pageId;
    if (!pageId) return null;
    const Page = req.getModel('Page');
    const page = await Page.findById(pageId).select('espaceId').lean();
    return page?.espaceId || null;
  } catch (_) {
    return null;
  }
}

/**
 * Diffuse un événement de commentaire dans la room de l'espace de la page.
 */
async function diffuserCommentaire(req, doc, evenement) {
  const espaceId = await espaceDuCommentaire(req, doc);
  if (!espaceId) return;
  emettre(req, roomEquipe(espaceId), evenement, doc.toObject ? doc.toObject() : doc);
}

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Lecture publique ; ecriture reservee aux membres connectes.
module.exports = buildCrudRouter('Commentaire', CommentairesSchema, {
  auth: { create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.commentaires.create,
    update: validateNova.commentaires.update,
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
    afterCreate: async ({ req, doc }) => {
      const espaceId = await espaceDuCommentaire(req, doc);
      if (!espaceId) return;
      // Diffusion immédiate + notification d'activité aux autres membres.
      emettre(req, roomEquipe(espaceId), 'commentaire:nouveau', doc.toObject ? doc.toObject() : doc);
      await notifierActiviteEquipe({
        req,
        espaceId,
        type: 'commentaire',
        titre: 'Nouveau commentaire dans votre équipe',
        message: String(doc.contenu || '').slice(0, 200),
        pageId: doc.pageId,
        exclureUserId: req.user?._id,
      });
    },
    afterUpdate: async ({ req, doc }) => {
      await diffuserCommentaire(req, doc, 'commentaire:maj');
    },
  },
});

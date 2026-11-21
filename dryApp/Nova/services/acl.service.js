/**
 * Règles d'accès (ACL) centralisées de l'espace de travail NOVA.
 *
 * Source de vérité : l'appartenance de l'utilisateur à un espace de travail,
 * stockée dans la collection `Membre` (une fiche par workspace et par compte).
 * Il n'existe PLUS de rôle NOVA global : créer un workspace rend son auteur
 * `proprietaire` de CE workspace, avec tous les droits, et rien d'autre. Un
 * même compte peut être propriétaire ici et invité ailleurs. Les rôles et
 * permissions sont lus dans la fiche correspondant au workspace courant,
 * résolu depuis l'en-tête `X-Workspace-Id`, la query, les paramètres, le corps
 * ou le workspace unique de l'utilisateur. Sans appartenance résolue, tout est
 * fermé (rôle `invite`, aucun droit).
 *
 * Le rôle global DRY (`role: admin|superadmin`) n'est jamais lu ni modifié.
 * Les anciens champs `novaRole`/`novaPermissions`/`novaEspaceIds` du compte
 * sont ignorés par le runtime et conservés uniquement pour rollback.
 */

const sendResponse = require('../../../dry/utils/http/response');

const ROLES = Object.freeze(['proprietaire', 'admin', 'membre', 'invite']);
const ROLES_ADMIN = Object.freeze(['proprietaire', 'admin']);

const PERMISSIONS_PAR_ROLE = Object.freeze({
  proprietaire: { lecture: true, edition: true, commentaire: true, partage: true, admin: true },
  admin: { lecture: true, edition: true, commentaire: true, partage: true, admin: true },
  membre: { lecture: true, edition: true, commentaire: true, partage: false, admin: false },
  invite: { lecture: true, edition: false, commentaire: false, partage: false, admin: false },
});

const CLES_PERMISSIONS = Object.keys(PERMISSIONS_PAR_ROLE.invite);

const idBrut = (valeur) => {
  if (!valeur) return null;
  if (typeof valeur === 'object') return valeur._id || valeur.id || null;
  return valeur;
};

const SANS_ACCES = Object.freeze({
  workspaceId: null,
  role: 'invite',
  permissions: Object.freeze(Object.fromEntries(CLES_PERMISSIONS.map((c) => [c, false]))),
  espaceIds: Object.freeze([]),
  membershipId: null,
});

/**
 * Contexte d'autorisation d'une requête, résolu une seule fois. `protect`
 * charge `req.novaMembres` (toutes les fiches actives du compte) ; cette
 * fonction choisit celle du workspace courant. Fail-closed : sans fiche ou
 * sans workspace résolu avec plusieurs appartenances, aucun privilège.
 */
function contexteDe(req) {
  if (!req) return SANS_ACCES;
  if (req.novaContexte) return req.novaContexte;

  const membres = Array.isArray(req.novaMembres) ? req.novaMembres : [];
  if (membres.length === 0) {
    req.novaContexte = SANS_ACCES;
    return SANS_ACCES;
  }

  const sources = [
    req.headers && req.headers['x-workspace-id'],
    req.query && req.query.workspaceId,
    req.params && req.params.workspaceId,
    req.body && req.body.workspaceId,
    req.novaWorkspaceId,
  ];
  let workspaceId = null;
  for (const source of sources) {
    const brut = idBrut(source);
    if (brut) {
      workspaceId = String(brut);
      break;
    }
  }
  // Un compte qui n'a qu'un seul workspace n'a pas besoin d'envoyer l'en-tête.
  if (!workspaceId && membres.length === 1)
    workspaceId = String(idBrut(membres[0].workspaceId) || '');

  const membre = workspaceId
    ? membres.find((m) => String(idBrut(m.workspaceId) || '') === workspaceId)
    : null;
  if (!membre) {
    req.novaContexte = SANS_ACCES;
    return SANS_ACCES;
  }

  const role = ROLES.includes(membre.role) ? membre.role : 'invite';
  const permissions = { ...PERMISSIONS_PAR_ROLE[role] };
  const explicites = membre.permissions;
  if (explicites && typeof explicites === 'object') {
    for (const cle of CLES_PERMISSIONS) {
      if (explicites[cle] !== undefined) permissions[cle] = Boolean(explicites[cle]);
    }
  }
  if (permissions.admin) for (const cle of CLES_PERMISSIONS) permissions[cle] = true;
  if (!permissions.lecture) for (const cle of CLES_PERMISSIONS) permissions[cle] = false;

  const contexte = {
    workspaceId: String(idBrut(membre.workspaceId) || ''),
    role,
    permissions: Object.freeze(permissions),
    espaceIds: Object.freeze(
      (Array.isArray(membre.espaceIds) ? membre.espaceIds : [])
        .map(idBrut)
        .filter(Boolean)
        .map(String)
    ),
    membershipId: idBrut(membre._id) ? String(idBrut(membre._id)) : null,
  };
  req.novaContexte = contexte;
  return contexte;
}

/** Rôle dans le workspace courant ; aucun rôle global n'est consulté. */
const roleNova = (req) => contexteDe(req).role;

/** Vrai si l'utilisateur est propriétaire du workspace courant. */
const estProprietaireNova = (req) => roleNova(req) === 'proprietaire';

/** Vrai si l'utilisateur administre le workspace courant. */
const estAdminNova = (req) => ROLES_ADMIN.includes(roleNova(req));

/** Alias historique : administration du workspace courant. */
const peutAdministrerNova = (req) => estAdminNova(req);

/** Permissions effectives dans le workspace courant. */
const permissionsNova = (req) => ({ ...contexteDe(req).permissions });

const aLaPermission = (req, cle) => contexteDe(req).permissions[cle] === true;
const peutLireNova = (req) => aLaPermission(req, 'lecture');
const peutEditerNova = (req) => aLaPermission(req, 'edition');
const peutCommenterNova = (req) => aLaPermission(req, 'commentaire');
const peutPartagerNova = (req) => estAdminNova(req) || aLaPermission(req, 'partage');

/**
 * Identifiants des espaces du workspace courant.
 * - `null` : aucun filtrage (propriétaire/admin du workspace courant).
 * - Tableau (éventuellement vide) : accès limité à ces espaces.
 */
function idsEspacesAutorises(req) {
  if (estAdminNova(req)) return null;
  return [...contexteDe(req).espaceIds];
}

/**
 * Vrai si l'utilisateur peut accéder à un espace. Un espace appartenant à un
 * autre workspace est toujours refusé, même à un administrateur : l'en-tête
 * `X-Workspace-Id` ne peut pas élargir le périmètre d'appartenance.
 */
async function peutAccederEspace(req, espaceId) {
  if (!peutLireNova(req)) return false;
  if (!espaceId) return false;
  const id = String(idBrut(espaceId));
  const contexte = contexteDe(req);
  if (contexte.workspaceId && typeof req.getModel === 'function') {
    const espace = await req
      .getModel('Espace')
      .findById(id)
      .select('workspaceId')
      .lean()
      .catch(() => null);
    if (espace && idBrut(espace.workspaceId)) {
      if (String(idBrut(espace.workspaceId)) !== contexte.workspaceId) return false;
    }
  }
  if (estAdminNova(req)) return true;
  return contexte.espaceIds.includes(id);
}

/**
 * Fusionne un filtre ACL avec les filtres déjà présents sur `req.query` sans
 * écraser un `$or` existant (Express 5 expose `req.query` en lecture seule).
 */
function fusionnerFiltre(req, filtre) {
  const existants = { ...req.query };
  for (const cle of ['select', 'sort', 'page', 'limit', 'rows', 'fields', 'search', 'json']) {
    delete existants[cle];
  }
  const filtreFinal = Object.keys(existants).length === 0 ? filtre : { $and: [existants, filtre] };
  Object.defineProperty(req, 'query', {
    value: { ...req.query, ...filtreFinal },
    writable: true,
    configurable: true,
  });
}

/** Consommé par le queryBuilder : applique la même clé que `forcerFiltre`. */
function forcerFiltre(req, filtre) {
  fusionnerFiltre(req, filtre);
}

/**
 * Identifiants des espaces d'équipe du workspace courant. Même un
 * administrateur ne voit que les espaces de son propre workspace : l'ACL ne
 * doit jamais laisser un en-tête `X-Workspace-Id` élargir le périmètre.
 * Renvoie un tableau vide en l'absence de contexte (fail-closed).
 */
async function espaceIdsDuWorkspace(req) {
  const { workspaceId } = contexteDe(req);
  if (!workspaceId || typeof req.getModel !== 'function') return [];
  const espaces = await req
    .getModel('Espace')
    .find({ workspaceId })
    .select('_id')
    .lean()
    .catch(() => []);
  return espaces.map((espace) => String(idBrut(espace._id))).filter(Boolean);
}

/**
 * Restreint une liste aux espaces autorisés DU WORKSPACE COURANT. Les
 * ressources sans espace (personnelles) restent visibles à leur créateur
 * uniquement. Le résultat est toujours filtré : `null` ne signifie plus « tout
 * voir » puisque la portée est désormais celle du workspace.
 */
async function filtrerEspaces(req, champ = 'espaceId') {
  if (!peutLireNova(req)) {
    fusionnerFiltre(req, { _id: { $in: [] } });
    return;
  }
  const duWorkspace = await espaceIdsDuWorkspace(req);
  const autorises = idsEspacesAutorises(req);
  const ids = autorises === null ? duWorkspace : duWorkspace.filter((id) => autorises.includes(id));
  fusionnerFiltre(req, {
    $or: [
      { [champ]: { $in: ids } },
      { [champ]: { $exists: false }, createdBy: req.user?._id },
      { [champ]: null, createdBy: req.user?._id },
    ],
  });
}

/** Version middleware de `filtrerEspaces`, pour les routeurs CRUD. */
function filtrerEspacesMiddleware(champ = 'espaceId') {
  return async (req, res, next) => {
    try {
      await filtrerEspaces(req, champ);
      return next();
    } catch (erreur) {
      return next(erreur);
    }
  };
}

/**
 * Force le périmètre au workspace courant. Sans appartenance résolue, le
 * filtre ne renvoie aucun document (fail-closed).
 */
function filtrerWorkspace(req, champ = 'workspaceId') {
  const { workspaceId } = contexteDe(req);
  fusionnerFiltre(req, workspaceId ? { [champ]: workspaceId } : { _id: { $in: [] } });
}

function filtrerWorkspaceMiddleware(champ = 'workspaceId') {
  return (req, res, next) => {
    filtrerWorkspace(req, champ);
    return next();
  };
}

/** Middleware : lecture. */
function exigerLectureNova(req, res, next) {
  if (peutLireNova(req)) return next();
  return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
}

/** Middleware : édition. */
function exigerEditionNova(req, res, next) {
  if (peutEditerNova(req)) return next();
  return sendResponse(
    res,
    null,
    'Modification non autorisée pour votre rôle',
    false,
    undefined,
    403
  );
}

/** Middleware : commentaire. */
function exigerCommentaireNova(req, res, next) {
  if (peutCommenterNova(req)) return next();
  return sendResponse(res, null, 'Commentaire non autorisé pour votre rôle', false, undefined, 403);
}

/** Middleware : administration NOVA. */
function exigerAdministrationNova(req, res, next) {
  if (peutAdministrerNova(req)) return next();
  return sendResponse(res, null, 'Action réservée aux administrateurs', false, undefined, 403);
}

/** Middleware : partage/publication. */
function exigerPartageNova(req, res, next) {
  if (peutPartagerNova(req)) return next();
  return sendResponse(res, null, 'Partage non autorisé pour votre rôle', false, undefined, 403);
}

function memeUtilisateur(a, b) {
  const x = idBrut(a);
  const y = idBrut(b);
  return Boolean(x && y && String(x) === String(y));
}

/** Lit l'espace d'un document lié (page, base, bloc…) sans avaler les erreurs. */
async function lireLien(req, modelName, id, projection = 'espaceId pageId') {
  if (!id) return null;
  const Model = req.getModel(modelName);
  return Model.findById(id).select(projection).lean();
}

/**
 * Remonte l'espace propriétaire d'une ressource, quelle que soit la manière
 * dont elle y est rattachée : espaceId direct, pageId, blocId ou baseId.
 */
async function resoudreEspaceCible(source, req) {
  if (!source) return null;
  if (source.espaceId) return idBrut(source.espaceId);

  if (source.pageId) {
    const page = await lireLien(req, 'Page', source.pageId);
    return page?.espaceId ? idBrut(page.espaceId) : null;
  }

  if (source.blocId) {
    const bloc = await lireLien(req, 'Bloc', source.blocId);
    if (bloc?.pageId) {
      const page = await lireLien(req, 'Page', bloc.pageId);
      return page?.espaceId ? idBrut(page.espaceId) : null;
    }
    return bloc?.espaceId ? idBrut(bloc.espaceId) : null;
  }

  if (source.baseId) {
    const base = await lireLien(req, 'Base', source.baseId);
    if (base?.espaceId) return idBrut(base.espaceId);
    if (base?.pageId) {
      const page = await lireLien(req, 'Page', base.pageId);
      return page?.espaceId ? idBrut(page.espaceId) : null;
    }
  }

  return null;
}

/** Résolveur à passer à `exigerAccesRessource` quand la cible est une page. */
const resoudreEspaceDepuisPage = async (doc, req) =>
  resoudreEspaceCible({ pageId: doc?.pageId }, req);
const resoudreEspaceDepuisBloc = async (doc, req) =>
  resoudreEspaceCible({ blocId: doc?.blocId }, req);
const resoudreEspaceDepuisBase = async (doc, req) =>
  resoudreEspaceCible({ baseId: doc?.baseId }, req);

/** Les pages accessibles à l'utilisateur courant, pour filtrer les listes liées. */
async function pageIdsAccessibles(req) {
  const idsEspaces = idsEspacesAutorises(req);
  const duWorkspace = await espaceIdsDuWorkspace(req);
  const autorises =
    idsEspaces === null ? duWorkspace : duWorkspace.filter((id) => idsEspaces.includes(id));
  // Le contenu privé reste réservé à son créateur, y compris pour un admin du
  // workspace. Le filtre `workspaceId` empêche tout croisement entre workspaces.
  const filtre = {
    workspaceId: contexteDe(req).workspaceId || { $in: [] },
    $nor: [{ section: 'prive', createdBy: { $ne: req.user?._id } }],
  };
  if (autorises.length > 0 || req.user?._id) {
    filtre.$or = [{ espaceId: { $in: autorises } }, { createdBy: req.user._id }];
  }
  const pages = await req.getModel('Page').find(filtre).select('_id').lean();
  return pages.map((page) => idBrut(page._id)).filter(Boolean);
}

/** Filtre une liste de ressources rattachées à une page (blocs, commentaires…). */
function filtrerParPages({ champs = ['pageId'], inclureCreateur = true } = {}) {
  return async (req, res, next) => {
    try {
      if (!peutLireNova(req)) {
        return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
      }
      const ids = await pageIdsAccessibles(req);
      if (ids === null) return next();
      const conditions = champs.map((champ) => ({ [champ]: { $in: ids } }));
      if (inclureCreateur && req.user?._id) conditions.push({ createdBy: req.user._id });
      fusionnerFiltre(req, { $or: conditions });
      return next();
    } catch (erreur) {
      return next(erreur);
    }
  };
}

/** Filtre une liste de ressources rattachées à une base (éléments…). */
function filtrerParBases({ champ = 'baseId', inclureCreateur = true } = {}) {
  return async (req, res, next) => {
    try {
      if (!peutLireNova(req)) {
        return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
      }
      const idsEspaces = idsEspacesAutorises(req);
      const duWorkspace = await espaceIdsDuWorkspace(req);
      const autorises =
        idsEspaces === null ? duWorkspace : duWorkspace.filter((id) => idsEspaces.includes(id));
      const pagesIds = await pageIdsAccessibles(req);
      // Même logique que les pages : un admin ne contourne pas la règle des
      // sections privées, et un espace d'un autre workspace reste invisible.
      const filtreBases = {
        $nor: [{ section: 'prive', createdBy: { $ne: req.user._id } }],
      };
      const conditions = [{ espaceId: { $in: autorises } }, { createdBy: req.user._id }];
      if (pagesIds) conditions.push({ pageId: { $in: pagesIds } });
      filtreBases.$or = conditions;
      const bases = await req.getModel('Base').find(filtreBases).select('_id').lean();
      const baseIds = bases.map((base) => idBrut(base._id)).filter(Boolean);
      const filtre = inclureCreateur
        ? { $or: [{ [champ]: { $in: baseIds } }, { createdBy: req.user._id }] }
        : { [champ]: { $in: baseIds } };
      fusionnerFiltre(req, filtre);
      return next();
    } catch (erreur) {
      return next(erreur);
    }
  };
}

/** Filtre une liste de ressources appartenant à l'utilisateur courant. */
function filtrerParProprietaire(champ) {
  return (req, res, next) => {
    if (!peutLireNova(req)) {
      return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
    }
    fusionnerFiltre(req, { [champ]: req.user._id });
    return next();
  };
}

/** Vérifie que chaque référence d'espace fournie par le client est autorisée. */
function verifierPayloadAcces({
  champs = ['espaceId', 'pageId', 'blocId', 'baseId', 'parentId'],
  references = { parentId: 'Page' },
  droit = 'edition',
  exigerReference = false,
} = {}) {
  return async (req, res, next) => {
    try {
      const autorise = droit === 'commentaire' ? peutCommenterNova(req) : peutEditerNova(req);
      if (!autorise) {
        return sendResponse(
          res,
          null,
          'Action non autorisée pour votre rôle',
          false,
          undefined,
          403
        );
      }
      const cible = {};
      for (const champ of champs) {
        if (req.body?.[champ]) cible[champ] = req.body[champ];
      }
      // `parentId` est un identifiant de Page ou de Bloc : il faut le résoudre
      // selon le modèle de la route, sinon une page/bloc rattaché à un parent
      // inconnu échapperait au contrôle d'espace.
      for (const [champ, modelName] of Object.entries(references)) {
        if (!cible[champ]) continue;
        const parent = await lireLien(
          req,
          modelName,
          cible[champ],
          'espaceId pageId createdBy section'
        );
        if (
          !parent ||
          (parent.section === 'prive' && !memeUtilisateur(parent.createdBy, req.user._id))
        ) {
          return sendResponse(
            res,
            null,
            'Référence introuvable ou non autorisée',
            false,
            undefined,
            404
          );
        }
        if (parent.espaceId) cible.espaceId = idBrut(parent.espaceId);
      }
      if (Object.keys(cible).length === 0) {
        if (exigerReference) {
          return sendResponse(
            res,
            null,
            'Référence de page ou d’espace requise',
            false,
            undefined,
            400
          );
        }
        return next();
      }

      const espaceId = await resoudreEspaceCible(cible, req);
      if (espaceId && !(await peutAccederEspace(req, espaceId))) {
        return sendResponse(res, null, 'Espace non autorisé', false, undefined, 403);
      }
      // Une référence inconnue est refusée : elle ne doit pas permettre de
      // créer une ressource « orpheline » puis de la retrouver par ID.
      if (!espaceId && (cible.pageId || cible.blocId || cible.baseId || cible.parentId)) {
        return sendResponse(
          res,
          null,
          'Référence introuvable ou non autorisée',
          false,
          undefined,
          404
        );
      }
      return next();
    } catch (erreur) {
      return next(erreur);
    }
  };
}

/** Alias historique : contrôle d'un `espaceId` direct dans le payload. */
const verifierEspacePayload = (champ = 'espaceId', droit = 'edition') =>
  verifierPayloadAcces({ champs: [champ], droit });

/** Force l'identité du propriétaire : un client ne peut pas l'usurper. */
function forcerProprietaire(champ) {
  return (req, res, next) => {
    if (!req.user?._id) {
      return sendResponse(res, null, 'Authentification requise', false, undefined, 401);
    }
    if (req.body && req.body[champ] && !memeUtilisateur(req.body[champ], req.user._id)) {
      return sendResponse(res, null, 'Propriétaire non modifiable', false, undefined, 403);
    }
    req.body = { ...(req.body || {}), [champ]: req.user._id };
    return next();
  };
}

/**
 * Middleware générique de contrôle d'une ressource identifiée par `req.params.id`.
 * Sans résolveur explicite, l'espace est remonté automatiquement depuis
 * `espaceId`, `pageId`, `blocId` ou `baseId`. Les ressources personnelles
 * (notifications, favoris) utilisent `proprieteProprietaire` en mode strict.
 */
function exigerAccesRessource({
  modelName,
  schema,
  droit = 'lecture',
  resoudreEspaceId = null,
  proprieteProprietaire = null,
  autoriserAdminProprietaire = false,
  autoriserSansProprietaire = false,
} = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return sendResponse(res, null, 'Authentification requise', false, undefined, 401);
      }
      const autorise =
        droit === 'commentaire'
          ? peutCommenterNova(req)
          : droit === 'edition'
            ? peutEditerNova(req)
            : peutLireNova(req);
      if (!autorise) {
        return sendResponse(
          res,
          null,
          'Action non autorisée pour votre rôle',
          false,
          undefined,
          403
        );
      }

      const Model = req.getModel(modelName, schema);
      const doc = await Model.findById(req.params.id);
      if (!doc) {
        return sendResponse(res, null, `${modelName} introuvable`, false, undefined, 404);
      }

      // Un document portant un `workspaceId` n'est accessible que depuis ce
      // workspace, y compris pour un administrateur (aucune élévation globale).
      const workspaceCible = contexteDe(req).workspaceId;
      if (workspaceCible && doc.workspaceId && String(idBrut(doc.workspaceId)) !== workspaceCible) {
        return sendResponse(
          res,
          null,
          'Ressource appartenant à un autre espace de travail',
          false,
          undefined,
          403
        );
      }

      const estCreateur =
        memeUtilisateur(doc.createdBy, req.user._id) ||
        (proprieteProprietaire && memeUtilisateur(doc[proprieteProprietaire], req.user._id));
      if (proprieteProprietaire && !estCreateur) {
        const proprietaire = idBrut(doc[proprieteProprietaire]);
        if (!proprietaire && autoriserSansProprietaire) {
          // Notification globale : aucun destinataire personnel, lecture autorisée.
        } else if (!autoriserAdminProprietaire || !estAdminNova(req)) {
          return sendResponse(
            res,
            null,
            'Ressource appartenant à un autre utilisateur',
            false,
            undefined,
            403
          );
        }
      }
      // Le contenu d'une page privée reste réservé à son créateur, y compris
      // pour un administrateur NOVA. Ce contrôle s'applique à toutes les
      // ressources dotées d'une `section`, pas seulement aux bases.
      if (doc.section === 'prive' && !estCreateur) {
        return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
      }

      const espaceId = resoudreEspaceId
        ? await resoudreEspaceId(doc, req)
        : await resoudreEspaceCible(doc, req);
      if (espaceId && !(await peutAccederEspace(req, espaceId))) {
        return sendResponse(
          res,
          null,
          'Ressource appartenant à un autre espace',
          false,
          undefined,
          403
        );
      }
      // Une ressource sans espace résolu ne doit pas être accessible à n'importe
      // quel lecteur : seul son créateur (ou un admin NOVA explicite pour le
      // contenu historique) peut la manipuler par identifiant.
      if (!espaceId && !estCreateur && !estAdminNova(req)) {
        return sendResponse(
          res,
          null,
          'Ressource appartenant à un autre espace',
          false,
          undefined,
          403
        );
      }

      req.novaRessource = doc;
      req.novaEspaceId = espaceId || null;
      return next();
    } catch (erreur) {
      return next(erreur);
    }
  };
}

module.exports = {
  ROLES,
  PERMISSIONS_PAR_ROLE,
  roleNova,
  estProprietaireNova,
  estAdminNova,
  peutAdministrerNova,
  permissionsNova,
  peutLireNova,
  peutEditerNova,
  peutCommenterNova,
  peutPartagerNova,
  peutAccederEspace,
  idsEspacesAutorises,
  fusionnerFiltre,
  forcerFiltre,
  filtrerEspaces,
  filtrerEspacesMiddleware,
  filtrerWorkspace,
  filtrerWorkspaceMiddleware,
  contexteDe,
  exigerLectureNova,
  exigerEditionNova,
  exigerCommentaireNova,
  exigerAdministrationNova,
  exigerPartageNova,
  resoudreEspaceCible,
  resoudreEspaceDepuisPage,
  resoudreEspaceDepuisBloc,
  resoudreEspaceDepuisBase,
  pageIdsAccessibles,
  filtrerParPages,
  filtrerParBases,
  filtrerParProprietaire,
  verifierPayloadAcces,
  verifierEspacePayload,
  forcerProprietaire,
  exigerAccesRessource,
};

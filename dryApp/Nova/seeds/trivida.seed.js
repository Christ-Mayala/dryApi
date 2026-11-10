const path = require('path');

const WorkspacesSchema = require('../features/workspaces/model/workspaces.schema');
const EspacesSchema = require('../features/espaces/model/espaces.schema');
const PagesSchema = require('../features/pages/model/pages.schema');
const BlocsSchema = require('../features/blocs/model/blocs.schema');
const BasesSchema = require('../features/bases/model/bases.schema');
const ElementsSchema = require('../features/elements/model/elements.schema');

const {
  NOM_ESPACE,
  TITRE_MAITRE,
  COUVERTURES,
  BLOCS_MAITRE,
  DEPARTEMENTS,
  BASES,
} = require('./trivida.content');

const ORDRE_ANNEXE = 300;

/** Cree une entree si elle n'existe pas deja (cle naturelle). Idempotent. */
function fabriqueCreateur(journal, compteur) {
  return (feature, modelName) => {
    const ids = [];
    journal.push({
      feature,
      modelName,
      schemaPath: path.join(__dirname, '..', 'features', feature, 'model', `${feature}.schema.js`),
      ids,
    });
    return async (Model, cle, donnees = {}, options = {}) => {
      const existant = await Model.findOne({ ...cle, includeDeleted: true });
      if (existant) {
        if (options.synchroniser) {
          const aChanger = Object.keys(donnees).some(
            (champ) => JSON.stringify(existant[champ] ?? null) !== JSON.stringify(donnees[champ] ?? null)
          );
          if (aChanger) {
            await Model.updateOne({ _id: existant._id }, { $set: donnees });
            compteur.misAJour = (compteur.misAJour || 0) + 1;
          }
        }
        return existant;
      }
      const cree = await Model.create({ ...donnees, ...cle });
      compteur.count += 1;
      ids.push(cree._id);
      return cree;
    };
  };
}

/** Ajoute une couverture uniquement si la page n'en a pas encore. */
async function assurerCouverture(Page, page, url) {
  if (!url || page.couverture) return;
  await Page.updateOne({ _id: page._id }, { $set: { couverture: url } });
  page.couverture = url;
}

/**
 * Seed du dossier Trivida dans l'espace de travail de l'admin.
 *
 * - Idempotent et additif : ne supprime jamais rien.
 * - Ne cree jamais un second workspace : reutilise le premier de l'admin,
 *   ou en cree un seul si l'utilisateur n'en possede aucun.
 * - Cree l'espace Trivida, la page maitre, les 15 sous-pages departementales,
 *   les tableaux interactifs (vues tableau, kanban, calendrier) et leurs
 *   elements, avec des couvertures.
 *
 * @param {{ appName: string, getModel: Function, logSeed?: Function }} ctx
 */
module.exports = async function seedTrivida({ appName, getModel, logSeed }) {
  const User = getModel(appName, 'User');
  const Workspace = getModel(appName, 'Workspace', WorkspacesSchema);
  const Espace = getModel(appName, 'Espace', EspacesSchema);
  const Page = getModel(appName, 'Page', PagesSchema);
  const Bloc = getModel(appName, 'Bloc', BlocsSchema);
  const Base = getModel(appName, 'Base', BasesSchema);
  const Element = getModel(appName, 'Element', ElementsSchema);

  const compteur = { count: 0 };
  const journal = [];
  const createur = fabriqueCreateur(journal, compteur);
  const creerEspace = createur('espaces', 'Espace');
  const creerPage = createur('pages', 'Page');
  const creerBloc = createur('blocs', 'Bloc');
  const creerBase = createur('bases', 'Base');
  const creerElement = createur('elements', 'Element');

  const jour = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  /* 1. Proprietaire et espace de travail existant (jamais de doublon). */
  const emailCible = process.env.NOVA_ADMIN_EMAIL || 'admin@admin.com';
  let owner = await User.findOne({ email: emailCible }).select('_id').lean();
  if (!owner) owner = await User.findOne({ role: 'admin' }).select('_id').lean();
  if (!owner) owner = await User.findOne({}).select('_id').lean();
  if (!owner) {
    return { count: 0, skipped: true, raison: 'aucun utilisateur disponible' };
  }

  let workspace = await Workspace.findOne({ createdBy: owner._id }).select('_id').lean();
  if (!workspace) {
    workspace = await Workspace.create({
      nom: 'Mon Espace',
      icone: '🏠',
      createdBy: owner._id,
      updatedBy: owner._id,
    });
    compteur.count += 1;
  }

  const meta = { workspaceId: workspace._id, createdBy: owner._id, updatedBy: owner._id };

  /* 2. Espace d'equipe Trivida. */
  const espace = await creerEspace(
    Espace,
    { nom: NOM_ESPACE, workspaceId: workspace._id, createdBy: owner._id },
    {
      icone: '🚀',
      description: 'Centre de pilotage stratégique et opérationnel de Trivida.',
      visibilite: 'ouvert',
      ordre: 0,
      estPrive: false,
      updatedBy: owner._id,
    }
  );

  /* 3. Page maitre + contenu documentaire. */
  const pageMaitre = await creerPage(
    Page,
    { titre: TITRE_MAITRE, espaceId: espace._id },
    {
      icone: '🚀',
      workspaceId: workspace._id,
      section: 'equipe',
      favori: true,
      ordre: 0,
      derniereVisite: jour(0),
      updatedBy: owner._id,
    }
  );
  await assurerCouverture(Page, pageMaitre, COUVERTURES.maitre);

  for (let i = 0; i < BLOCS_MAITRE.length; i += 1) {
    const bloc = BLOCS_MAITRE[i];
    await creerBloc(
      Bloc,
      { pageId: pageMaitre._id, ordre: i },
      {
        type: bloc.type,
        contenu: bloc.contenu || '',
        proprietes: bloc.proprietes || {},
        createdBy: owner._id,
        updatedBy: owner._id,
      },
      { synchroniser: true }
    );
  }

  /* 4. Les 15 sous-pages departementales. */
  for (let d = 0; d < DEPARTEMENTS.length; d += 1) {
    const departement = DEPARTEMENTS[d];
    const page = await creerPage(
      Page,
      { titre: departement.titre, espaceId: espace._id },
      {
        icone: departement.icone,
        workspaceId: workspace._id,
        parentId: pageMaitre._id,
        section: 'equipe',
        ordre: d + 1,
        updatedBy: owner._id,
      }
    );

    const blocs = [
      { type: 'paragraphe', contenu: departement.description },
      { type: 'titre_3', contenu: 'Priorités et actions' },
      ...departement.actions.map((action) => ({
        type: 'a_faire',
        contenu: action,
        proprietes: { coche: false },
      })),
    ];

    for (let i = 0; i < blocs.length; i += 1) {
      const bloc = blocs[i];
      await creerBloc(
        Bloc,
        { pageId: page._id, ordre: i },
        {
          type: bloc.type,
          contenu: bloc.contenu || '',
          proprietes: bloc.proprietes || {},
          createdBy: owner._id,
          updatedBy: owner._id,
        },
        { synchroniser: true }
      );
    }
  }

  /* 5. Pages de tableaux interactifs + bases + elements. */
  const pagesBases = [];
  for (let b = 0; b < BASES.length; b += 1) {
    const definition = BASES[b];
    const page = await creerPage(
      Page,
      { titre: definition.titre, espaceId: espace._id },
      {
        icone: definition.icone,
        workspaceId: workspace._id,
        parentId: pageMaitre._id,
        section: 'equipe',
        favori: Boolean(definition.favori),
        ordre: 100 + b,
        updatedBy: owner._id,
      }
    );
    await assurerCouverture(Page, page, definition.couverture);

    const base = await creerBase(
      Base,
      { titre: definition.base, espaceId: espace._id },
      {
        icone: definition.icone,
        pageId: page._id,
        enLigne: true,
        proprietes: definition.proprietes,
        vues: definition.vues,
        createdBy: owner._id,
        updatedBy: owner._id,
      }
    );

    if (String(base.pageId || '') !== String(page._id)) {
      await Base.updateOne({ _id: base._id }, { $set: { pageId: page._id } });
      base.pageId = page._id;
    }

    const proprietesDate = new Set(
      definition.proprietes.filter((propriete) => propriete.type === 'date').map((propriete) => propriete.nom)
    );

    for (const element of definition.elements) {
      const valeurs = {};
      for (const [cle, valeur] of Object.entries(element.valeurs || {})) {
        valeurs[cle] =
          proprietesDate.has(cle) && typeof valeur === 'number' ? jour(valeur).toISOString() : valeur;
      }

      const premiereDate = Object.entries(valeurs).find(([cle]) => proprietesDate.has(cle));
      await creerElement(
        Element,
        { baseId: base._id, titre: element.titre },
        {
          pageId: page._id,
          valeurs,
          dateFin: premiereDate ? new Date(premiereDate[1]) : undefined,
          createdBy: owner._id,
          updatedBy: owner._id,
        }
      );
    }

    pagesBases.push(page);
  }

  /* 6. Annexes sur la page maitre : liens vers les tableaux interactifs. */
  await creerBloc(
    Bloc,
    { pageId: pageMaitre._id, ordre: ORDRE_ANNEXE },
    {
      type: 'titre_2',
      contenu: 'Annexes — tableaux interactifs et calendrier',
      createdBy: owner._id,
      updatedBy: owner._id,
    }
  );
  await creerBloc(
    Bloc,
    { pageId: pageMaitre._id, ordre: ORDRE_ANNEXE + 1 },
    {
      type: 'paragraphe',
      contenu:
        'Chaque tableau ci-dessous est une base interactive : vous pouvez basculer entre vue tableau, kanban et calendrier, filtrer, trier et ajouter des éléments.',
      createdBy: owner._id,
      updatedBy: owner._id,
    }
  );
  for (let i = 0; i < pagesBases.length; i += 1) {
    const page = pagesBases[i];
    await creerBloc(
      Bloc,
      { pageId: pageMaitre._id, ordre: ORDRE_ANNEXE + 2 + i },
      {
        type: 'lien_page',
        contenu: page.titre,
        proprietes: { pageId: String(page._id) },
        createdBy: owner._id,
        updatedBy: owner._id,
      }
    );
  }
  await creerBloc(
    Bloc,
    { pageId: pageMaitre._id, ordre: ORDRE_ANNEXE + 2 + pagesBases.length },
    {
      type: 'separateur',
      createdBy: owner._id,
      updatedBy: owner._id,
    }
  );
  await creerBloc(
    Bloc,
    { pageId: pageMaitre._id, ordre: ORDRE_ANNEXE + 3 + pagesBases.length },
    {
      type: 'titre_3',
      contenu: 'Comment utiliser ces tableaux',
      createdBy: owner._id,
      updatedBy: owner._id,
    }
  );
  await creerBloc(
    Bloc,
    { pageId: pageMaitre._id, ordre: ORDRE_ANNEXE + 4 + pagesBases.length },
    {
      type: 'liste_a_puces',
      contenu:
        'Ouvrir « Tableau de bord — Tâches » pour suivre le travail en cours (tableau, kanban, calendrier).\nOuvrir « Calendrier — Jalons 2026 » pour visualiser les échéances de l’année.\nAjouter ou modifier un élément directement dans la base : les vues se mettent à jour automatiquement.\nNe jamais inventer un montant ni marquer une tâche terminée sans vérification.',
      createdBy: owner._id,
      updatedBy: owner._id,
    }
  );

  /* 7. Journalisation des identifiants crees (reutilisable par seed-clean). */
  if (logSeed) {
    for (const entree of journal) {
      if (entree.ids.length) {
        await logSeed({
          appName,
          feature: entree.feature,
          modelName: entree.modelName,
          schemaPath: entree.schemaPath,
          ids: entree.ids,
        });
      }
    }
    const tousLesIds = journal.flatMap((entree) => entree.ids);
    if (tousLesIds.length) {
      await logSeed({
        appName,
        feature: 'nova-trivida',
        modelName: 'Seed',
        schemaPath: path.join(__dirname, 'trivida.seed.js'),
        ids: tousLesIds,
      });
    }
  }

  return {
    count: compteur.count,
    skipped: false,
    espaceId: String(espace._id),
    pageMaitreId: String(pageMaitre._id),
    bases: pagesBases.length,
  };
};

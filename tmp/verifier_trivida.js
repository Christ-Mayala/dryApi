require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/database');
const getModel = require('../dry/core/factories/modelFactory');

const EspacesSchema = require('../dryApp/Nova/features/espaces/model/espaces.schema');
const PagesSchema = require('../dryApp/Nova/features/pages/model/pages.schema');
const BlocsSchema = require('../dryApp/Nova/features/blocs/model/blocs.schema');
const BasesSchema = require('../dryApp/Nova/features/bases/model/bases.schema');
const ElementsSchema = require('../dryApp/Nova/features/elements/model/elements.schema');

(async () => {
  await mongoose.connect(config.MONGO_URI);
  mongoose.connection.useDb('NovaDB', { useCache: true });
  const Espace = getModel('Nova', 'Espace', EspacesSchema);
  const Page = getModel('Nova', 'Page', PagesSchema);
  const Bloc = getModel('Nova', 'Bloc', BlocsSchema);
  const Base = getModel('Nova', 'Base', BasesSchema);
  const Element = getModel('Nova', 'Element', ElementsSchema);

  const espace = await Espace.findOne({ nom: 'Trivida' }).select('_id').lean();
  const pages = await Page.find({ espaceId: espace._id }).select('titre couverture icone').lean();
  const bases = await Base.find({ espaceId: espace._id }).select('titre pageId vues proprietes').lean();
  const maitre = pages.find((p) => p.titre.startsWith('TRIVIDA'));
  const blocsMaitre = await Bloc.find({ pageId: maitre._id }).select('type ordre proprietes contenu').sort({ ordre: 1 }).lean();

  console.log('ESPACE:', String(espace._id));
  console.log('PAGES:', pages.length, '| avec couverture:', pages.filter((p) => p.couverture).length);
  console.log('BASES:', bases.length);
  for (const base of bases) {
    const total = await Element.countDocuments({ baseId: base._id });
    console.log(
      `  - ${base.titre} | ${total} element(s) | vues: ${base.vues.map((v) => v.type).join(', ')} | props: ${base.proprietes.length} | couv: ${Boolean(pages.find((p) => String(p._id) === String(base.pageId))?.couverture)}`
    );
  }
  const tableaux = blocsMaitre.filter((b) => b.type === 'tableau');
  console.log('BLOCS MAITRE:', blocsMaitre.length, '| tableaux:', tableaux.length);
  const exemple = tableaux[0];
  if (exemple) {
    console.log('EXEMPLE TABLEAU:', exemple.proprietes.tableau.colonnes.length, 'colonnes x', exemple.proprietes.tableau.lignes.length, 'lignes');
  }
  const liens = blocsMaitre.filter((b) => b.type === 'lien_page');
  console.log('LIENS ANNEXES:', liens.length);
  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERREUR:', e);
  process.exit(1);
});

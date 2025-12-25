const TradeCategorySchema = require('./features/categories/model/tradeCategory.schema');
const TradeSchema = require('./features/categories/model/trade.schema');
const ProfessionalSchema = require('./features/professionals/model/professional.schema');

module.exports = async ({ appName, getModel }) => {
  const TradeCategory = getModel(appName, 'TradeCategory', TradeCategorySchema);
  const Trade = getModel(appName, 'Trade', TradeSchema);
  const Professional = getModel(appName, 'Professional', ProfessionalSchema);

  const existing = await TradeCategory.countDocuments({});

  const payload = [
    { name: 'Bâtiment & Travaux', trades: ['Peintre', 'Carreleur', 'Plâtrier', 'Étancheur'] },
    { name: 'Artisanat & Création', trades: ['Menuiser aluminium', 'Menuiser bois', 'Soudeur', 'Serrurier', 'Forgeron'] },
    { name: 'Mode & Beauté', trades: ['Couturier / Couturière', 'Styliste', 'Coiffeur / Coiffeuse', 'Barbier', 'Maquilleur / Maquilleuse'] },
    { name: 'Numérique & Créatif', trades: ['Développeur web', 'Développeur mobile', 'Graphiste', 'Monteur vidéo', 'Photographe', 'Community manager'] },
    { name: 'Services & Business', trades: ['Livreur', 'Agent commercial', 'Secrétaire indépendant', 'Formateur', 'Consultant'] },
    { name: 'Maintenance & Technique', trades: ['Réparateur téléphone', 'Réparateur ordinateur', 'Installateur TV / décodeur', 'Technicien réseau'] },
  ];

  if (existing === 0) {
    for (let i = 0; i < payload.length; i++) {
      const c = payload[i];
      const createdCat = await TradeCategory.create({ name: c.name, order: i });
      for (let j = 0; j < c.trades.length; j++) {
        await Trade.create({ name: c.trades[j], category: createdCat._id, order: j });
      }
    }
  }

  const proCount = await Professional.countDocuments({});
  if (proCount > 0) return;

  const categories = await TradeCategory.find({}).select('_id name').lean();
  const trades = await Trade.find({}).select('_id name category').lean();

  const catByName = new Map(categories.map((c) => [c.name, c]));
  const tradeByName = new Map(trades.map((t) => [t.name, t]));

  const seedPros = [
    {
      name: 'Jean M.',
      telephone: '+242060000001',
      whatsapp: true,
      ville: 'Brazzaville',
      quartier: 'Poto-Poto',
      categoryName: 'Bâtiment & Travaux',
      tradeName: 'Carreleur',
      experienceRange: '2-5',
      description: 'Pose de carrelage, finitions propres et rapides.',
      daysAvailable: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'],
      hoursAvailable: '08h–18h',
      preferredContact: 'both',
      approvalStatus: 'approved',
    },
    {
      name: 'Amina K.',
      telephone: '+242060000002',
      whatsapp: true,
      ville: 'Pointe-Noire',
      quartier: 'Loandjili',
      categoryName: 'Mode & Beauté',
      tradeName: 'Coiffeur / Coiffeuse',
      experienceRange: '5+',
      description: 'Coiffure et barber shop, rendez-vous rapide.',
      daysAvailable: ['Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
      hoursAvailable: '09h–19h',
      preferredContact: 'whatsapp',
      approvalStatus: 'approved',
    },
    {
      name: 'Patrick T.',
      telephone: '+242060000003',
      whatsapp: false,
      ville: 'Brazzaville',
      quartier: 'Bacongo',
      categoryName: 'Artisanat & Création',
      tradeName: 'Soudeur',
      experienceRange: '2-5',
      description: 'Soudure métal, portails, supports et réparations.',
      daysAvailable: ['Lun', 'Mer', 'Ven', 'Sam'],
      hoursAvailable: '08h–17h',
      preferredContact: 'call',
      approvalStatus: 'approved',
    },
    {
      name: 'Sarah L.',
      telephone: '+242060000004',
      whatsapp: true,
      ville: 'Dolisie',
      quartier: 'Centre',
      categoryName: 'Numérique & Créatif',
      tradeName: 'Développeur web',
      experienceRange: '0-1',
      description: 'Sites vitrines et pages de présentation, mobile-first.',
      daysAvailable: ['Lun', 'Mar', 'Jeu'],
      hoursAvailable: '10h–18h',
      preferredContact: 'both',
      approvalStatus: 'pending',
    },
  ];

  for (const p of seedPros) {
    const cat = catByName.get(p.categoryName);
    const trade = tradeByName.get(p.tradeName);
    if (!cat || !trade) continue;

    const exists = await Professional.findOne({ telephone: p.telephone }).lean();
    if (exists) continue;

    await Professional.create({
      name: p.name,
      telephone: p.telephone,
      whatsapp: p.whatsapp,
      pays: 'République du Congo',
      ville: p.ville,
      quartier: p.quartier,
      categoryId: cat._id,
      tradeId: trade._id,
      experienceRange: p.experienceRange,
      description: p.description,
      daysAvailable: p.daysAvailable,
      hoursAvailable: p.hoursAvailable,
      preferredContact: p.preferredContact,
      approvalStatus: p.approvalStatus,
      profileImage: { url: '', public_id: '' },
      images: [],
    });
  }
};

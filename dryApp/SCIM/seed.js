const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;

  // ══════════════════════════════════════════════════════════════════
  //  SYSTEM SETTINGS
  // ══════════════════════════════════════════════════════════════════
  const settingsSchema = require('./features/admin/model/systemSettings.schema.js');
  const SystemSettings = getModel(appName, 'SystemSettings', settingsSchema);
  const settingsDocs = [
    { key: 'siteName', value: 'SCIM Immobilier' },
    { key: 'siteDescription', value: 'Société Civile Immobilière Milongo — Plateforme de gestion immobilière au Congo' },
    { key: 'maintenanceMode', value: false },
    { key: 'allowRegistration', value: true },
    { key: 'currency', value: 'XAF' },
    { key: 'language', value: 'fr' },
  ];

  const settingsIds = [];
  for (const doc of settingsDocs) {
    const updated = await SystemSettings.findOneAndUpdate({ key: doc.key }, doc, { upsert: true, new: true });
    settingsIds.push(updated._id);
    count++;
  }

  await logSeed({
    appName,
    feature: 'admin',
    modelName: 'SystemSettings',
    schemaPath: path.join(__dirname, 'features', 'admin', 'model', 'systemSettings.schema.js'),
    ids: settingsIds,
  });

  // ══════════════════════════════════════════════════════════════════
  //  UTILISATEURS (5)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n👤 Création des utilisateurs...');

  const User = getModel(appName, 'User');
  const userDocs = [
    {
      name: 'MILONGO Théodore',
      nom: 'Milongo',
      email: 'admin@scim.cg',
      telephone: '+242066123456',
      password: 'Admin@2026!',
      role: 'admin',
      status: 'active',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
      createdAt: new Date('2023-01-15T08:00:00'),
    },
    {
      name: 'Serge MBOUMBA',
      nom: 'Mboumba',
      email: 'serge.mboumba@gmail.com',
      telephone: '+242065111222',
      password: 'Client@2026!',
      role: 'user',
      status: 'active',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
      createdAt: new Date('2024-03-20T10:30:00'),
    },
    {
      name: 'Chantal OBIANGA',
      nom: 'Obiang',
      email: 'chantal.obianga@yahoo.fr',
      telephone: '+242064333444',
      password: 'Client@2026!',
      role: 'user',
      status: 'active',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
      createdAt: new Date('2024-06-10T14:00:00'),
    },
    {
      name: 'Alain OBAKIMA',
      nom: 'Obakima',
      email: 'alain.obakima@outlook.com',
      telephone: '+242062555666',
      password: 'Client@2026!',
      role: 'user',
      status: 'active',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80',
      createdAt: new Date('2023-09-01T09:00:00'),
    },
    {
      name: 'Danièle SITOU',
      nom: 'Sitou',
      email: 'daniele.sitou@gmail.com',
      telephone: '+242067777888',
      password: 'Client@2026!',
      role: 'user',
      status: 'active',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
      createdAt: new Date('2025-01-05T11:00:00'),
    },
  ];

  const userIds = [];
  for (const doc of userDocs) {
    const existing = await User.findOne({ email: doc.email });
    if (existing) {
      console.log(`   ✓ Utilisateur existant: ${doc.email}`);
      userIds.push(existing._id);
    } else {
      const created = await User.create(doc);
      console.log(`   ✓ Utilisateur créé: ${doc.name} (${doc.email})`);
      userIds.push(created._id);
      count++;
    }
  }

  await logSeed({
    appName,
    feature: 'users',
    modelName: 'User',
    schemaPath: path.join(__dirname, 'features', 'users', 'model', 'userPublic.schema.js'),
    ids: userIds,
  });

  // ══════════════════════════════════════════════════════════════════
  //  BIENS IMMOBILIERS (100 — 12 phares + 88 générés)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n🏠 Création des biens immobiliers...');

  const propertySchema = require('./features/property/model/property.schema.js');
  const Property = getModel(appName, 'Property', propertySchema);

  // ── Générateur de biens additionnels ──
  const QUARTIERS = [
    'Bacongo', 'Poto-Poto', 'Moungali', 'Ouenze', 'Talangaï',
    'Djiri', 'Mfilou', 'Madibou', 'Kintélé', 'Ngamakosso',
    'Makélékélé', 'Bandalungwa', 'Kimbanseke', 'Mounkounda', 'Lilango',
  ];

  const RUES = [
    'Avenue de la Paix', 'Rue du Commerce', 'Boulevard Marechal', 'Avenue Congo',
    'Rue des Arbres', 'Avenue Lumumba', 'Chemin du Port', 'Rue Saint-Michel',
    'Avenue Indépendance', 'Rue des Palmiers', "Boulevard de l'Europe",
    "Avenue de l'UMOA", 'Rue du Marché', 'Chemin de Fer', 'Avenue des Jacarandas',
  ];

  const MAISON_IMAGES = [
    'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80',
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80',
  ];

  const APPART_IMAGES = [
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
    'https://images.unsplash.com/photo-1560185007-5f0bb1866cab?w=800&q=80',
  ];

  const TERRAIN_IMAGES = [
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
    'https://images.unsplash.com/photo-1628624747186-a941c476b7ef?w=800&q=80',
    'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80',
  ];

  const VILLA_IMAGES = [
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80',
  ];

  const STUDIO_IMAGES = [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&q=80',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
  ];

  const COMMERCIAL_IMAGES = [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
    'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=800&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
  ];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randDate = (from, to) => new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime()));

  // --- Templates par catégorie ---

  const MAISONS = [];
  for (let i = 0; i < 32; i++) {
    const q = pick(QUARTIERS);
    const ch = randInt(3, 5);
    const sb = randInt(1, 3);
    const sf = randInt(150, 300);
    const prix = randInt(15, 80) * 1000000;
    const hasGarage = Math.random() > 0.3;
    const hasGardien = Math.random() > 0.4;
    const hasJardin = Math.random() > 0.3;
    const img = pick(MAISON_IMAGES);
    MAISONS.push({
      titre: `Maison ${pick(['spacieuse', 'moderne', 'contemporaine', 'renovée', 'avec jardin', 'familiale', 'lumineuse', ' élégante'])} — ${q}`,
      description: `Belle maison de ${sf} m² située dans le quartier de ${q}, à Brazzaville. Elle offre ${ch} chambres, ${sb} salle(s) de bain, un salon confortable et une cuisine équipée. ${hasJardin ? 'Jardin paysager privatif. ' : ''}${hasGarage ? 'Garage disponible. ' : ''}${hasGardien ? 'Gardien 24h/24. ' : ''}Quartier calme et résidentiel, proche des commerces et des transports.`,
      prix,
      ville: 'Brazzaville',
      adresse: `${pick(RUES)}, ${q}`,
      transactionType: Math.random() > 0.7 ? 'location' : 'vente',
      categorie: 'Maison',
      devise: 'XAF',
      status: Math.random() > 0.1 ? 'active' : 'inactive',
      images: [{ url: img, public_id: `seed-maison-${i + 12}` }, { url: pick(MAISON_IMAGES), public_id: `seed-maison-${i + 12}-b` }],
      nombre_chambres: ch,
      nombre_salles_bain: sb,
      nombre_salons: randInt(1, 3),
      superficie: sf,
      garage: hasGarage,
      gardien: hasGardien,
      jardin: hasJardin,
      vues: randInt(10, 600),
      utilisateur: pick([userIds[3], userIds[4]]),
      createdAt: randDate(new Date('2023-01-01'), new Date('2025-12-31')),
    });
  }

  const APPARTEMENTS = [];
  for (let i = 0; i < 23; i++) {
    const q = pick(QUARTIERS);
    const ch = randInt(1, 3);
    const sf = randInt(45, 140);
    const prix = randInt(5, 35) * 1000000;
    const img = pick(APPART_IMAGES);
    APPARTEMENTS.push({
      titre: `Appartement ${pick(['moderne', 'lumineux', 'renové', 'meublé', 'calme', 'avec balcon', 'centre-ville', 'cosy'])} — ${q}`,
      description: `Appartement de ${sf} m² au quartier ${q}, Brazzaville. ${ch} chambre(s), salon, cuisine ${pick(['équipée', 'fonctionnelle', 'ouverte'])}, ${randInt(1, 2)} salle(s) de bain. ${Math.random() > 0.5 ? 'Climatisé. ' : ''}${Math.random() > 0.5 ? 'Balcon. ' : ''}Immeuble sécurisé avec gardien. Proche des commodités.`,
      prix,
      ville: 'Brazzaville',
      adresse: `Immeuble ${pick(['Résidence', 'Résidence Le', 'Le', ''])}${pick(['Soleil', 'Paix', 'Concorde', 'Etoile', 'Savane', 'Flamme'])}, ${pick(RUES)}, ${q}`,
      transactionType: Math.random() > 0.6 ? 'location' : 'vente',
      categorie: 'Appartement',
      devise: 'XAF',
      status: Math.random() > 0.1 ? 'active' : 'inactive',
      images: [{ url: img, public_id: `seed-appart-${i + 3}` }, { url: pick(APPART_IMAGES), public_id: `seed-appart-${i + 3}-b` }],
      nombre_chambres: ch,
      nombre_salles_bain: randInt(1, 2),
      nombre_salons: 1,
      superficie: sf,
      balcon: Math.random() > 0.4,
      vues: randInt(20, 500),
      utilisateur: pick([userIds[3], userIds[4]]),
      createdAt: randDate(new Date('2023-01-01'), new Date('2025-12-31')),
    });
  }

  const TERRAINS = [];
  for (let i = 0; i < 13; i++) {
    const q = pick(QUARTIERS);
    const sf = randInt(200, 800);
    const prix = randInt(5, 25) * 1000000;
    const img = pick(TERRAIN_IMAGES);
    TERRAINS.push({
      titre: `Terrain ${pick(['constructible', 'règlementé', 'viabilisé', 'en bord de route', 'rectangulaire', 'stratégique', 'ensoleillé'])} — ${q}`,
      description: `Terrain de ${sf} m² situé à ${q}, Brazzaville. Terrain ${pick(['plat', 'régulier', 'en pente douce'])}, ${pick(['raccordé aux réseaux', 'à viabiliser', 'proche de la route asphaltée'])}. Idéal pour ${pick(['construction résidentielle', 'projet commercial', 'investissement foncier', 'ensemble immobilier'])}. Quartier en développement.`,
      prix,
      ville: 'Brazzaville',
      adresse: `${pick(RUES)}, ${q}`,
      transactionType: 'vente',
      categorie: 'Terrain',
      devise: 'XAF',
      status: 'active',
      images: [{ url: img, public_id: `seed-terrain-${i + 2}` }, { url: pick(TERRAIN_IMAGES), public_id: `seed-terrain-${i + 2}-b` }],
      superficie: sf,
      vues: randInt(10, 300),
      utilisateur: pick([userIds[3], userIds[4]]),
      createdAt: randDate(new Date('2023-01-01'), new Date('2025-12-31')),
    });
  }

  const VILLAS = [];
  for (let i = 0; i < 7; i++) {
    const q = pick(['Mfilou', 'Bacongo', 'Kintélé', 'Madibou', 'Ouenze', 'Talangaï', 'Djiri', 'Ngamakosso']);
    const ch = randInt(4, 6);
    const sf = randInt(250, 450);
    const prix = randInt(60, 150) * 1000000;
    const img = pick(VILLA_IMAGES);
    VILLAS.push({
      titre: `Villa ${pick(['de luxe', 'de prestige', 'avec piscine', 'contemporaine', 'coloniale', 'avec terrain', 'haut standing'])} — ${q}`,
      description: `Magnifique villa de ${sf} m² dans le quartier résidentiel de ${q}. ${ch} chambres en suite, double salon, cuisine française équipée, ${randInt(3, 5)} salles de bain. ${Math.random() > 0.3 ? 'Piscine privée, ' : ''}jardin tropical, garage double, ${pick(['tennis', 'salle de sport', 'salle de cinéma'])} et conciergerie. Sécurité maximale avec enceinte et vidéosurveillance. Proche des écoles internationales et du Golf.`,
      prix,
      ville: 'Brazzaville',
      adresse: `Domaine ${pick(['des Palmiers', 'du Golf', 'Royal', 'des Fleurs', 'Panorama'])}, ${q}`,
      transactionType: Math.random() > 0.8 ? 'location' : 'vente',
      categorie: 'Autre',
      devise: 'XAF',
      status: 'active',
      isBonPlan: Math.random() > 0.7,
      bonPlanLabel: Math.random() > 0.5 ? "Villa d'exception" : 'Offre spéciale',
      images: [{ url: img, public_id: `seed-villa-${i + 1}` }, { url: pick(VILLA_IMAGES), public_id: `seed-villa-${i + 1}-b` }],
      nombre_chambres: ch,
      nombre_salles_bain: randInt(3, 5),
      nombre_salons: 2,
      superficie: sf,
      garage: true,
      gardien: true,
      jardin: true,
      piscine: Math.random() > 0.3,
      vues: randInt(100, 1200),
      utilisateur: pick([userIds[3], userIds[4]]),
      createdAt: randDate(new Date('2023-01-01'), new Date('2025-12-31')),
    });
  }

  const STUDIOS = [];
  for (let i = 0; i < 7; i++) {
    const q = pick(QUARTIERS);
    const sf = randInt(25, 55);
    const prix = randInt(3, 9) * 1000000;
    const img = pick(STUDIO_IMAGES);
    STUDIOS.push({
      titre: `Studio ${pick(['meublé', 'moderne', 'économique', 'lumineux', 'cosy', 'équipé', 'tout confort', 'idéal étudiant'])} — ${q}`,
      description: `Studio de ${sf} m² au quartier ${q}, Brazzaville. Espace optimisé avec coin nuit, salon, kitchenette intégrée et salle de bain. ${Math.random() > 0.4 ? 'Climatisé. ' : ''}${Math.random() > 0.5 ? 'Internet inclus. ' : ''}Immeuble sécurisé, proche du centre-ville et des transports. Parfait pour ${pick(['un étudiant', 'un jeune professionnel', 'un expatrié', 'un investisseur locatif'])}.`,
      prix,
      ville: 'Brazzaville',
      adresse: `Résidence ${pick(['Les Oliviers', 'du Commerce', 'du Marché', 'de la Paix', 'Les Fleurs'])}, ${pick(RUES)}, ${q}`,
      transactionType: Math.random() > 0.5 ? 'location' : 'vente',
      categorie: 'Autre',
      devise: 'XAF',
      status: 'active',
      images: [{ url: img, public_id: `seed-studio-${i + 1}` }, { url: pick(STUDIO_IMAGES), public_id: `seed-studio-${i + 1}-b` }],
      nombre_chambres: 1,
      nombre_salles_bain: 1,
      nombre_salons: 1,
      superficie: sf,
      vues: randInt(15, 400),
      utilisateur: pick([userIds[3], userIds[4]]),
      createdAt: randDate(new Date('2023-01-01'), new Date('2025-12-31')),
    });
  }

  const LOCAUX = [];
  for (let i = 0; i < 6; i++) {
    const q = pick(QUARTIERS);
    const sf = randInt(40, 160);
    const prix = randInt(10, 45) * 1000000;
    const img = pick(COMMERCIAL_IMAGES);
    LOCAUX.push({
      titre: `Local commercial ${pick(['avec vitrine', 'en rez-de-chaussée', 'au carrefour', 'près du marché', 'de standing', 'polyvalent', 'stratégique'])} — ${q}`,
      description: `Local commercial de ${sf} m² situé à ${q}, quartier très fréquenté de Brazzaville. ${pick(['Grande vitrine', 'Façade vitrée', 'Emplacement visible'])} offrant une excellente visibilité. ${pick(['Espace de vente principal', 'Open space', "Zone d'accueil"])}, ${pick(['arrière-bureau', 'cuisine professionnelle', 'entrepôt'])} et sanitaires. ${Math.random() > 0.5 ? 'Électricité triphasée disponible. ' : ''}Parfait pour ${pick(['commerce', 'restaurant', 'pharmie', 'agence', 'showroom', 'atelier'])}.`,
      prix,
      ville: 'Brazzaville',
      adresse: `Angle ${pick(RUES)} et ${pick(RUES)}, ${q}`,
      transactionType: Math.random() > 0.6 ? 'location' : 'vente',
      categorie: 'Commercial',
      devise: 'XAF',
      status: 'active',
      images: [{ url: img, public_id: `seed-commercial-${i + 1}` }, { url: pick(COMMERCIAL_IMAGES), public_id: `seed-commercial-${i + 1}-b` }],
      superficie: sf,
      vues: randInt(30, 350),
      utilisateur: pick([userIds[3], userIds[4]]),
      createdAt: randDate(new Date('2023-01-01'), new Date('2025-12-31')),
    });
  }

  const generatedDocs = [...MAISONS, ...APPARTEMENTS, ...TERRAINS, ...VILLAS, ...STUDIOS, ...LOCAUX];
  console.log(`   📦 ${generatedDocs.length} biens générés automatiquement`);

  // ── 12 biens phares (manually crafted) ──
  const propertyDocs = [
    // ── 0. MAISON — Bacongo ──
    {
      titre: 'Magnifique maison familiale à Bacongo',
      description: 'Spacieuse maison familiale située dans le quartier résidentiel de Bacongo, l\'un des plus beaux quartiers de Brazzaville. Cette maison de 220 m² offre 4 chambres spacieuses, un salon confortable, une cuisine moderne équipée et 2 salles de bain. La propriété dispose d\'un jardin paysager de 150 m² avec un portail automatique, d\'un garage pour deux véhicules, et d\'un système de sécurité 24h/24. Proche des écoles internationales, des centres commerciaux et des ambassades. Idéale pour une famille nombreuse recherchant confort et tranquillité.',
      prix: 45000000,
      ville: 'Brazzaville',
      adresse: 'Avenue Ngolo, Quartier Bacongo',
      transactionType: 'vente',
      categorie: 'Maison',
      devise: 'XAF',
      status: 'active',
      isBonPlan: true,
      bonPlanLabel: 'À vendre rapidement',
      bonPlanExpiresAt: new Date('2026-09-30'),
      images: [
        { url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80', public_id: 'seed-maison-bacongo-1' },
        { url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', public_id: 'seed-maison-bacongo-2' },
        { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', public_id: 'seed-maison-bacongo-3' },
      ],
      nombre_chambres: 4,
      nombre_salles_bain: 2,
      nombre_salons: 2,
      superficie: 220,
      garage: true,
      gardien: true,
      jardin: true,
      vues: 342,
      utilisateur: userIds[3],
      createdAt: new Date('2024-03-15T10:00:00'),
    },

    // ── 1. MAISON — Moungali ──
    {
      titre: 'Maison contemporaine au cœur de Moungali',
      description: 'Belle maison contemporaine de 180 m² implantée dans un quartier calme de Moungali. Elle comprend 3 chambres confortables, un salon lumineux avec baies vitrées, une cuisine ouverte sur le jardin et une buanderie indépendante. Le jardin de 100 m² est entretenu avec soin, idéal pour les enfants. Un gardien assure la sécurité du terrain clôturé. À proximité des marchés, pharmacies et transports en commun. Parfaite pour un couple ou une petite famille.',
      prix: 28000000,
      ville: 'Brazzaville',
      adresse: 'Rue Mabiala, Quartier Moungali',
      transactionType: 'vente',
      categorie: 'Maison',
      devise: 'XAF',
      status: 'active',
      images: [
        { url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', public_id: 'seed-maison-moungali-1' },
        { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', public_id: 'seed-maison-moungali-2' },
      ],
      nombre_chambres: 3,
      nombre_salles_bain: 1,
      nombre_salons: 1,
      superficie: 180,
      garage: true,
      gardien: true,
      jardin: true,
      vues: 218,
      utilisateur: userIds[3],
      createdAt: new Date('2024-06-10T14:00:00'),
    },

    // ── 2. MAISON — Ouenze ──
    {
      titre: 'Maison neuve avec grand jardin à Ouenze',
      description: 'Maison récemment construite dans le quartier en pleine expansion d\'Ouenze, à seulement 10 minutes du centre-ville. Construction de qualité avec 4 chambres, 2 salles de bain, un vaste salon et une cuisine moderne. Le terrain de 400 m² offre un jardin spacieux, un garage double et un espace de détente en plein air. Eau et électricité disponibles en permanence. Quartier en forte croissance, excellent investissement. Proche de la route nationale et des nouvelles infrastructures urbaines.',
      prix: 35000000,
      ville: 'Brazzaville',
      adresse: 'Avenue du Progrès, Quartier Ouenze',
      transactionType: 'vente',
      categorie: 'Maison',
      devise: 'XAF',
      status: 'active',
      images: [
        { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', public_id: 'seed-maison-ouenze-1' },
        { url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80', public_id: 'seed-maison-ouenze-2' },
      ],
      nombre_chambres: 4,
      nombre_salles_bain: 2,
      nombre_salons: 1,
      superficie: 250,
      garage: true,
      gardien: true,
      jardin: true,
      vues: 156,
      utilisateur: userIds[4],
      createdAt: new Date('2024-09-01T09:00:00'),
    },

    // ── 3. MAISON — Talangaï ──
    {
      titre: 'Maison avec vue panoramique à Talangaï',
      description: 'Belle maison perchée dans le quartier de Talangaï offrant une vue imprenable sur la ville de Brazzaville. Cette propriété de 190 m² comprend 3 chambres, un salon avec vue panoramique, une cuisine bien aménagée et 2 salles de bain. Le jardin en terrasses surplombe la ville, offrant des couchers de soleil spectaculaires. Un garage sécurisé et une aire de jeux pour les enfants complètent cette propriété unique. Malgré l\'altitude, la route d\'accès est asphaltée et praticable en toute saison.',
      prix: 52000000,
      ville: 'Brazzaville',
      adresse: 'Chemin des Collines, Quartier Talangaï',
      transactionType: 'vente',
      categorie: 'Maison',
      devise: 'XAF',
      status: 'active',
      isBonPlan: true,
      bonPlanLabel: 'Vue exceptionnelle',
      bonPlanExpiresAt: new Date('2026-08-15'),
      images: [
        { url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', public_id: 'seed-maison-talangai-1' },
        { url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80', public_id: 'seed-maison-talangai-2' },
        { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', public_id: 'seed-maison-talangai-3' },
      ],
      nombre_chambres: 3,
      nombre_salles_bain: 2,
      nombre_salons: 1,
      superficie: 190,
      garage: true,
      gardien: true,
      jardin: true,
      vues: 487,
      utilisateur: userIds[3],
      createdAt: new Date('2023-11-20T08:00:00'),
    },

    // ── 4. APPARTEMENT — Centre-ville (Poto-Poto) ──
    {
      titre: 'Appartement moderne en centre-ville — Poto-Poto',
      description: 'Superbe appartement de 85 m² situé au 3ᵉ étage d\'un immeuble moderne en plein cœur de Poto-Poto, le quartier administratif de Brazzaville. L\'appartement comprend 2 chambres climatisées, un salon spacieux, une cuisine équipée et une salle de bain en marbre. Balcon offrant une vue sur l\'avenue principale, ascenseur, parking souterrain. À deux pas de la Place de la République, des ambassades et des meilleurs restaurants de la ville. Idéal pour un professionnel seul ou en couple recherchant un cadre de vie élégant.',
      prix: 18000000,
      ville: 'Brazzaville',
      adresse: 'Immeuble Lumumba, Avenue du Peuple, Poto-Poto',
      transactionType: 'vente',
      categorie: 'Appartement',
      devise: 'XAF',
      status: 'active',
      images: [
        { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80', public_id: 'seed-appart-potopoto-1' },
        { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80', public_id: 'seed-appart-potopoto-2' },
        { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80', public_id: 'seed-appart-potopoto-3' },
      ],
      nombre_chambres: 2,
      nombre_salles_bain: 1,
      nombre_salons: 1,
      superficie: 85,
      balcon: true,
      vues: 523,
      utilisateur: userIds[4],
      createdAt: new Date('2024-01-05T11:00:00'),
    },

    // ── 5. APPARTEMENT — Bacongo ──
    {
      titre: 'Appartement lumineux avec balcon — Bacongo',
      description: 'Charmant appartement de 75 m² situé dans un immeuble bien entretenu du quartier Bacongo. Disposant de 2 chambres, d\'un salon baigné de lumière naturelle, d\'une cuisine fonctionnelle et d\'une salle de bain rénovée. Le balcon de 10 m² donne sur une allée bordée d\'arbres, parfait pour les petits-déjeuners. L\'immeuble dispose d\'un gardien 24h/7j, d\'un ascenseur et d\'un local à vélos. Proche du Marché Central, des banques et des écoles. Excellent rapport qualité-prix.',
      prix: 12000000,
      ville: 'Brazzaville',
      adresse: 'Immeuble Nganda, Rue Kanda, Bacongo',
      transactionType: 'vente',
      categorie: 'Appartement',
      devise: 'XAF',
      status: 'active',
      images: [
        { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80', public_id: 'seed-appart-bacongo-1' },
        { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80', public_id: 'seed-appart-bacongo-2' },
      ],
      nombre_chambres: 2,
      nombre_salles_bain: 1,
      nombre_salons: 1,
      superficie: 75,
      balcon: true,
      vues: 289,
      utilisateur: userIds[3],
      createdAt: new Date('2024-04-22T15:00:00'),
    },

    // ── 6. APPARTEMENT — Poto-Poto (3 pièces) ──
    {
      titre: 'Studio 3 pièces meublé en centre-ville',
      description: 'Appartement 3 pièces entièrement meublé et climatisé, idéal pour un investisseur en location ou un expatrié. Comprend 1 chambre parentale, un salon-salle à manger, une kitchenette équipée (réfrigérateur, micro-ondes, plaques) et une salle de bain moderne. Meubles de qualité, connexion internet fibre disponible, eau et électricité stables. L\'immeuble est situé dans un quartier sûr avec accès facile aux transports collectifs. Loyer mensuel estimé à 350 000 XAF, rendement attractif pour un investisseur.',
      prix: 8000000,
      ville: 'Brazzaville',
      adresse: 'Résidence Paix, Avenue Indéniel, Poto-Poto',
      transactionType: 'vente',
      categorie: 'Appartement',
      devise: 'XAF',
      status: 'active',
      images: [
        { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80', public_id: 'seed-appart-centre-1' },
        { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80', public_id: 'seed-appart-centre-2' },
      ],
      nombre_chambres: 1,
      nombre_salles_bain: 1,
      nombre_salons: 1,
      superficie: 60,
      vues: 412,
      utilisateur: userIds[4],
      createdAt: new Date('2024-07-15T10:00:00'),
    },

    // ── 7. TERRAIN — Madibou ──
    {
      titre: 'Grand terrain constructible à Madibou',
      description: 'Vaste terrain de 650 m² idéalement situé dans le quartier résidentiel de Madibou, en pleine expansion. Terrain plat et rectangulaire, parfait pour la construction d\'une villa ou d\'un ensemble immobilier. Raccordé aux réseaux (eau, électricité, téléphone), accès par route asphaltée. Le quartier est calme, sécurisé et en plein développement avec de nombreuses constructions récentes. Excellent investissement foncier, la valeur du terrain augmente de 15 à 20 % par an dans cette zone.',
      prix: 15000000,
      ville: 'Brazzaville',
      adresse: 'Route du Lac, Quartier Madibou',
      transactionType: 'vente',
      categorie: 'Terrain',
      devise: 'XAF',
      status: 'active',
      images: [
        { url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80', public_id: 'seed-terrain-madibou-1' },
        { url: 'https://images.unsplash.com/photo-1628624747186-a941c476b7ef?w=800&q=80', public_id: 'seed-terrain-madibou-2' },
      ],
      superficie: 650,
      vues: 178,
      utilisateur: userIds[3],
      createdAt: new Date('2023-08-10T09:00:00'),
    },

    // ── 8. TERRAIN — Kintélé ──
    {
      titre: 'Terrain stratégique à Kintélé — À vendre',
      description: 'Terrain commercial et résidentiel de 500 m² situé sur l\'axe principal de Kintélé, quartier dynamique en pleine mutation. Position stratégique au carrefour de plusieurs artères importantes, à proximité du Stade de Kintélé et du nouveau centre commercial. Idéal pour un projet mixte (commerce en rez-de-chaussée, logements en étage). Accès facile, eau et électricité disponibles, titre foncier en règle. L\'emplacement exceptionnel garantit une forte visibilité et un retour sur investissement rapide.',
      prix: 20000000,
      ville: 'Brazzaville',
      adresse: 'Avenue du Stade, Quartier Kintélé',
      transactionType: 'vente',
      categorie: 'Terrain',
      devise: 'XAF',
      status: 'active',
      images: [
        { url: 'https://images.unsplash.com/photo-1628624747186-a941c476b7ef?w=800&q=80', public_id: 'seed-terrain-kintele-1' },
        { url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80', public_id: 'seed-terrain-kintele-2' },
      ],
      superficie: 500,
      vues: 234,
      utilisateur: userIds[4],
      createdAt: new Date('2024-02-28T14:00:00'),
    },

    // ── 9. VILLA — Mfilou ──
    {
      titre: 'Villa de luxe avec piscine — Mfilou',
      description: 'Prestigieuse villa de luxe de 350 m² nichée dans un domaine privé du quartier Mfilou, l\'un des plus beaux quartiers résidentiels de Brazzaville. Cette villa exceptionnelle offre 5 chambres en suite, dont une suite parentale avec dressing et jacuzzi, un double salon, une salle à manger officielle et une cuisine française équipée. La propriété comprend une piscine à débordement chauffée, un jardin tropical de 500 m² avec fontaine, un garage double climatisé, une chambre d\'amis indépendante et une conciergerie. Sécurité maximale : enceinte haute, caméras de surveillance, gardien 24h/7j et système d\'alarme connecté. Proche des écoles internationales (French School, American School), des centres médicaux et du Golf de Brazzaville.',
      prix: 120000000,
      ville: 'Brazzaville',
      adresse: 'Domaine des Palmiers, Avenue du Golf, Mfilou',
      transactionType: 'vente',
      categorie: 'Autre',
      devise: 'XAF',
      status: 'active',
      isBonPlan: true,
      bonPlanLabel: 'Villa d\'exception',
      bonPlanExpiresAt: new Date('2026-12-31'),
      images: [
        { url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80', public_id: 'seed-villa-mfilou-1' },
        { url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80', public_id: 'seed-villa-mfilou-2' },
        { url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80', public_id: 'seed-villa-mfilou-3' },
      ],
      nombre_chambres: 5,
      nombre_salles_bain: 4,
      nombre_salons: 2,
      superficie: 350,
      garage: true,
      gardien: true,
      jardin: true,
      piscine: true,
      vues: 891,
      utilisateur: userIds[3],
      createdAt: new Date('2023-06-15T10:00:00'),
    },

    // ── 10. STUDIO — Poto-Poto ──
    {
      titre: 'Studio moderne meublé — Poto-Poto',
      description: 'Petit studio moderne de 40 m² entièrement meublé et équipé, situé dans un immeuble résidentiel sécurisé de Poto-Poto. Espace bien pensé avec coin nuit, salon, kitchenette intégrée (plaque, réfrigérateur, évier) et salle de bain compacte. Climatisation réversible, eau chaude, internet haute vitesse inclus. L\'immeuble offre un parking couvert, un local poubelle et un gardien permanent. À 5 minutes à pied du Marché Central et des stations de taxi-brousse. Parfait pour un étudiant, un stagiaire ou un jeune professionnel.',
      prix: 5500000,
      ville: 'Brazzaville',
      adresse: 'Résidence Les Oliviers, Rue 17, Poto-Poto',
      transactionType: 'vente',
      categorie: 'Autre',
      devise: 'XAF',
      status: 'active',
      images: [
        { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80', public_id: 'seed-studio-potopoto-1' },
        { url: 'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&q=80', public_id: 'seed-studio-potopoto-2' },
      ],
      nombre_chambres: 1,
      nombre_salles_bain: 1,
      nombre_salons: 1,
      superficie: 40,
      vues: 356,
      utilisateur: userIds[4],
      createdAt: new Date('2025-01-10T11:00:00'),
    },

    // ── 11. LOCAL COMMERCIAL — Djiri ──
    {
      titre: 'Local commercial avec vitrine — Djiri',
      description: 'Local commercial idéalement situé dans le quartier très fréquenté de Djiri, à intersection de deux avenues principales. Surface de 120 m² comprenant un espace de vente principal avec grande vitrine, un arrière-bureau, un entrepôt et des sanitaires. Eau, électricité triphasée et raccordement internet disponibles. Façade entièrement vitrée offrant une visibilité maximale. Parfait pour un restaurant, une pharmacie, un magasin de vêtements ou un point de service. Le quartier regorge de commerces, d\'écoles et d\'administrations, garantissant un flux important de passage.',
      prix: 30000000,
      ville: 'Brazzaville',
      adresse: 'Angle Avenues Congo et Lumumba, Djiri',
      transactionType: 'vente',
      categorie: 'Commercial',
      devise: 'XAF',
      status: 'active',
      images: [
        { url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80', public_id: 'seed-commercial-djiri-1' },
        { url: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=800&q=80', public_id: 'seed-commercial-djiri-2' },
      ],
      superficie: 120,
      vues: 198,
      utilisateur: userIds[3],
      createdAt: new Date('2024-11-05T09:00:00'),
    },
  ];

  // Fusionner les biens phares + biens générés
  const allPropertyDocs = [...propertyDocs, ...generatedDocs];
  console.log(`   🏠 Total biens à insérer : ${allPropertyDocs.length} (12 phares + ${generatedDocs.length} générés)`);

  // Supprimer les biens existants pour éviter les doublons
  await Property.deleteMany({});
  console.log('   🗑️  Anciens biens supprimés');

  // Pré-assigner un slug unique (le suffixe auto-généré par le plugin DRY partagé
  // n'utilise que les 4 derniers chiffres du timestamp ms, ce qui collisionne
  // presque à coup sûr sur un insertMany() de dizaines de documents synchrones)
  const slugify = require('slugify');
  allPropertyDocs.forEach((doc, i) => {
    if (!doc.slug) {
      doc.slug = `${slugify(doc.titre || 'bien', { lower: true, strict: true })}-${i}`;
    }
  });

  const propertyCreated = await Property.insertMany(allPropertyDocs);
  count += propertyCreated.length;
  console.log(`   ✓ ${propertyCreated.length} biens créés au total`);

  await logSeed({
    appName,
    feature: 'property',
    modelName: 'Property',
    schemaPath: path.join(__dirname, 'features', 'property', 'model', 'property.schema.js'),
    ids: propertyCreated.map((d) => d._id),
  });

  // ══════════════════════════════════════════════════════════════════
  //  RÉSERVATIONS (8)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n📅 Création des réservations...');

  const reservationSchema = require('./features/reservation/model/reservation.schema.js');
  const Reservation = getModel(appName, 'Reservation', reservationSchema);

  const reservationDocs = [
    // R1 — en_attente (Serge visitant la maison de Bacongo)
    {
      property: propertyCreated[0]._id,
      user: userIds[1],
      date: new Date('2026-07-15T10:00:00'),
      telephone: '+242065111222',
      isWhatsapp: true,
      reference: 'RES-2026-0001',
      status: 'en_attente',
      support: {
        mode: 'web_async',
        requesterPhone: '+242065111222',
        requesterEmail: 'serge.mboumba@gmail.com',
        expectedResponseMinutes: 30,
      },
      statusHistory: [
        { status: 'en_attente', actor: userIds[1], note: 'Demande de visite initiale', source: 'web', at: new Date('2026-07-01T09:15:00') },
      ],
      createdAt: new Date('2026-07-01T09:15:00'),
    },
    // R2 — en_attente (Chantal visitant l'appartement Poto-Poto)
    {
      property: propertyCreated[4]._id,
      user: userIds[2],
      date: new Date('2026-07-20T14:00:00'),
      telephone: '+242064333444',
      isWhatsapp: false,
      reference: 'RES-2026-0002',
      status: 'en_attente',
      support: {
        mode: 'web_async',
        requesterPhone: '+242064333444',
        requesterEmail: 'chantal.obianga@yahoo.fr',
        expectedResponseMinutes: 30,
      },
      statusHistory: [
        { status: 'en_attente', actor: userIds[2], note: 'Intéressée par l\'appartement Poto-Poto', source: 'web', at: new Date('2026-07-05T11:30:00') },
      ],
      createdAt: new Date('2026-07-05T11:30:00'),
    },
    // R3 — confirmée (Serge visitant la villa Mfilou)
    {
      property: propertyCreated[8]._id,
      user: userIds[1],
      date: new Date('2026-06-25T09:00:00'),
      telephone: '+242065111222',
      isWhatsapp: true,
      reference: 'RES-2026-0003',
      status: 'confirmee',
      support: {
        mode: 'web_async',
        confirmedAt: new Date('2026-06-18T16:00:00'),
        requesterPhone: '+242065111222',
        requesterEmail: 'serge.mboumba@gmail.com',
      },
      statusHistory: [
        { status: 'en_attente', actor: userIds[1], note: 'Demande de visite villa', source: 'web', at: new Date('2026-06-15T08:00:00') },
        { status: 'confirmee', actor: userIds[3], note: 'Propriétaire a confirmé la visite', source: 'web', at: new Date('2026-06-18T16:00:00') },
      ],
      createdAt: new Date('2026-06-15T08:00:00'),
    },
    // R4 — confirmée (Chantal visitant la maison Moungali)
    {
      property: propertyCreated[1]._id,
      user: userIds[2],
      date: new Date('2026-06-28T15:00:00'),
      telephone: '+242064333444',
      isWhatsapp: true,
      reference: 'RES-2026-0004',
      status: 'confirmee',
      support: {
        mode: 'web_async',
        confirmedAt: new Date('2026-06-20T10:00:00'),
        requesterPhone: '+242064333444',
        requesterEmail: 'chantal.obianga@yahoo.fr',
      },
      statusHistory: [
        { status: 'en_attente', actor: userIds[2], note: 'Visite pour achat familial', source: 'web', at: new Date('2026-06-19T14:00:00') },
        { status: 'confirmee', actor: userIds[3], note: 'Confirmation envoyée', source: 'web', at: new Date('2026-06-20T10:00:00') },
      ],
      createdAt: new Date('2026-06-19T14:00:00'),
    },
    // R5 — confirmée (Serge visitant le terrain Madibou)
    {
      property: propertyCreated[6]._id,
      user: userIds[1],
      date: new Date('2026-07-05T08:30:00'),
      telephone: '+242065111222',
      isWhatsapp: false,
      reference: 'RES-2026-0005',
      status: 'confirmee',
      support: {
        mode: 'web_async',
        confirmedAt: new Date('2026-07-02T12:00:00'),
        requesterPhone: '+242065111222',
        requesterEmail: 'serge.mboumba@gmail.com',
      },
      statusHistory: [
        { status: 'en_attente', actor: userIds[1], note: 'Investisseur intéressé par le terrain', source: 'web', at: new Date('2026-07-01T10:00:00') },
        { status: 'confirmee', actor: userIds[3], note: 'Terrain disponible pour visite', source: 'web', at: new Date('2026-07-02T12:00:00') },
      ],
      createdAt: new Date('2026-07-01T10:00:00'),
    },
    // R6 — annulée (Chantal annule visite terrain Kintélé)
    {
      property: propertyCreated[7]._id,
      user: userIds[2],
      date: new Date('2026-05-10T11:00:00'),
      telephone: '+242064333444',
      isWhatsapp: false,
      reference: 'RES-2026-0006',
      status: 'annulee',
      support: {
        mode: 'web_async',
        requesterPhone: '+242064333444',
        requesterEmail: 'chantal.obianga@yahoo.fr',
      },
      statusHistory: [
        { status: 'en_attente', actor: userIds[2], note: 'Visite terrain Kintélé', source: 'web', at: new Date('2026-05-01T09:00:00') },
        { status: 'annulee', actor: userIds[2], note: 'Changement de projet d\'investissement', source: 'web', at: new Date('2026-05-06T15:30:00') },
      ],
      createdAt: new Date('2026-05-01T09:00:00'),
    },
    // R7 — annulée (Serge annule visite appartement Bacongo)
    {
      property: propertyCreated[4]._id,
      user: userIds[1],
      date: new Date('2026-04-18T16:00:00'),
      telephone: '+242065111222',
      isWhatsapp: true,
      reference: 'RES-2026-0007',
      status: 'annulee',
      support: {
        mode: 'web_async',
        requesterPhone: '+242065111222',
        requesterEmail: 'serge.mboumba@gmail.com',
      },
      statusHistory: [
        { status: 'en_attente', actor: userIds[1], note: 'Visite appartement Bacongo', source: 'web', at: new Date('2026-04-10T13:00:00') },
        { status: 'annulee', actor: userIds[1], note: 'A trouvé un autre bien, annulation', source: 'web', at: new Date('2026-04-15T09:00:00') },
      ],
      createdAt: new Date('2026-04-10T13:00:00'),
    },
    // R8 — confirmée (Chantal visite studio Poto-Poto — passée)
    {
      property: propertyCreated[9]._id,
      user: userIds[2],
      date: new Date('2026-03-05T10:00:00'),
      telephone: '+242064333444',
      isWhatsapp: false,
      reference: 'RES-2026-0008',
      status: 'confirmee',
      support: {
        mode: 'web_async',
        confirmedAt: new Date('2026-03-01T14:00:00'),
        acknowledgedAt: new Date('2026-03-05T10:15:00'),
        requesterPhone: '+242064333444',
        requesterEmail: 'chantal.obianga@yahoo.fr',
      },
      statusHistory: [
        { status: 'en_attente', actor: userIds[2], note: 'Visite studio pour investissement locatif', source: 'web', at: new Date('2026-02-28T08:00:00') },
        { status: 'confirmee', actor: userIds[4], note: 'Visite réalisée avec succès', source: 'web', at: new Date('2026-03-01T14:00:00') },
      ],
      createdAt: new Date('2026-02-28T08:00:00'),
    },
  ];

  // Supprimer les réservations existantes
  await Reservation.deleteMany({});
  console.log('   🗑️  Anciennes réservations supprimées');

  // Pré-assigner un slug unique (même raison que pour les biens : évite les
  // collisions du suffixe timestamp trop court généré par le plugin DRY partagé)
  reservationDocs.forEach((doc, i) => {
    if (!doc.slug) doc.slug = `reservation-seed-${i}-${Date.now()}`;
  });

  const reservationCreated = await Reservation.insertMany(reservationDocs);
  count += reservationCreated.length;
  console.log(`   ✓ ${reservationCreated.length} réservations créées`);

  await logSeed({
    appName,
    feature: 'reservation',
    modelName: 'Reservation',
    schemaPath: path.join(__dirname, 'features', 'reservation', 'model', 'reservation.schema.js'),
    ids: reservationCreated.map((d) => d._id),
  });

  // ══════════════════════════════════════════════════════════════════
  //  MESSAGES (conversations + notifications liées aux réservations)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n💬 Création des messages...');

  const messageSchema = require('./features/message/model/message.schema.js');
  const Message = getModel(appName, 'Message', messageSchema);

  const messageDocs = [
    // ── Conversation : Serge → Admin (visite villa Mfilou) ──
    {
      expediteur: userIds[1],
      destinataire: userIds[0],
      sujet: 'Renseignements villa Mfilou',
      contenu: 'Bonjour, je souhaiterais obtenir plus d\'informations sur la villa de Mfilou. Est-il possible d\'organiser une visite cette semaine ? Merci.',
      lu: true,
      createdAt: new Date('2026-06-14T10:00:00'),
    },
    {
      expediteur: userIds[0],
      destinataire: userIds[1],
      sujet: 'Re: Renseignements villa Mfilou',
      contenu: 'Bonjour Serge, merci pour votre intérêt. La villa est disponible pour une visite. Je vous propose le mercredi 25 juin à 9h. Est-ce que cela vous convient ?',
      lu: true,
      createdAt: new Date('2026-06-14T11:30:00'),
    },
    {
      expediteur: userIds[1],
      destinataire: userIds[0],
      sujet: 'Re: Renseignements villa Mfilou',
      contenu: 'Parfait, le 25 juin à 9h me convient parfaitement. Je serai là avec mon conseiller immobilier. Merci beaucoup !',
      lu: true,
      createdAt: new Date('2026-06-14T14:00:00'),
    },

    // ── Conversation : Chantal → Admin (appartement Poto-Poto) ──
    {
      expediteur: userIds[2],
      destinataire: userIds[0],
      sujet: 'Disponibilité appartement Poto-Poto',
      contenu: 'Bonjour, l\'appartement en centre-ville de Poto-Poto est-il toujours disponible ? Je suis très intéressée.',
      lu: true,
      createdAt: new Date('2026-07-01T09:00:00'),
    },
    {
      expediteur: userIds[0],
      destinataire: userIds[2],
      sujet: 'Re: Disponibilité appartement Poto-Poto',
      contenu: 'Bonjour Chantal, oui l\'appartement est toujours disponible. Nous pouvons organiser une visite à votre convenance. Quand seriez-vous disponible ?',
      lu: false,
      createdAt: new Date('2026-07-01T10:15:00'),
    },

    // ── Conversation : Serge → Propriétaire (terrain Madibou) ──
    {
      expediteur: userIds[1],
      destinataire: userIds[3],
      sujet: 'Terrain Madibou',
      contenu: 'Bonjour Monsieur, je suis très intéressé par le terrain à Madibou. Le prix est-il négociable pour un paiement en deux fois ?',
      lu: true,
      createdAt: new Date('2026-07-01T11:00:00'),
    },
    {
      expediteur: userIds[3],
      destinataire: userIds[1],
      sujet: 'Re: Terrain Madibou',
      contenu: 'Bonjour Serge, merci pour votre intérêt. Nous pouvons discuter des modalités de paiement lors de la visite. Le terrain est très demandé, je vous recommande de passer rapidement.',
      lu: false,
      createdAt: new Date('2026-07-02T08:00:00'),
    },

    // ── Conversation : Chantal → Propriétaire (studio) ──
    {
      expediteur: userIds[2],
      destinataire: userIds[4],
      sujet: 'Studio Poto-Poto — suite visite',
      contenu: 'Bonjour, suite à notre visite du 5 mars, je souhaite confirmer mon intérêt pour le studio. Pouvez-vous me préparer les documents ?',
      lu: true,
      createdAt: new Date('2026-03-10T15:00:00'),
    },
    {
      expediteur: userIds[4],
      destinataire: userIds[2],
      sujet: 'Re: Studio Poto-Poto — suite visite',
      contenu: 'Bonjour Chantal, excellent choix ! Je vous prépare les documents de vente. Vous les recevrez par email dans 48h. N\'hésitez pas si vous avez des questions.',
      lu: true,
      createdAt: new Date('2026-03-11T09:00:00'),
    },

    // ── Notifications (messages admin → utilisateur pour chaque réservation) ──
    // R1 notification
    {
      expediteur: userIds[0],
      destinataire: userIds[1],
      sujet: 'Demande de visite reçue — Maison Bacongo',
      contenu: `Bonjour Serge,\n\nVotre demande de visite pour la maison "Magnifique maison familiale à Bacongo" a bien été reçue.\n\n📋 Référence : RES-2026-0001\n📅 Date souhaitée : 15 juillet 2026 à 10h00\n🏠 Bien : Maison familiale — Bacongo\n💰 Prix : 45 000 000 XAF\n\nNous allons prendre contact avec le propriétaire pour confirmer cette visite. Vous recevrez une notification de confirmation sous peu.\n\nL'équipe SCIM Immobilier`,
      lu: true,
      createdAt: new Date('2026-07-01T09:20:00'),
    },
    // R2 notification
    {
      expediteur: userIds[0],
      destinataire: userIds[2],
      sujet: 'Demande de visite reçue — Appartement Poto-Poto',
      contenu: `Bonjour Chantal,\n\nVotre demande de visite pour l'appartement "Appartement moderne en centre-ville — Poto-Poto" a bien été reçue.\n\n📋 Référence : RES-2026-0002\n📅 Date souhaitée : 20 juillet 2026 à 14h00\n🏠 Bien : Appartement 2 chambres — Poto-Poto\n💰 Prix : 18 000 000 XAF\n\nNous allons prendre contact avec le propriétaire pour confirmer cette visite.\n\nL'équipe SCIM Immobilier`,
      lu: true,
      createdAt: new Date('2026-07-05T11:35:00'),
    },
    // R3 notification confirmée
    {
      expediteur: userIds[0],
      destinataire: userIds[1],
      sujet: '✅ Visite confirmée — Villa Mfilou',
      contenu: `Bonjour Serge,\n\nExcellente nouvelle ! Votre visite de la villa à Mfilou est confirmée par le propriétaire.\n\n📋 Référence : RES-2026-0003\n📅 Date confirmée : 25 juin 2026 à 09h00\n🏠 Bien : Villa de luxe avec piscine — Mfilou\n💰 Prix : 120 000 000 XAF\n📍 Adresse : Domaine des Palmiers, Avenue du Golf, Mfilou\n\nMerci de vous présenter à l'heure prévue. En cas d'empêchement, veuillez nous prévenir au plus tôt.\n\nL'équipe SCIM Immobilier`,
      lu: true,
      createdAt: new Date('2026-06-18T16:05:00'),
    },
    // R4 notification confirmée
    {
      expediteur: userIds[0],
      destinataire: userIds[2],
      sujet: '✅ Visite confirmée — Maison Moungali',
      contenu: `Bonjour Chantal,\n\nVotre visite de la maison à Moungali est confirmée !\n\n📋 Référence : RES-2026-0004\n📅 Date confirmée : 28 juin 2026 à 15h00\n🏠 Bien : Maison contemporaine — Moungali\n💰 Prix : 28 000 000 XAF\n📍 Adresse : Rue Mabiala, Quartier Moungali\n\nMerci de vous présenter à l'heure prévue.\n\nL'équipe SCIM Immobilier`,
      lu: true,
      createdAt: new Date('2026-06-20T10:05:00'),
    },
    // R5 notification confirmée
    {
      expediteur: userIds[0],
      destinataire: userIds[1],
      sujet: '✅ Visite confirmée — Terrain Madibou',
      contenu: `Bonjour Serge,

Votre visite du terrain à Madibou est confirmée !

📋 Référence : RES-2026-0005
📅 Date confirmée : 5 juillet 2026 à 08h30
🏠 Bien : Grand terrain constructible — Madibou
💰 Prix : 15 000 000 XAF
📍 Adresse : Route du Lac, Quartier Madibou

Merci de vous présenter à l'heure prévue.

L'équipe SCIM Immobilier`,
      lu: true,
      createdAt: new Date('2026-07-02T12:05:00'),
    },
    // R6 notification annulée
    {
      expediteur: userIds[0],
      destinataire: userIds[2],
      sujet: '❌ Visite annulée — Terrain Kintélé',
      contenu: `Bonjour Chantal,\n\nNous avons bien pris note de l'annulation de votre demande de visite.\n\n📋 Référence : RES-2026-0006\n🏠 Bien : Terrain stratégique — Kintélé\n\nSi vous souhaitez reprogrammer cette visite ou découvrir d'autres biens, n'hésitez pas à nous contacter.\n\nL'équipe SCIM Immobilier`,
      lu: true,
      createdAt: new Date('2026-05-06T15:35:00'),
    },
    // R7 notification annulée
    {
      expediteur: userIds[0],
      destinataire: userIds[1],
      sujet: '❌ Visite annulée — Appartement Bacongo',
      contenu: `Bonjour Serge,\n\nNous avons bien pris note de l'annulation de votre demande de visite.\n\n📋 Référence : RES-2026-0007\n🏠 Bien : Appartement lumineux — Bacongo\n\nSi vous souhaitez visiter un autre bien ou reprogrammer, nous restons à votre disposition.\n\nL'équipe SCIM Immobilier`,
      lu: true,
      createdAt: new Date('2026-04-15T09:05:00'),
    },
    // R8 notification (visite passée)
    {
      expediteur: userIds[0],
      destinataire: userIds[2],
      sujet: '📋 Récapitulatif visite — Studio Poto-Poto',
      contenu: `Bonjour Chantal,\n\nSuite à votre visite du studio à Poto-Poto, voici un récapitulatif :\n\n📋 Référence : RES-2026-0008\n🏠 Bien : Studio moderne meublé — Poto-Poto\n💰 Prix : 5 500 000 XAF\n📅 Visite effectuée : 5 mars 2026\n\nSi vous souhaitez procéder à l'achat ou avez des questions, contactez-nous.\n\nL'équipe SCIM Immobilier`,
      lu: true,
      createdAt: new Date('2026-03-05T10:20:00'),
    },
  ];

  await Message.deleteMany({});
  console.log('   🗑️  Anciens messages supprimés');

  // Pré-assigner un slug unique (même raison que pour les biens/réservations)
  messageDocs.forEach((doc, i) => {
    if (!doc.slug) doc.slug = `message-seed-${i}-${Date.now()}`;
  });

  const messageCreated = await Message.insertMany(messageDocs);
  count += messageCreated.length;
  console.log(`   ✓ ${messageCreated.length} messages créés (conversations + notifications)`);

  await logSeed({
    appName,
    feature: 'message',
    modelName: 'Message',
    schemaPath: path.join(__dirname, 'features', 'message', 'model', 'message.schema.js'),
    ids: messageCreated.map((d) => d._id),
  });

  // ══════════════════════════════════════════════════════════════════
  //  FAVORIS
  // ══════════════════════════════════════════════════════════════════
  console.log('\n⭐ Ajout des favoris...');

  // Serge (userIds[1]) → 3 favoris : villa, maison Bacongo, terrain Madibou
  const sergeFavs = [propertyCreated[8]._id, propertyCreated[0]._id, propertyCreated[6]._id];
  for (const propId of sergeFavs) {
    await Property.findByIdAndUpdate(propId, { $addToSet: { favoris: userIds[1] } });
  }

  // Chantal (userIds[2]) → 2 favoris : appartement Poto-Poto, studio
  const chantalFavs = [propertyCreated[4]._id, propertyCreated[9]._id];
  for (const propId of chantalFavs) {
    await Property.findByIdAndUpdate(propId, { $addToSet: { favoris: userIds[2] } });
  }

  console.log(`   ✓ ${sergeFavs.length + chantalFavs.length} favoris ajoutés`);

  // ══════════════════════════════════════════════════════════════════
  //  RÉCAPITULATIF
  // ══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log('  📊 RÉCAPITULATIF DU SEED SCIM');
  console.log('═'.repeat(50));
  console.log(`  👤 Utilisateurs :  5 (1 admin + 2 clients + 2 propriétaires)`);
  const catsSummary = {};
  propertyCreated.forEach(p => { catsSummary[p.categorie] = (catsSummary[p.categorie] || 0) + 1; });
  const catStr = Object.entries(catsSummary).map(([k, v]) => `${v} ${k}`).join(', ');
  console.log(`  🏠 Biens :         ${propertyCreated.length} (${catStr})`);
  console.log(`  📅 Réservations :  ${reservationCreated.length} (2 en attente, 3 confirmées, 2 annulées, 1 passée)`);
  console.log(`  💬 Messages :      ${messageCreated.length} (9 conversations + 8 notifications)`);
  console.log(`  ⭐ Favoris :       ${sergeFavs.length + chantalFavs.length}`);
  console.log(`  ⚙️  Settings :      ${settingsDocs.length}`);
  console.log('═'.repeat(50));
  console.log(`  Total inséré : ${count} documents`);
  console.log('═'.repeat(50) + '\n');

  return { count };
};

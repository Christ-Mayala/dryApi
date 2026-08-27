const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const dns = require('dns');
const fs = require('fs');
const path = require('path');

// Forcer l'utilisation du DNS Google pour résoudre les domaines Atlas
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const config = require('../../../config/database');
const cloudinary = require('cloudinary').v2;

const SALT_ROUNDS = 10;
const NOW = new Date('2026-08-27T10:39:46+01:00');

if (config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
  });
}

const downloadImage = (url) => {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
};

const uploadToCloudinary = async (folder, publicId, remoteUrl) => {
  if (!cloudinary.config().cloud_name) {
    return { url: null, public_id: null };
  }
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      remoteUrl,
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
  });
};

const CITY_DATA = {
  'Brazzaville': {
    country: 'CG', lat: -4.2634, lng: 15.2832, multiplier: 1,
    addresses: ['63 bis, rue Moundzombo, Moungali', 'avenue de la Libération, Bacongo', 'boulevard de la Révolution, Ouenzé', 'rue de la Paix, Poto-Poto', 'avenue des Nations Unies, Makelekele', 'rue de l\'Aéroport, Talangaï', 'avenue du Plateau, Brazzaville', 'rue de la Gare, Bacongo']
  },
  'Pointe-Noire': {
    country: 'CG', lat: -4.7699, lng: 11.8636, multiplier: 0.9,
    addresses: ['avenue de la Marine, Centre-ville', 'rue du Commerce, Loango', 'boulevard du Port, Pointe-Noire', 'avenue de la Plage, Côte-Matou', 'rue de l\'Église, Tié-Tié']
  },
  'Kinshasa': {
    country: 'CD', lat: -4.4419, lng: 15.2663, multiplier: 0.85,
    addresses: ['avenue du 30 Juin, Gombe', 'boulevard Lumumba, Lingwala', 'rue de la Poste, Barumbu', 'avenue Kasa-Vubu, Kintambo', 'boulevard de l\'Unité, Ngaliema']
  },
  'Dolisie': {
    country: 'CG', lat: -4.2167, lng: 12.6667, multiplier: 0.5,
    addresses: ['rue de l\'Indépendance, Centre-ville', 'avenue de la Gare, Dolisie', 'boulevard de la Forêt, Dolisie']
  },
  'Oyo': {
    country: 'CG', lat: -1.1333, lng: 15.9833, multiplier: 0.45,
    addresses: ['route de Oyo, Centre-ville', 'avenue de l\'Aéroport, Oyo', 'rue du Marché, Oyo']
  },
  'Owando': {
    country: 'CG', lat: -0.4833, lng: 15.9167, multiplier: 0.4,
    addresses: ['route de Owando, Centre-ville', 'avenue de la Mission, Owando']
  },
  'Goma': {
    country: 'CD', lat: -1.6586, lng: 29.2203, multiplier: 0.55,
    addresses: ['avenue Kivu, Centre-ville', 'boulevard du Lac, Goma', 'rue de la Carrière, Goma']
  },
  'Lubumbashi': {
    country: 'CD', lat: -11.6876, lng: 27.5026, multiplier: 0.6,
    addresses: ['avenue de la Métallurgie, Centre-ville', 'boulevard Mobutu, Lubumbashi', 'rue de l\'Usine, Kamalondo']
  },
  'Douala': {
    country: 'CM', lat: 4.0511, lng: 9.7679, multiplier: 0.75,
    addresses: ['avenue Charles de Gaulle, Centre-ville', 'boulevard de la Liberté, Douala', 'rue de la Bourse, Bonanjo', 'avenue de l\'Aéroport, Douala']
  },
  'Yaoundé': {
    country: 'CM', lat: 3.8480, lng: 11.5021, multiplier: 0.7,
    addresses: ['avenue de l\'Indépendance, Centre-ville', 'boulevard du 20 Mai, Yaoundé', 'rue de la Présidence, Yaoundé', 'avenue de l\'Université, Yaoundé']
  },
  'Kribi': {
    country: 'CM', lat: 2.9370, lng: 9.9106, multiplier: 0.65,
    addresses: ['route de Kribi, Centre-ville', 'avenue de la Plage, Kribi', 'boulevard du Port, Kribi']
  },
  'Libreville': {
    country: 'GA', lat: 0.4162, lng: 9.4673, multiplier: 0.8,
    addresses: ['avenue du Général de Gaulle, Centre-ville', 'boulevard du Bord de Mer, Libreville', 'rue de la Corniche, Libreville', 'avenue de la Côte, Libreville']
  },
  'Port-Gentil': {
    country: 'GA', lat: -0.7167, lng: 8.7833, multiplier: 0.6,
    addresses: ['avenue du Port, Centre-ville', 'boulevard de l\'Océan, Port-Gentil', 'rue de la Raffinerie, Port-Gentil']
  },
  'Franceville': {
    country: 'GA', lat: -1.6333, lng: 13.5833, multiplier: 0.4,
    addresses: ['route de Franceville, Centre-ville', 'avenue de la Gare, Franceville']
  },
  'Moanda': {
    country: 'GA', lat: -1.5667, lng: 13.2000, multiplier: 0.35,
    addresses: ['route de Moanda, Centre-ville', 'avenue de la Mine, Moanda']
  }
};

const PROPERTY_CATEGORIES = ['Appartement', 'Maison', 'Hôtel', 'Terrain', 'Commercial', 'Autre'];
const TRANSACTION_TYPES = ['location', 'vente'];
const PROPERTY_NAMES = {
  'Appartement': ['Appartement lumineux', 'Appartement moderne', 'Studio meublé', 'Appartement standing', 'Duplex', 'Appartement vue mer', 'Appartement centre-ville'],
  'Maison': ['Villa de luxe', 'Maison familiale', 'Maison avec piscine', 'Maison jardin', 'Villa standing', 'Maison contemporaine', 'Villa avec vue'],
  'Hôtel': ['Hôtel boutique', 'Hôtel de charme', 'Résidence hôtelière', 'Hôtel affaires', 'Lodge'],
  'Terrain': ['Terrain constructible', 'Terrain agricole', 'Terrain commercial', 'Parcelle'],
  'Commercial': ['Bureau moderne', 'Local commercial', 'Espace coworking', 'Boutique', 'Entrepôt'],
  'Autre': ['Immeuble', 'Résidence', 'Bâtiment administratif']
};

const ADJECTIVES = ['spacieux', 'calme', 'luminueux', 'récent', 'meublé', 'non meublé', 'avec parking', 'proche commodités'];

const BASE_PRICES = {
  'Appartement': { location: [150000, 450000], vente: [2500000, 12000000] },
  'Maison': { location: [300000, 800000], vente: [5000000, 35000000] },
  'Hôtel': { location: [500000, 2000000], vente: [30000000, 120000000] },
  'Terrain': { location: [100000, 300000], vente: [1500000, 8000000] },
  'Commercial': { location: [250000, 600000], vente: [4000000, 20000000] },
  'Autre': { location: [180000, 500000], vente: [3000000, 15000000] }
};

const CLOUDINARY_CLOUD = config.CLOUDINARY_CLOUD_NAME || 'demo';
const CLOUDINARY_BASE = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/`;

const IMAGE_MAP = {
  'Appartement': [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80'
  ],
  'Maison': [
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80'
  ],
  'Hôtel': [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80'
  ],
  'Terrain': [
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80'
  ],
  'Commercial': [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'
  ],
  'Autre': [
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
    'https://images.unsplash.com/photo-1448630360428-65456659c877?w=800&q=80'
  ]
};

const buildPropertyTitle = (city, category, index) => {
  const base = PROPERTY_NAMES[category][Math.floor(Math.random() * PROPERTY_NAMES[category].length)];
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  return `${base} ${adj} — ${city} #${String(index + 1).padStart(3, '0')}`;
};

const generateAddress = (city) => {
  const cityData = CITY_DATA[city];
  const base = cityData.addresses[Math.floor(Math.random() * cityData.addresses.length)];
  return `${base}, ${city}`;
};

const generatePrice = (category, transactionType, city) => {
  const cityData = CITY_DATA[city];
  const [min, max] = BASE_PRICES[category][transactionType];
  const base = Math.floor(min + Math.random() * (max - min));
  return Math.round(base * cityData.multiplier / 1000) * 1000;
};

const generatePropertyImages = async (category, seed) => {
  const urls = IMAGE_MAP[category] || IMAGE_MAP['Autre'];
  const selected = [];
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const url = urls[(seed + i) % urls.length];
    const publicId = `scim-seed/${category.toLowerCase()}-${seed}-${i}`;
    try {
      const uploaded = await uploadToCloudinary('scim-seed', publicId, url);
      if (uploaded.url) {
        selected.push({ url: uploaded.url, public_id: uploaded.public_id });
      } else {
        selected.push({ url, public_id: publicId });
      }
    } catch (e) {
      selected.push({ url, public_id: publicId });
    }
  }
  return selected;
};

const randomInt = (min, max) => Math.floor(min + Math.random() * (max - min));

const backDate = (daysAgo) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return d;
};

const backDateMonths = (monthsAgo) => {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - monthsAgo);
  return d;
};

const generateReservationsForProperty = async (property, users, daysBack = 240) => {
  const statuses = ['en_attente', 'confirmee', 'annulee', 'terminee'];
  const reservations = [];
  const count = randomInt(0, 6);
  const statusWeights = { en_attente: 0.25, confirmee: 0.35, annulee: 0.15, terminee: 0.25 };

  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const daysOffset = randomInt(1, daysBack);
    const createdAt = backDate(daysOffset);
    const requestType = ['visite', 'location', 'achat'][Math.floor(Math.random() * 3)];
    const statusRand = Math.random();
    let status = 'en_attente';
    if (statusRand > statusWeights.terminee + statusWeights.annulee) status = 'confirmee';
    else if (statusRand > statusWeights.terminee) status = 'annulee';
    else status = 'terminee';

    const support = {
      mode: 'web_async',
      reference: `RSV-${createdAt.getFullYear()}${String(createdAt.getMonth()+1).padStart(2,'0')}${String(createdAt.getDate()).padStart(2,'0')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      expectedResponseMinutes: 30,
      reminderAfterMinutes: 30,
      requesterPhone: `+24206${String(randomInt(1000000, 9999999))}`,
      requesterEmail: user.email,
      confirmedAt: status === 'confirmee' || status === 'terminee' ? new Date(createdAt.getTime() + randomInt(1, 3) * 86400000) : null,
      acknowledgedAt: status === 'terminee' ? new Date(createdAt.getTime() + randomInt(2, 5) * 86400000) : null,
      pdfAcknowledged: status === 'terminee',
      pdfEmailedAt: status === 'terminee' ? new Date(createdAt.getTime() + randomInt(3, 7) * 86400000) : null,
      pdfEmailAttempts: status === 'terminee' ? 1 : 0,
      reminderSentAt: null,
      reminderAttempts: 0,
      lastContactAt: createdAt,
      lastContactChannel: 'email',
      asyncNotice: ''
    };

    const statusHistory = [
      { status: 'en_attente', actor: user._id, note: 'Demande créée', source: 'web', at: createdAt }
    ];
    if (status === 'confirmee' || status === 'terminee') {
      const confirmedAt = new Date(createdAt.getTime() + randomInt(1, 3) * 86400000);
      statusHistory.push({ status: 'confirmee', actor: user._id, note: 'Réservation confirmée', source: 'web', at: confirmedAt });
    }
    if (status === 'terminee') {
      const termineeAt = new Date(createdAt.getTime() + randomInt(2, 5) * 86400000);
      statusHistory.push({ status: 'terminee', actor: user._id, note: 'Transaction terminée', source: 'web', at: termineeAt });
    }
    if (status === 'annulee') {
      const annuleeAt = new Date(createdAt.getTime() + randomInt(1, 4) * 86400000);
      statusHistory.push({ status: 'annulee', actor: user._id, note: 'Annulée par client', source: 'web', at: annuleeAt });
    }

    reservations.push({
      property: property._id,
      user: user._id,
      requestType,
      date: createdAt,
      telephone: support.requesterPhone,
      isWhatsapp: Math.random() > 0.5,
      status,
      statusHistory,
      support,
      createdAt,
      updatedAt: statusHistory[statusHistory.length - 1].at
    });
  }
  return reservations;
};

const generateMessages = async (property, users, adminUser, reservations) => {
  const messages = [];
  for (const r of reservations.slice(0, 5)) {
    const client = users.find(u => u._id.equals(r.user));
    if (!client) continue;
    const daysOffset = Math.floor((NOW - r.createdAt) / 86400000);
    if (daysOffset > 60) continue;

    const subjects = [
      `Demande info — ${property.titre}`,
      `Visite ${property.titre}`,
      `Disponibilité ${property.titre}`,
      `Suivi réservation ${r.support.reference}`
    ];
    const bodies = [
      `Bonjour, je suis intéressé par ce bien. Peut-on organiser une visite ?`,
      `Quelle est la disponibilité pour ce bien ?`,
      `Pouvez-vous me donner plus d'informations sur le prix ?`,
      `Merci de me contacter concernant cette annonce.`
    ];

    messages.push({
      expediteur: client._id,
      destinataire: adminUser._id,
      sujet: subjects[Math.floor(Math.random() * subjects.length)],
      contenu: bodies[Math.floor(Math.random() * bodies.length)],
      lu: Math.random() > 0.4,
      createdAt: r.createdAt
    });

    if (Math.random() > 0.5) {
      messages.push({
        expediteur: adminUser._id,
        destinataire: client._id,
        sujet: `Re: ${subjects[Math.floor(Math.random() * subjects.length)]}`,
        contenu: `Bonjour, merci pour votre intérêt. Voici les informations demandées pour le bien "${property.titre}".`,
        lu: true,
        createdAt: new Date(r.createdAt.getTime() + randomInt(1, 3) * 86400000)
      });
    }
  }
  return messages;
};

const seed = async () => {
  // On réutilise le système multi-tenant du framework pour écrire dans SCIMDB
  const { connectCluster, getTenantDB } = require('../../../dry/config/connection/dbConnection');

  try {
    await connectCluster();
  } catch (error) {
    console.error('Impossible de se connecter à MongoDB Atlas. Vérifie MONGO_URI dans .env');
    process.exit(1);
  }

  // La base cible est SCIMDB (même logique que le bootloader)
  const db = getTenantDB('SCIM');
  console.log('Connecté à SCIMDB via le système multi-tenant');

  try {
    const propertySchema = require('../features/property/model/property.schema');
    const reservationSchema = require('../features/reservation/model/reservation.schema');
    const messageSchema = require('../features/message/model/message.schema');
    const userSchema = require('../features/users/model/userPublic.schema.js');

    const models = {
      Property: db.models.Property || db.model('Property', propertySchema),
      Reservation: db.models.Reservation || db.model('Reservation', reservationSchema),
      Message: db.models.Message || db.model('Message', messageSchema),
      User: db.models.User || db.model('User', userSchema),
    };

    console.log('Nettoyage des collections SCIM...');
    await models.Property.deleteMany({});
    await models.Reservation.deleteMany({});
    await models.Message.deleteMany({});
    await models.User.deleteMany({ email: { $nin: [config.SEED_ADMIN_EMAIL] } });

    console.log('Création des utilisateurs...');
    const hashedPassword = await bcrypt.hash('password123', SALT_ROUNDS);

    const admin = await models.User.create({
      name: config.SEED_ADMIN_NAME,
      nom: config.SEED_ADMIN_NAME,
      email: config.SEED_ADMIN_EMAIL,
      telephone: '+242068457521',
      password: hashedPassword,
      role: 'admin',
      status: 'active'
    });

    const agents = [];
    for (let i = 1; i <= 5; i++) {
      agents.push(await models.User.create({
        name: `Agent ${i}`,
        nom: `Agent ${i}`,
        email: `agent${i}@scim.cg`,
        telephone: `+24206${String(randomInt(1000000, 9999999))}`,
        password: hashedPassword,
        role: 'agent',
        status: 'active'
      }));
    }

    const clients = [];
    const firstNames = ['Jean', 'Marie', 'Pierre', 'Aminata', 'Kofi', 'Fatou', 'Moussa', 'Aisha', 'Blaise', 'Grace', 'Luc', 'Sara', 'Paul', 'Nathalie', 'David'];
    const lastNames = ['Mbeki', 'Diallo', 'Moungou', 'Obame', 'Ndong', 'Kouassi', 'Traoré', 'Keita', 'Sow', 'Diop', 'Nku', 'Mvogo', 'Atangana', 'Mba', 'Essono'];

    for (let i = 1; i <= 30; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      clients.push(await models.User.create({
        name: `${fn} ${ln}`,
        nom: `${fn} ${ln}`,
        email: `client${i}@example.com`,
        telephone: `+242${randomInt(4, 7)}${String(randomInt(1000000, 9999999))}`,
        password: hashedPassword,
        role: 'client',
        status: 'active'
      }));
    }

    console.log('Création des biens...');
    const cityDistribution = {
      'Brazzaville': 50, 'Pointe-Noire': 30, 'Kinshasa': 20, 'Dolisie': 11,
      'Oyo': 15, 'Owando': 4, 'Goma': 5, 'Lubumbashi': 8,
      'Douala': 10, 'Yaoundé': 8, 'Kribi': 5, 'Libreville': 10,
      'Port-Gentil': 5, 'Franceville': 4, 'Moanda': 5
    };

    const allProperties = [];
    const allReservations = [];
    const allMessages = [];
    let propertyIndex = 0;

    for (const [city, count] of Object.entries(cityDistribution)) {
      for (let i = 0; i < count; i++) {
        const category = PROPERTY_CATEGORIES[Math.floor(Math.random() * PROPERTY_CATEGORIES.length)];
        const transactionType = Math.random() > 0.4 ? 'vente' : 'location';
        const seedVal = propertyIndex + 1;
        const title = buildPropertyTitle(city, category, i);
        const price = generatePrice(category, transactionType, city);
        const createdMonthsAgo = randomInt(0, 8);
        const createdAt = backDateMonths(createdMonthsAgo);

        const property = await models.Property.create({
          titre: title,
          description: `Bien immobilier exceptionnel situé à ${city}. ${category} ${transactionType === 'vente' ? 'à vendre' : 'à louer'} avec des finitions de qualité. Proche de toutes commodités.`,
          prix: price,
          ville: city,
          adresse: generateAddress(city),
          status: Math.random() > 0.15 ? 'active' : 'inactive',
          transactionType,
          categorie: category,
          images: await generatePropertyImages(category, seedVal),
          utilisateur: admin._id,
          adminReference: admin._id,
          submittedByUser: Math.random() > 0.7 ? clients[Math.floor(Math.random() * clients.length)]._id : admin._id,
          submissionSource: Math.random() > 0.7 ? 'client_submission' : 'admin_direct',
          nombre_chambres: category === 'Appartement' ? randomInt(1, 4) : category === 'Maison' ? randomInt(2, 6) : category === 'Hôtel' ? randomInt(10, 50) : 0,
          nombre_salles_bain: category === 'Appartement' ? randomInt(1, 3) : category === 'Maison' ? randomInt(1, 4) : 0,
          nombre_salons: category === 'Appartement' ? randomInt(1, 2) : category === 'Maison' ? randomInt(1, 3) : 0,
          superficie: category === 'Terrain' ? randomInt(200, 5000) : randomInt(40, 500),
          garage: category === 'Maison' && Math.random() > 0.3,
          gardien: Math.random() > 0.6,
          balcon: category === 'Appartement' && Math.random() > 0.4,
          piscine: category === 'Maison' && Math.random() > 0.7,
          jardin: category === 'Maison' && Math.random() > 0.5,
          noteMoyenne: randomInt(30, 50) / 10,
          nombreAvis: randomInt(0, 20),
          vues: randomInt(10, 500),
          evaluations: Array.from({ length: randomInt(0, 8) }, () => ({
            utilisateur: clients[Math.floor(Math.random() * clients.length)]._id,
            note: randomInt(3, 6),
            creeLe: backDate(randomInt(1, 180))
          })),
          createdAt,
          updatedAt: createdAt
        });

        allProperties.push(property);
        propertyIndex++;

        const reservations = await generateReservationsForProperty(property, clients);
        allReservations.push(...reservations);

        const messages = await generateMessages(property, clients, admin, reservations);
        allMessages.push(...messages);
      }
    }

    console.log('Insertion des réservations...');
    const chunkSize = 500;
    for (let i = 0; i < allReservations.length; i += chunkSize) {
      const chunk = allReservations.slice(i, i + chunkSize);
      await models.Reservation.insertMany(chunk);
    }

    console.log('Insertion des messages...');
    for (let i = 0; i < allMessages.length; i += chunkSize) {
      const chunk = allMessages.slice(i, i + chunkSize);
      await models.Message.insertMany(chunk);
    }

    console.log(`\n✅ Seed terminé avec succès !`);
    console.log(`   - ${allProperties.length} biens créés`);
    console.log(`   - ${allReservations.length} réservations créées`);
    console.log(`   - ${allMessages.length} messages créés`);
    console.log(`   - 1 admin, ${agents.length} agents, ${clients.length} clients`);
    console.log(`\n📧 Admin: ${config.SEED_ADMIN_EMAIL} / password123`);
    console.log(`👥 Agents: agent1@scim.cg ... agent5@scim.cg / password123`);
    console.log(`👤 Clients: client1@example.com ... client30@example.com / password123`);

  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Déconnecté de MongoDB');
    process.exit(0);
  }
};

seed();

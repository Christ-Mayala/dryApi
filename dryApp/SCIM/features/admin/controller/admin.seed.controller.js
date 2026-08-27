const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sendResponse = require('../../../../../dry/utils/http/response');

const PropertySchema = require('../../property/model/property.schema');
const ReservationSchema = require('../../reservation/model/reservation.schema');
const MessageSchema = require('../../message/model/message.schema');
const UserPublicSchema = require('../../users/model/userPublic.schema');

// ─── Données de référence ────────────────────────────────────────────────────

const SALT_ROUNDS = 10;
const NOW = new Date();

const CITY_DATA = {
  Brazzaville: {
    country: 'CG', lat: -4.2634, lng: 15.2832, multiplier: 1,
    addresses: ['63 bis, rue Moundzombo, Moungali', 'avenue de la Libération, Bacongo', 'boulevard de la Révolution, Ouenzé', 'rue de la Paix, Poto-Poto', 'avenue des Nations Unies, Makelekele', "rue de l'Aéroport, Talangaï"],
  },
  'Pointe-Noire': {
    country: 'CG', lat: -4.7699, lng: 11.8636, multiplier: 0.9,
    addresses: ['avenue de la Marine, Centre-ville', 'rue du Commerce, Loango', 'boulevard du Port, Pointe-Noire'],
  },
  Kinshasa: {
    country: 'CD', lat: -4.4419, lng: 15.2663, multiplier: 0.85,
    addresses: ['avenue du 30 Juin, Gombe', 'boulevard Lumumba, Lingwala', 'rue de la Poste, Barumbu'],
  },
  Dolisie: {
    country: 'CG', lat: -4.2167, lng: 12.6667, multiplier: 0.5,
    addresses: ["rue de l'Indépendance, Centre-ville", 'avenue de la Gare, Dolisie'],
  },
  Oyo: {
    country: 'CG', lat: -1.1333, lng: 15.9833, multiplier: 0.45,
    addresses: ['route de Oyo, Centre-ville', 'avenue de l\'Aéroport, Oyo'],
  },
  Owando: {
    country: 'CG', lat: -0.4833, lng: 15.9167, multiplier: 0.4,
    addresses: ['route de Owando, Centre-ville', 'avenue de la Mission, Owando'],
  },
  Goma: {
    country: 'CD', lat: -1.6586, lng: 29.2203, multiplier: 0.55,
    addresses: ['avenue Kivu, Centre-ville', 'boulevard du Lac, Goma'],
  },
  Lubumbashi: {
    country: 'CD', lat: -11.6876, lng: 27.5026, multiplier: 0.6,
    addresses: ['avenue de la Métallurgie, Centre-ville', 'boulevard Mobutu, Lubumbashi'],
  },
  Douala: {
    country: 'CM', lat: 4.0511, lng: 9.7679, multiplier: 0.75,
    addresses: ['avenue Charles de Gaulle, Centre-ville', 'boulevard de la Liberté, Douala'],
  },
  Yaoundé: {
    country: 'CM', lat: 3.848, lng: 11.5021, multiplier: 0.7,
    addresses: ["avenue de l'Indépendance, Centre-ville", 'boulevard du 20 Mai, Yaoundé'],
  },
  Kribi: {
    country: 'CM', lat: 2.937, lng: 9.9106, multiplier: 0.65,
    addresses: ['route de Kribi, Centre-ville', 'avenue de la Plage, Kribi'],
  },
  Libreville: {
    country: 'GA', lat: 0.4162, lng: 9.4673, multiplier: 0.8,
    addresses: ['avenue du Général de Gaulle, Centre-ville', 'boulevard du Bord de Mer, Libreville'],
  },
  'Port-Gentil': {
    country: 'GA', lat: -0.7167, lng: 8.7833, multiplier: 0.6,
    addresses: ['avenue du Port, Centre-ville', "boulevard de l'Océan, Port-Gentil"],
  },
  Franceville: {
    country: 'GA', lat: -1.6333, lng: 13.5833, multiplier: 0.4,
    addresses: ['route de Franceville, Centre-ville'],
  },
  Moanda: {
    country: 'GA', lat: -1.5667, lng: 13.2, multiplier: 0.35,
    addresses: ['route de Moanda, Centre-ville', 'avenue de la Mine, Moanda'],
  },
};

const PROPERTY_CATEGORIES = ['Appartement', 'Maison', 'Hôtel', 'Terrain', 'Commercial', 'Autre'];

const PROPERTY_NAMES = {
  Appartement: ['Appartement lumineux', 'Appartement moderne', 'Studio meublé', 'Appartement standing', 'Duplex'],
  Maison: ['Villa de luxe', 'Maison familiale', 'Maison avec piscine', 'Villa standing', 'Maison contemporaine'],
  Hôtel: ['Hôtel boutique', 'Hôtel de charme', 'Résidence hôtelière', 'Lodge'],
  Terrain: ['Terrain constructible', 'Terrain agricole', 'Parcelle'],
  Commercial: ['Bureau moderne', 'Local commercial', 'Boutique', 'Entrepôt'],
  Autre: ['Immeuble', 'Résidence', 'Bâtiment administratif'],
};

const ADJECTIVES = ['spacieux', 'calme', 'lumineux', 'récent', 'meublé', 'avec parking', 'proche commodités'];

const BASE_PRICES = {
  Appartement: { location: [150000, 450000], vente: [2500000, 12000000] },
  Maison: { location: [300000, 800000], vente: [5000000, 35000000] },
  Hôtel: { location: [500000, 2000000], vente: [30000000, 120000000] },
  Terrain: { location: [100000, 300000], vente: [1500000, 8000000] },
  Commercial: { location: [250000, 600000], vente: [4000000, 20000000] },
  Autre: { location: [180000, 500000], vente: [3000000, 15000000] },
};

const IMAGE_MAP = {
  Appartement: [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80',
  ],
  Maison: [
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80',
  ],
  Hôtel: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80',
  ],
  Terrain: [
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  ],
  Commercial: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80',
  ],
  Autre: [
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
  ],
};

const CITY_DISTRIBUTION = {
  Brazzaville: 50, 'Pointe-Noire': 30, Kinshasa: 20, Dolisie: 11,
  Oyo: 15, Owando: 4, Goma: 5, Lubumbashi: 8,
  Douala: 10, Yaoundé: 8, Kribi: 5, Libreville: 10,
  'Port-Gentil': 5, Franceville: 4, Moanda: 5,
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const ri = (min, max) => Math.floor(min + Math.random() * (max - min));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

const buildTitle = (city, category, i) =>
  `${pick(PROPERTY_NAMES[category])} ${pick(ADJECTIVES)} — ${city} #${String(i + 1).padStart(3, '0')}`;

const generateAddress = (city) => `${pick(CITY_DATA[city].addresses)}, ${city}`;

const generatePrice = (category, type, city) => {
  const [min, max] = BASE_PRICES[category][type];
  const base = ri(min, max);
  return Math.round((base * CITY_DATA[city].multiplier) / 1000) * 1000;
};

const generateImages = (category, seed) => {
  const urls = IMAGE_MAP[category] || IMAGE_MAP.Autre;
  const count = 2 + ri(0, 3);
  return Array.from({ length: count }, (_, i) => ({
    url: urls[(seed + i) % urls.length],
    public_id: `scim-seed/${category.toLowerCase()}-${seed}-${i}`,
  }));
};

const generateReservations = (property, users) => {
  const count = ri(0, 6);
  const result = [];

  for (let i = 0; i < count; i++) {
    const user = pick(users);
    const daysAgo = ri(1, 240);
    const createdAt = backDate(daysAgo);
    const requestType = pick(['visite', 'location', 'achat']);
    const rand = Math.random();
    const status = rand > 0.6 ? 'confirmee' : rand > 0.4 ? 'annulee' : rand > 0.2 ? 'terminee' : 'en_attente';

    const ref = `RSV-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, '0')}${String(createdAt.getDate()).padStart(2, '0')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const statusHistory = [{ status: 'en_attente', actor: user._id, note: 'Demande créée', source: 'web', at: createdAt }];
    if (status === 'confirmee' || status === 'terminee') {
      statusHistory.push({ status: 'confirmee', actor: user._id, note: 'Réservation confirmée', source: 'web', at: new Date(createdAt.getTime() + ri(1, 3) * 86400000) });
    }
    if (status === 'terminee') {
      statusHistory.push({ status: 'terminee', actor: user._id, note: 'Transaction terminée', source: 'web', at: new Date(createdAt.getTime() + ri(2, 5) * 86400000) });
    }
    if (status === 'annulee') {
      statusHistory.push({ status: 'annulee', actor: user._id, note: 'Annulée par client', source: 'web', at: new Date(createdAt.getTime() + ri(1, 4) * 86400000) });
    }

    result.push({
      property: property._id,
      user: user._id,
      requestType,
      date: createdAt,
      telephone: `+24206${String(ri(1000000, 9999999))}`,
      isWhatsapp: Math.random() > 0.5,
      status,
      statusHistory,
      support: {
        mode: 'web_async',
        reference: ref,
        expectedResponseMinutes: 30,
        reminderAfterMinutes: 30,
        requesterPhone: `+24206${String(ri(1000000, 9999999))}`,
        requesterEmail: user.email,
        confirmedAt: status === 'confirmee' || status === 'terminee' ? new Date(createdAt.getTime() + ri(1, 3) * 86400000) : null,
        acknowledgedAt: status === 'terminee' ? new Date(createdAt.getTime() + ri(2, 5) * 86400000) : null,
        pdfAcknowledged: status === 'terminee',
        pdfEmailedAt: status === 'terminee' ? new Date(createdAt.getTime() + ri(3, 7) * 86400000) : null,
        pdfEmailAttempts: status === 'terminee' ? 1 : 0,
        reminderSentAt: null,
        reminderAttempts: 0,
        lastContactAt: createdAt,
        lastContactChannel: 'email',
        asyncNotice: '',
      },
      createdAt,
      updatedAt: statusHistory[statusHistory.length - 1].at,
    });
  }
  return result;
};

const generateMessages = (property, users, adminUser, reservations) => {
  const messages = [];
  for (const r of reservations.slice(0, 5)) {
    const client = users.find((u) => u._id.equals(r.user));
    if (!client) continue;
    if ((NOW - r.createdAt) / 86400000 > 60) continue;

    messages.push({
      expediteur: client._id,
      destinataire: adminUser._id,
      sujet: `Demande info — ${property.titre}`,
      contenu: `Bonjour, je suis intéressé par ce bien. Peut-on organiser une visite ?`,
      lu: Math.random() > 0.4,
      createdAt: r.createdAt,
    });

    if (Math.random() > 0.5) {
      messages.push({
        expediteur: adminUser._id,
        destinataire: client._id,
        sujet: `Re: Demande info — ${property.titre}`,
        contenu: `Bonjour, merci pour votre intérêt. Voici les informations demandées pour le bien "${property.titre}".`,
        lu: true,
        createdAt: new Date(r.createdAt.getTime() + ri(1, 3) * 86400000),
      });
    }
  }
  return messages;
};

// ─── Controller ──────────────────────────────────────────────────────────────

module.exports = asyncHandler(async (req, res) => {
  // Récupération des modèles sur la connexion SCIMDB
  const Property    = req.getModel('Property',    PropertySchema);
  const Reservation = req.getModel('Reservation', ReservationSchema);
  const Message     = req.getModel('Message',     MessageSchema);
  const User        = req.getModel('User',        UserPublicSchema);

  // ── Nettoyage ──────────────────────────────────────────────────────────────
  await Promise.all([
    Property.deleteMany({}),
    Reservation.deleteMany({}),
    Message.deleteMany({}),
    User.deleteMany({}),
  ]);

  // ── Utilisateurs ───────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('password123', SALT_ROUNDS);

  const admin = await User.create({
    name: 'Admin SCIM', nom: 'Admin SCIM',
    email: 'admin@scim.cg',
    telephone: '+242068457521',
    password: hashedPassword,
    role: 'admin', status: 'active',
  });

  const agents = [];
  for (let i = 1; i <= 5; i++) {
    agents.push(await User.create({
      name: `Agent ${i}`, nom: `Agent ${i}`,
      email: `agent${i}@scim.cg`,
      telephone: `+24206${String(ri(1000000, 9999999))}`,
      password: hashedPassword,
      role: 'agent', status: 'active',
    }));
  }

  const firstNames = ['Jean', 'Marie', 'Pierre', 'Aminata', 'Kofi', 'Fatou', 'Moussa', 'Aisha', 'Blaise', 'Grace', 'Luc', 'Sara', 'Paul', 'Nathalie', 'David'];
  const lastNames  = ['Mbeki', 'Diallo', 'Moungou', 'Obame', 'Ndong', 'Kouassi', 'Traoré', 'Keita', 'Sow', 'Diop', 'Nku', 'Mvogo', 'Atangana', 'Mba', 'Essono'];

  const clients = [];
  for (let i = 1; i <= 30; i++) {
    clients.push(await User.create({
      name: `${pick(firstNames)} ${pick(lastNames)}`,
      nom: `${pick(firstNames)} ${pick(lastNames)}`,
      email: `client${i}@example.com`,
      telephone: `+242${ri(4, 7)}${String(ri(1000000, 9999999))}`,
      password: hashedPassword,
      role: 'client', status: 'active',
    }));
  }

  // ── Biens + réservations + messages ───────────────────────────────────────
  const allReservations = [];
  const allMessages     = [];
  let propertyCount     = 0;
  let propertyIndex     = 0;

  const CHUNK = 500;

  for (const [city, count] of Object.entries(CITY_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) {
      const category       = pick(PROPERTY_CATEGORIES);
      const transactionType = Math.random() > 0.4 ? 'vente' : 'location';
      const seedVal         = ++propertyIndex;
      const createdAt       = backDateMonths(ri(0, 8));

      const property = await Property.create({
        titre:         buildTitle(city, category, i),
        description:   `Bien immobilier situé à ${city}. ${category} ${transactionType === 'vente' ? 'à vendre' : 'à louer'}. Proche de toutes commodités.`,
        prix:          generatePrice(category, transactionType, city),
        ville:         city,
        adresse:       generateAddress(city),
        status:        Math.random() > 0.15 ? 'active' : 'inactive',
        transactionType,
        categorie:     category,
        images:        generateImages(category, seedVal),
        utilisateur:   admin._id,
        adminReference: admin._id,
        submittedByUser: Math.random() > 0.7 ? pick(clients)._id : admin._id,
        submissionSource: Math.random() > 0.7 ? 'client_submission' : 'admin_direct',
        nombre_chambres:    category === 'Appartement' ? ri(1, 4) : category === 'Maison' ? ri(2, 6) : category === 'Hôtel' ? ri(10, 50) : 0,
        nombre_salles_bain: category === 'Appartement' ? ri(1, 3) : category === 'Maison' ? ri(1, 4) : 0,
        nombre_salons:      category === 'Appartement' ? ri(1, 2) : category === 'Maison' ? ri(1, 3) : 0,
        superficie:    category === 'Terrain' ? ri(200, 5000) : ri(40, 500),
        garage:  category === 'Maison' && Math.random() > 0.3,
        gardien: Math.random() > 0.6,
        balcon:  category === 'Appartement' && Math.random() > 0.4,
        piscine: category === 'Maison' && Math.random() > 0.7,
        jardin:  category === 'Maison' && Math.random() > 0.5,
        noteMoyenne: ri(30, 50) / 10,
        nombreAvis: ri(0, 20),
        vues: ri(10, 500),
        evaluations: Array.from({ length: ri(0, 8) }, () => ({
          utilisateur: pick(clients)._id,
          note: ri(3, 6),
          creeLe: backDate(ri(1, 180)),
        })),
        createdAt,
        updatedAt: createdAt,
      });

      propertyCount++;
      const reservations = generateReservations(property, clients);
      allReservations.push(...reservations);
      allMessages.push(...generateMessages(property, clients, admin, reservations));
    }
  }

  // Insertion par chunks
  for (let i = 0; i < allReservations.length; i += CHUNK) {
    await Reservation.insertMany(allReservations.slice(i, i + CHUNK));
  }
  for (let i = 0; i < allMessages.length; i += CHUNK) {
    await Message.insertMany(allMessages.slice(i, i + CHUNK));
  }

  return sendResponse(res, {
    biens:        propertyCount,
    reservations: allReservations.length,
    messages:     allMessages.length,
    utilisateurs: { admin: 1, agents: agents.length, clients: clients.length },
    credentials: {
      admin:   'admin@scim.cg / password123',
      agents:  'agent1@scim.cg ... agent5@scim.cg / password123',
      clients: 'client1@example.com ... client30@example.com / password123',
    },
  }, '✅ Seed SCIM terminé avec succès');
});

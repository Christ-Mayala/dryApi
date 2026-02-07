const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;

  // ===== System Settings =====
  const settingsSchema = require('./features/admin/model/systemSettings.schema.js');
  const SystemSettings = getModel(appName, 'SystemSettings', settingsSchema);
  const settingsDocs = [
    { key: 'siteName', value: 'SCIM Immobilier' },
    { key: 'siteDescription', value: 'Plateforme immobiliere' },
    { key: 'maintenanceMode', value: false },
    { key: 'allowRegistration', value: true },
    { key: 'currency', value: 'XAF' },
    { key: 'language', value: 'fr' },
  ];
  const settingsCreated = await SystemSettings.insertMany(settingsDocs);
  count += settingsCreated.length;
  await logSeed({
    appName,
    feature: 'admin',
    modelName: 'SystemSettings',
    schemaPath: path.join(__dirname, 'features', 'admin', 'model', 'systemSettings.schema.js'),
    ids: settingsCreated.map((d) => d._id),
  });

  // ===== Users (modele central) =====
  const User = getModel(appName, 'User');
  const userDocs = [
    {
      name: 'Admin SCIM',
      nom: 'Admin',
      email: 'admin@scim.local',
      telephone: '+242060000001',
      password: 'Admin@2026',
      role: 'admin',
    },
    {
      name: 'Maya',
      nom: 'Gottlieb',
      email: 'mayalachristgottlieb@gmail.com',
      telephone: '+242060000002',
      password: 'User@2026',
      role: 'user',
    },
    {
      name: 'Client',
      nom: 'Investisseur',
      email: 'client@scim.local',
      telephone: '+242060000003',
      password: 'User@2026',
      role: 'user',
    },
  ];

  const userIds = [];
  for (const doc of userDocs) {
    const existing = await User.findOne({ email: doc.email });
    if (!existing) {
      const created = await User.create(doc);
      userIds.push(created._id);
      count += 1;
    } else {
      userIds.push(existing._id);
    }
  }

  await logSeed({
    appName,
    feature: 'users',
    modelName: 'User',
    schemaPath: path.join(__dirname, '..', '..', 'dry', 'modules', 'user', 'user.schema.js'),
    ids: userIds,
  });

  // ===== Properties =====
  const propertySchema = require('./features/property/model/property.schema.js');
  const Property = getModel(appName, 'Property', propertySchema);
  const propertyDocs = [
    {
      titre: 'Appartement moderne centre ville',
      description: 'Appartement lumineux, proche commerces et ecoles.',
      prix: 45000000,
      ville: 'Brazzaville',
      adresse: 'Avenue de la Paix, Bloc A',
      transactionType: 'location',
      categorie: 'Appartement',
      devise: 'XAF',
      isBonPlan: true,
      bonPlanLabel: 'Remise 10%',
      bonPlanExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      nombre_chambres: 2,
      nombre_salles_bain: 1,
      superficie: 85,
      utilisateur: userIds[0],
    },
    {
      titre: 'Maison familiale avec jardin',
      description: 'Maison spacieuse, quartier calme, jardin prive.',
      prix: 120000000,
      ville: 'Pointe-Noire',
      adresse: 'Quartier Mpita, Rue 12',
      transactionType: 'vente',
      categorie: 'Maison',
      devise: 'XAF',
      isBonPlan: false,
      nombre_chambres: 4,
      nombre_salles_bain: 2,
      superficie: 210,
      jardin: true,
      utilisateur: userIds[1],
    },
  ];

  const propertyCreated = await Property.insertMany(propertyDocs);
  count += propertyCreated.length;
  await logSeed({
    appName,
    feature: 'property',
    modelName: 'Property',
    schemaPath: path.join(__dirname, 'features', 'property', 'model', 'property.schema.js'),
    ids: propertyCreated.map((d) => d._id),
  });

  // ===== Messages =====
  const messageSchema = require('./features/message/model/message.schema.js');
  const Message = getModel(appName, 'Message', messageSchema);
  const messageDocs = [
    {
      expediteur: userIds[1],
      destinataire: userIds[0],
      contenu: 'Bonjour, je souhaite visiter l\'appartement du centre-ville.',
    },
    {
      expediteur: userIds[2],
      destinataire: userIds[0],
      contenu: 'Le bien a Pointe-Noire est-il toujours disponible ?',
    },
  ];
  const messageCreated = await Message.insertMany(messageDocs);
  count += messageCreated.length;
  await logSeed({
    appName,
    feature: 'message',
    modelName: 'Message',
    schemaPath: path.join(__dirname, 'features', 'message', 'model', 'message.schema.js'),
    ids: messageCreated.map((d) => d._id),
  });

  // ===== Reservations =====
  const reservationSchema = require('./features/reservation/model/reservation.schema.js');
  const Reservation = getModel(appName, 'Reservation', reservationSchema);
  const reservationDocs = [
    {
      property: propertyCreated[0]._id,
      user: userIds[1],
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'en attente',
    },
    {
      property: propertyCreated[1]._id,
      user: userIds[2],
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'en attente',
    },
  ];
  const reservationCreated = await Reservation.insertMany(reservationDocs);
  count += reservationCreated.length;
  await logSeed({
    appName,
    feature: 'reservation',
    modelName: 'Reservation',
    schemaPath: path.join(__dirname, 'features', 'reservation', 'model', 'reservation.schema.js'),
    ids: reservationCreated.map((d) => d._id),
  });

  return { count };
};

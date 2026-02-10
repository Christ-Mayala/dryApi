const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
  // biens
  const biensSchema = require('./features/biens/model/biens.schema');
  const Bien = getModel(appName, 'Bien', biensSchema);
  const biensDocs = [
  {
    titre: 'exemple_titre_' + index,
    description: 'exemple_description_' + index,
    prix: 'exemple_prix_' + index,
    type: 'exemple_type_' + index,
    surface: 'exemple_surface_' + index,
    chambres: 'exemple_chambres_' + index,
    sallesDeBain: 'exemple_sallesDeBain_' + index,
    adresse: 'exemple_adresse_' + index,
    ville: 'exemple_ville_' + index,
    codePostal: 'exemple_codePostal_' + index,
    disponible: 'exemple_disponible_' + index,
    label: `Exemple biens ${index}`
  },
  {
    titre: 'exemple_titre_' + index,
    description: 'exemple_description_' + index,
    prix: 'exemple_prix_' + index,
    type: 'exemple_type_' + index,
    surface: 'exemple_surface_' + index,
    chambres: 'exemple_chambres_' + index,
    sallesDeBain: 'exemple_sallesDeBain_' + index,
    adresse: 'exemple_adresse_' + index,
    ville: 'exemple_ville_' + index,
    codePostal: 'exemple_codePostal_' + index,
    disponible: 'exemple_disponible_' + index,
    label: `Exemple biens ${index}`
  },
  {
    titre: 'exemple_titre_' + index,
    description: 'exemple_description_' + index,
    prix: 'exemple_prix_' + index,
    type: 'exemple_type_' + index,
    surface: 'exemple_surface_' + index,
    chambres: 'exemple_chambres_' + index,
    sallesDeBain: 'exemple_sallesDeBain_' + index,
    adresse: 'exemple_adresse_' + index,
    ville: 'exemple_ville_' + index,
    codePostal: 'exemple_codePostal_' + index,
    disponible: 'exemple_disponible_' + index,
    label: `Exemple biens ${index}`
  }
  ];
  const biensCreated = await Bien.insertMany(biensDocs);
  count += biensCreated.length;
  await logSeed({
    appName,
    feature: 'biens',
    modelName: 'Bien',
    schemaPath: path.join(__dirname, 'features', 'biens', 'model', 'biens.schema.js'),
    ids: biensCreated.map((d) => d._id),
  });

  // visites
  const visitesSchema = require('./features/visites/model/visites.schema');
  const Visite = getModel(appName, 'Visite', visitesSchema);
  const visitesDocs = [
  {
    bienId: 'exemple_bienId_' + index,
    clientId: 'exemple_clientId_' + index,
    dateVisite: 'exemple_dateVisite_' + index,
    statut: 'exemple_statut_' + index,
    commentaire: 'exemple_commentaire_' + index,
    label: `Exemple visites ${index}`
  },
  {
    bienId: 'exemple_bienId_' + index,
    clientId: 'exemple_clientId_' + index,
    dateVisite: 'exemple_dateVisite_' + index,
    statut: 'exemple_statut_' + index,
    commentaire: 'exemple_commentaire_' + index,
    label: `Exemple visites ${index}`
  },
  {
    bienId: 'exemple_bienId_' + index,
    clientId: 'exemple_clientId_' + index,
    dateVisite: 'exemple_dateVisite_' + index,
    statut: 'exemple_statut_' + index,
    commentaire: 'exemple_commentaire_' + index,
    label: `Exemple visites ${index}`
  }
  ];
  const visitesCreated = await Visite.insertMany(visitesDocs);
  count += visitesCreated.length;
  await logSeed({
    appName,
    feature: 'visites',
    modelName: 'Visite',
    schemaPath: path.join(__dirname, 'features', 'visites', 'model', 'visites.schema.js'),
    ids: visitesCreated.map((d) => d._id),
  });

  // clients
  const clientsSchema = require('./features/clients/model/clients.schema');
  const Client = getModel(appName, 'Client', clientsSchema);
  const clientsDocs = [
  {
    nom: 'exemple_nom_' + index,
    email: `demo+${Date.now()}@example.com`,
    telephone: '+22501020304',
    budget: 'exemple_budget_' + index,
    recherche: 'exemple_recherche_' + index,
    label: `Exemple clients ${index}`
  },
  {
    nom: 'exemple_nom_' + index,
    email: `demo+${Date.now()}@example.com`,
    telephone: '+22501020304',
    budget: 'exemple_budget_' + index,
    recherche: 'exemple_recherche_' + index,
    label: `Exemple clients ${index}`
  },
  {
    nom: 'exemple_nom_' + index,
    email: `demo+${Date.now()}@example.com`,
    telephone: '+22501020304',
    budget: 'exemple_budget_' + index,
    recherche: 'exemple_recherche_' + index,
    label: `Exemple clients ${index}`
  }
  ];
  const clientsCreated = await Client.insertMany(clientsDocs);
  count += clientsCreated.length;
  await logSeed({
    appName,
    feature: 'clients',
    modelName: 'Client',
    schemaPath: path.join(__dirname, 'features', 'clients', 'model', 'clients.schema.js'),
    ids: clientsCreated.map((d) => d._id),
  });

  return { count };
};

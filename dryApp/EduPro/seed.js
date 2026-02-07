const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
  // etudiants
  const etudiantsSchema = require('./features/etudiants/model/etudiants.schema');
  const Etudiant = getModel(appName, 'Etudiant', etudiantsSchema);
  const etudiantsDocs = [
  {
    nom: 'exemple_nom_' + index,
    prenom: 'exemple_prenom_' + index,
    email: `demo+${Date.now()}@example.com`,
    telephone: '+22501020304',
    niveau: 'exemple_niveau_' + index,
    label: `Exemple etudiants ${index}`
  },
  {
    nom: 'exemple_nom_' + index,
    prenom: 'exemple_prenom_' + index,
    email: `demo+${Date.now()}@example.com`,
    telephone: '+22501020304',
    niveau: 'exemple_niveau_' + index,
    label: `Exemple etudiants ${index}`
  },
  {
    nom: 'exemple_nom_' + index,
    prenom: 'exemple_prenom_' + index,
    email: `demo+${Date.now()}@example.com`,
    telephone: '+22501020304',
    niveau: 'exemple_niveau_' + index,
    label: `Exemple etudiants ${index}`
  }
  ];
  const etudiantsCreated = await Etudiant.insertMany(etudiantsDocs);
  count += etudiantsCreated.length;
  await logSeed({
    appName,
    feature: 'etudiants',
    modelName: 'Etudiant',
    schemaPath: path.join(__dirname, 'features', 'etudiants', 'model', 'etudiants.schema.js'),
    ids: etudiantsCreated.map((d) => d._id),
  });

  // cours
  const coursSchema = require('./features/cours/model/cours.schema');
  const Cours = getModel(appName, 'Cours', coursSchema);
  const coursDocs = [
  {
    titre: 'exemple_titre_' + index,
    description: 'exemple_description_' + index,
    niveau: 'exemple_niveau_' + index,
    duree: 'exemple_duree_' + index,
    prix: 'exemple_prix_' + index,
    label: `Exemple cours ${index}`
  },
  {
    titre: 'exemple_titre_' + index,
    description: 'exemple_description_' + index,
    niveau: 'exemple_niveau_' + index,
    duree: 'exemple_duree_' + index,
    prix: 'exemple_prix_' + index,
    label: `Exemple cours ${index}`
  },
  {
    titre: 'exemple_titre_' + index,
    description: 'exemple_description_' + index,
    niveau: 'exemple_niveau_' + index,
    duree: 'exemple_duree_' + index,
    prix: 'exemple_prix_' + index,
    label: `Exemple cours ${index}`
  }
  ];
  const coursCreated = await Cours.insertMany(coursDocs);
  count += coursCreated.length;
  await logSeed({
    appName,
    feature: 'cours',
    modelName: 'Cours',
    schemaPath: path.join(__dirname, 'features', 'cours', 'model', 'cours.schema.js'),
    ids: coursCreated.map((d) => d._id),
  });

  // inscriptions
  const inscriptionsSchema = require('./features/inscriptions/model/inscriptions.schema');
  const Inscription = getModel(appName, 'Inscription', inscriptionsSchema);
  const inscriptionsDocs = [
  {
    etudiantId: 'exemple_etudiantId_' + index,
    coursId: 'exemple_coursId_' + index,
    dateInscription: 'exemple_dateInscription_' + index,
    statut: 'exemple_statut_' + index,
    label: `Exemple inscriptions ${index}`
  },
  {
    etudiantId: 'exemple_etudiantId_' + index,
    coursId: 'exemple_coursId_' + index,
    dateInscription: 'exemple_dateInscription_' + index,
    statut: 'exemple_statut_' + index,
    label: `Exemple inscriptions ${index}`
  },
  {
    etudiantId: 'exemple_etudiantId_' + index,
    coursId: 'exemple_coursId_' + index,
    dateInscription: 'exemple_dateInscription_' + index,
    statut: 'exemple_statut_' + index,
    label: `Exemple inscriptions ${index}`
  }
  ];
  const inscriptionsCreated = await Inscription.insertMany(inscriptionsDocs);
  count += inscriptionsCreated.length;
  await logSeed({
    appName,
    feature: 'inscriptions',
    modelName: 'Inscription',
    schemaPath: path.join(__dirname, 'features', 'inscriptions', 'model', 'inscriptions.schema.js'),
    ids: inscriptionsCreated.map((d) => d._id),
  });

  return { count };
};

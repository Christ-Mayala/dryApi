/**
 * Charge la configuration d'environnement pour les tests.
 *
 * Priorité à .env.test (base de données isolée dédiée aux tests) — sinon,
 * bascule sur .env avec un avertissement explicite, car .env pointe vers
 * l'infrastructure de production (cluster MongoDB Atlas partagé avec les
 * apps déployées). Sans .env.test, les seeders et suites d'intégration
 * s'exécutent contre les vraies données.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ROOT = path.join(__dirname, '..', '..');
const testEnvPath = path.join(ROOT, '.env.test');

if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath });
} else {
  console.warn(
    '\n⚠️  Aucun .env.test trouvé — les tests vont utiliser .env, qui pointe ' +
    'vers l\'infrastructure de PRODUCTION (cluster MongoDB Atlas partagé). ' +
    'Créez un .env.test avec un MONGO_URI isolé (base/cluster de test) pour ' +
    'éviter tout risque sur les données réelles. Voir .env.test.example.\n'
  );
  dotenv.config();
}

/**
 * Setup Jest — DRY API Framework
 * Configure les variables d'environnement et les helpers globaux pour les tests
 */

// Charger dotenv pour les tests
require('dotenv').config({ path: '.env.test', silent: true });

// Définir l'environnement de test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_that_is_long_enough_for_ci_123456';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test_session_secret_that_is_long_enough_for_ci_123456';
process.env.REDIS_ENABLED = 'false';
process.env.LOG_REQUESTS = 'false';
process.env.EMAIL_PROVIDER = 'mock';

// Timeout global pour les tests
jest.setTimeout(30000);

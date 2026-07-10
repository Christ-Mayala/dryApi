/**
 * Setup Jest — DRY API Framework
 * Configure les variables d'environnement et les helpers globaux pour les tests
 */

// Volontairement PAS de chargement de .env.test ici : les tests unitaires
// doivent rester hermétiques et reproductibles sur toute machine, qu'un
// .env.test local existe ou non. Si un .env.test réel définit des clés
// _TEST (MONGO_URI_TEST, JWT_SECRET_TEST, ...), elles prendraient le pas
// sur les valeurs que readSetting() attend en mode test, et casseraient les
// tests qui manipulent process.env directement (voir tests/unit/config).
// .env.test reste utile pour test:integration/e2e/smoke (voir
// scripts/tests/loadTestEnv.js et docs/04_TESTING_GUIDE.md).

// Définir l'environnement de test
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dryapi_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_that_is_long_enough_for_ci_123456';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test_session_secret_that_is_long_enough_for_ci_123456';
process.env.SYSTEM_PASSWORD = process.env.SYSTEM_PASSWORD || 'test_system_password_ci';
process.env.REDIS_ENABLED = 'false';
process.env.LOG_REQUESTS = 'false';
process.env.EMAIL_PROVIDER = 'mock';

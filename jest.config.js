/**
 * Configuration Jest — DRY API Framework
 * Tests unitaires + intégration avec MongoDB en mémoire
 * @see https://jestjs.io/docs/configuration
 */

module.exports = {
  // Environnement Node (pas de DOM)
  testEnvironment: 'node',

  // Racine des tests
  roots: ['<rootDir>/tests'],

  // Patterns des fichiers de test
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js',
  ],

  // Ignorer node_modules et les helpers
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/_helpers/',
  ],

  // Coverage
  collectCoverageFrom: [
    'dry/**/*.js',
    'config/**/*.js',
    '!dry/**/*.test.js',
    '!dry/**/__tests__/**',
    '!dry/bootstrap/**',
    '!dry/core/application/**',
    '!dry/services/alert/**',
    '!dry/services/notification/**',
    '!dry/templates/**',
  ],

  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 70,
      statements: 70,
    },
    'dry/middlewares/': {
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },

  // Setup avant chaque fichier de test
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterFramework: [],
  injectGlobals: true,

  // Timeout par défaut pour les tests d'intégration (30s)
  testTimeout: 30000,

  // Verbosité
  verbose: true,

  // Forcer la sortie après les tests (CI)
  forceExit: true,

  // Nettoyer les mocks entre les tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,

  // Sérialisation
  snapshotSerializers: [],

  // Transform (gérer les modules ESM si nécessaire)
  // transform: {},

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
};

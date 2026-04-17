const globals = require('globals');

module.exports = [
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'logs/**',
      'node_modules/**',
      'downloads/**',
      'generated/**',
      'api.config.js',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'always'],
    },
  },
];

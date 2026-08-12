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
      'frontend/**',
      'dry/ui/**',
      'api.config.js',
      // Worktrees kilo/codex : copies de travail d'autres sessions, pas des
      // sources du projet (ES modules / JSX non gérés par la config commonjs).
      // Déjà exclus de git via .git/info/exclude — on les exclut aussi du lint.
      '.kilo/**',
      '.kilocode/**',
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
      'no-unused-vars': 'off',
    },
  },
];

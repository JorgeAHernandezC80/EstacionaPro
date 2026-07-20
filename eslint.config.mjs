import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        IntersectionObserver: 'readonly',
        localStorage: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: 'error',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['server.js', 'db.js', 'config.js', 'pricing.js', 'validation.js', 'tests/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'readonly', process: 'readonly', __dirname: 'readonly' },
    },
  },
];

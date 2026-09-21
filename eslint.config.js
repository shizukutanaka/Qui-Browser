const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'indent': ['error', 2],
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': ['warn', {
        allow: ['warn', 'error', 'info']
      }],
      'no-debugger': 'warn',
      'no-alert': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'warn',
      'arrow-spacing': 'error',
      'no-duplicate-imports': 'error',
      'no-useless-constructor': 'error',
      'no-useless-return': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }],
      'keyword-spacing': 'error',
      'space-infix-ops': 'error',
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'max-len': ['warn', {
        code: 120,
        ignoreComments: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true
      }],
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-iterator': 'error',
      'no-proto': 'error'
    }
  },
  {
    files: ['tests/**/*.test.js', '**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-unused-expressions': 'off',
      // Test fixtures legitimately hand javascript: URLs to scheme-blockers
      // and control-char regexes to non-ASCII checks.
      'no-script-url': 'off',
      'no-control-regex': 'off',
      // Mock factories are deliberately function() — the harness `new`s them.
      'prefer-arrow-callback': 'off'
    }
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      'build/',
      // Archived legacy code is history, not live source (same exclusion
      // class doc-references.test.js already applies).
      'docs/archive/',
      // Vendored third-party binaries (three.js basis transcoder).
      'public/libs/'
    ]
  }
];

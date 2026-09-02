/**
 * ESLint flat configuration.
 *
 * Why this file exists: package.json has declared eslint ^9.39.0 for some
 * time, and ESLint 9 refuses `.eslintrc.json` outright — it exits 2 with
 * "couldn't find an eslint.config.(js|mjs|cjs)" before linting anything. CI
 * hid that behind `continue-on-error: true` on the ESLint step, so `npm run
 * lint` had been failing there while reporting clean locally, where a stale
 * node_modules still held eslint 8.57.1. Measured both ways before writing
 * this: `npm ci` installs 9.39.5, and lint then fails identically to CI.
 *
 * This is a faithful translation of the .eslintrc.json it replaces — same
 * rules, same severities, same options — so the standard being enforced does
 * not quietly change along with the config format. The two differences are
 * mechanical, both required by flat config:
 *   - `env` is gone; browser/node/jest globals come from the `globals`
 *     package, which ships with ESLint.
 *   - files/ignores are explicit rather than implied by CLI arguments.
 */

const js = require('@eslint/js');
const globals = require('globals');

/** Platform globals the type checker cannot infer from source. */
const PROJECT_GLOBALS = {
  THREE: 'readonly',
  XRSession: 'readonly',
  XRReferenceSpace: 'readonly',
  XRFrame: 'readonly',
  XRInputSource: 'readonly',
  GPUShaderStage: 'readonly',
  GPUTextureUsage: 'readonly',
  GPUBufferUsage: 'readonly',
  GPUMapMode: 'readonly',
  GPUValidationError: 'readonly',
  GPUOutOfMemoryError: 'readonly'
};

module.exports = [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'docs/archive/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        ...PROJECT_GLOBALS
      }
    },
    rules: {
      'indent': ['error', 2],
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
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
    // CommonJS: the test suite and the repo's own tooling configs.
    files: ['tests/**/*.js', '*.config.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs' }
  },
  {
    files: ['**/*.test.js', '**/*.spec.js'],
    rules: { 'no-unused-expressions': 'off' }
  }
];

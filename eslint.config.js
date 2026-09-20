/**
 * ESLint flat config (migrated from .eslintrc.json for ESLint 9).
 */
import globals from 'globals';
import js from '@eslint/js';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'proxy/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        THREE: 'readonly',
        XRSession: 'readonly',
        XRReferenceSpace: 'readonly',
        XRFrame: 'readonly',
        XRInputSource: 'readonly',
      }
    },
    rules: {
        'no-unreachable': 'error',
        'no-useless-catch': 'error',
        'no-useless-return': 'error',
        'no-unused-private-class-members': 'error',
        'prefer-const': 'error',
      'indent': ['error', 2],
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'semi': ['error', 'always'],
      'no-unused-vars': ['warn', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
      'no-console': ['warn', {
        'allow': ['warn', 'error', 'info']
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
        'anonymous': 'always',
        'named': 'never',
        'asyncArrow': 'always'
      }],
      'keyword-spacing': 'error',
      'space-infix-ops': 'error',
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'max-len': ['warn', {
        'code': 120,
        'ignoreComments': true,
        'ignoreStrings': true,
        'ignoreTemplateLiterals': true
      }],
      'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-iterator': 'error',
      'no-proto': 'error'
    }
  },
  {
    files: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
    rules: {
      'no-unused-expressions': 'off'
    }
  }
];

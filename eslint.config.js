import js from '@eslint/js';
import globals from 'globals';

// WebXR / WebGPU globals the eslintrc config declared by hand. The W3C specs
// add these at runtime; they are never imported.
const webxrGlobals = {
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

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        ...globals.es2021,
        ...webxrGlobals
      }
    },
    rules: {
      // `indent` intentionally absent: prettier owns indentation; the legacy
      // eslintrc rule conflicted with prettier output on continuation lines.
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
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
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      'keyword-spacing': 'error',
      'space-infix-ops': 'error',
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'max-len': ['warn', { code: 120, ignoreComments: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
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
    // The eslintrc override used "*.test.js" — relative to the repo root it only
    // matched root-level files, so it never fired. Tests live in tests/.
    files: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
    rules: {
      'no-unused-expressions': 'off'
    }
  }
];

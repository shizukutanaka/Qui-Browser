module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true,
    worker: true,
    webextensions: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  globals: {
    // WebXR API
    XRSession: 'readonly',
    XRReferenceSpace: 'readonly',
    XRFrame: 'readonly',
    XRInputSource: 'readonly',
    XRRigidTransform: 'readonly',
    XRWebGLLayer: 'readonly',
    XRSystem: 'readonly',

    // Browser globals
    chrome: 'readonly',
    browser: 'readonly',

    // VR specific
    VRDisplay: 'readonly',
    VRFrameData: 'readonly',
    VRPose: 'readonly',

    // Stripe
    Stripe: 'readonly',

    // UI Components
    UIComponents: 'readonly'
  },
  rules: {
    // Console rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: true,
        argsIgnorePattern: '^_'
      }
    ],
    'prefer-const': 'error',
    'no-var': 'error',

    // Security rules - strict
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-with': 'error',
    'no-proto': 'error',
    'no-iterator': 'error',
    'no-caller': 'error',

    // Performance rules
    'no-await-in-loop': 'warn',
    'no-constant-condition': 'error',
    'no-dupe-keys': 'error',
    'no-unreachable': 'error',

    // Code quality - strict
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    curly: ['error', 'all'],
    'no-alert': 'error',
    'no-shadow': 'error',
    'no-use-before-define': ['error', { functions: false, classes: true }],

    // Best practices
    'no-magic-numbers': ['warn', { ignore: [-1, 0, 1, 2], ignoreArrayIndexes: true }],
    'no-return-await': 'warn',
    'require-await': 'warn',

    // Code style
    'comma-dangle': ['warn', 'only-multiline'],
    'max-len': ['warn', { code: 120, ignoreUrls: true, ignoreStrings: true }],
    'max-depth': ['warn', 4],
    'max-nested-callbacks': ['warn', 3],
    'complexity': ['warn', 15],

    // Off for compatibility
    camelcase: 'off',
    'no-underscore-dangle': 'off',
    'class-methods-use-this': 'off'
  },
  overrides: [
    {
      files: ['test/**/*.js', '**/*.test.js', '**/*.spec.js'],
      env: {
        mocha: true,
        jest: true
      },
      rules: {
        'no-unused-expressions': 'off',
        'prefer-arrow-callback': 'off',
        'func-names': 'off'
      }
    },
    {
      files: ['extensions/**/*.js'],
      globals: {
        chrome: 'readonly',
        browser: 'readonly'
      }
    }
  ]
};

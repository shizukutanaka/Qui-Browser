/**
 * Jest Configuration for Qui Browser VR
 */

module.exports = {
  // テスト環境
  testEnvironment: 'node',

  // テストファイルのパターン
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],

  // カバレッジ収集対象
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],

  // カバレッジディレクトリ
  coverageDirectory: 'coverage',

  // カバレッジレポーター
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],

  // カバレッジ閾値 — raised from 0 after adding test suites for TextureManager,
  // ComfortSystem, HapticFeedback, and monitoring. Current baseline: ~28% lines.
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 25,
      lines: 25,
      statements: 25
    }
  },

  // モックのクリア
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // タイムアウト
  testTimeout: 10000,

  // Verbose出力
  verbose: true,

  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // グローバル変数
  globals: {
    'NODE_ENV': 'test',
    'VR_BROWSER_VERSION': '2.0.0'
  },

  // モジュール名マッパー（パスエイリアス）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',
    '^@js/(.*)$': '<rootDir>/assets/js/$1'
  },

  // 無視するパス
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.git/',
    '/tests/archive/'
  ],

  // トランスフォーム
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // トランスフォーム無視
  transformIgnorePatterns: [
    'node_modules/(?!(three)/)'
  ]
};

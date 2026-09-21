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

  // カバレッジ閾値 — ratchet per docs/TESTING.md: set just under the measured
  // baseline (95.9% stmts / 83.2% branch / 92.7% funcs / 96.1% lines) so a
  // coverage regression fails the gate instead of silently landing.
  coverageThreshold: {
    global: {
      branches: 81,
      functions: 90,
      lines: 94,
      statements: 93
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

  // 無視するパス
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.git/'
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

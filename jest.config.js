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
    'lcov',
    // ci.yml's Codecov step uploads ./coverage/coverage-final.json — without
    // the 'json' reporter the file is never emitted and the upload no-ops.
    'json'
  ],

  // カバレッジ閾値 — ratchet per docs/TESTING.md: keep the floor just under
  // the measured suite coverage so a regression fails the gate instead of
  // silently landing. When coverage improves, raise these values to match.
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 96,
      lines: 97,
      statements: 96
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

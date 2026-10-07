/**
 * Jest Configuration for Qui Browser VR
 */

module.exports = {
  // テスト環境
  testEnvironment: 'node',

  // テストファイルのパターン
  testMatch: ['**/tests/**/*.test.js'],

  // カバレッジ収集対象
  collectCoverageFrom: ['src/**/*.js'],

  // カバレッジディレクトリ
  coverageDirectory: 'coverage',

  // カバレッジレポーター
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],

  // カバレッジ閾値 — enforced by CI (ci.yml runs npm test -- --coverage).
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

  // 無視するパス
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.git/'],

  // トランスフォーム
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // トランスフォーム無視
  transformIgnorePatterns: ['node_modules/(?!(three)/)']
};

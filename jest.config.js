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
    'assets/js/vr-*.js',
    '!assets/js/**/*.min.js',
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

  // カバレッジ閾値
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
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
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

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

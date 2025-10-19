# テストガイド / Testing Guide

Qui Browser VR の包括的なテストガイドです。
*Comprehensive testing guide for Qui Browser VR.*

---

## 📋 目次 / Table of Contents

1. [テスト戦略 / Testing Strategy](#テスト戦略--testing-strategy)
2. [セットアップ / Setup](#セットアップ--setup)
3. [ユニットテスト / Unit Tests](#ユニットテスト--unit-tests)
4. [統合テスト / Integration Tests](#統合テスト--integration-tests)
5. [E2Eテスト / E2E Tests](#e2eテスト--e2e-tests)
6. [VRデバイステスト / VR Device Testing](#vrデバイステスト--vr-device-testing)
7. [パフォーマンステスト / Performance Testing](#パフォーマンステスト--performance-testing)
8. [アクセシビリティテスト / Accessibility Testing](#アクセシビリティテスト--accessibility-testing)
9. [CI/CD統合 / CI/CD Integration](#cicd統合--cicd-integration)
10. [カバレッジ / Coverage](#カバレッジ--coverage)

---

## テスト戦略 / Testing Strategy

### テストピラミッド / Test Pyramid

```
        /\
       /  \      E2E Tests (10%)
      /----\     - VRデバイステスト / VR device testing
     /      \    - ブラウザテスト / Browser testing
    /--------\
   /          \  Integration Tests (30%)
  /------------\ - VRモジュール統合 / VR module integration
 /              \- WebXR API統合 / WebXR API integration
/----------------\
|  Unit Tests    | Unit Tests (60%)
|  (60%)         | - 個別モジュール / Individual modules
|                | - ユーティリティ関数 / Utility functions
------------------
```

### テストのカテゴリ / Test Categories

1. **ユニットテスト / Unit Tests**
   - 個別のVRモジュールのテスト
   - ユーティリティ関数のテスト
   - 計算ロジックのテスト

2. **統合テスト / Integration Tests**
   - モジュール間の連携テスト
   - WebXR APIとの統合テスト
   - Three.jsとの統合テスト

3. **E2Eテスト / End-to-End Tests**
   - ユーザーフロー全体のテスト
   - VRセッション開始から終了までのテスト
   - 実際のVRデバイスでのテスト

4. **パフォーマンステスト / Performance Tests**
   - FPS測定
   - メモリ使用量
   - ロード時間

5. **アクセシビリティテスト / Accessibility Tests**
   - WCAG準拠チェック
   - コントラスト比
   - キーボードナビゲーション

---

## セットアップ / Setup

### 前提条件 / Prerequisites

```bash
# Node.js とnpm がインストール済み
node --version  # v18+ 推奨
npm --version   # v9+ 推奨
```

### テストフレームワークのインストール / Install Test Framework

```bash
# プロジェクトルートで実行 / Run in project root
npm install

# または開発依存関係のみ / Or dev dependencies only
npm install --save-dev jest @babel/preset-env
```

### テスト設定ファイル / Test Configuration

**jest.config.js**

```javascript
module.exports = {
  testEnvironment: 'node',

  // テスト対象ファイル / Files to test
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],

  // カバレッジ収集 / Coverage collection
  collectCoverageFrom: [
    'assets/js/vr-*.js',
    '!assets/js/**/*.min.js',
  ],

  // カバレッジ閾値 / Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // タイムアウト / Timeout
  testTimeout: 10000,

  // セットアップファイル / Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
```

---

## ユニットテスト / Unit Tests

### テストの実行 / Running Tests

```bash
# すべてのテストを実行 / Run all tests
npm test

# ウォッチモード / Watch mode
npm run test:watch

# カバレッジ付き / With coverage
npm run test:coverage

# 特定のファイルのみ / Specific file only
npm test -- tests/vr-modules.test.js

# 詳細出力 / Verbose output
npm test -- --verbose
```

### VRTextRenderer のテスト例 / VRTextRenderer Test Example

**tests/vr-text-renderer.test.js**

```javascript
describe('VRTextRenderer', () => {
  let textRenderer;

  beforeEach(() => {
    // モックのThree.jsオブジェクト / Mock Three.js objects
    global.THREE = {
      Sprite: jest.fn(),
      SpriteMaterial: jest.fn(),
      CanvasTexture: jest.fn(),
      Color: jest.fn()
    };

    textRenderer = new VRTextRenderer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Font Size Calculation', () => {
    test('should calculate font size based on viewing distance', () => {
      const distance = 2.0; // 2 meters
      const fontSize = textRenderer.calculateFontSize(distance);

      expect(fontSize).toBeGreaterThanOrEqual(32);
      expect(fontSize).toBeLessThanOrEqual(128);
    });

    test('should use minimum font size for far distances', () => {
      const distance = 10.0; // 10 meters
      const fontSize = textRenderer.calculateFontSize(distance);

      expect(fontSize).toBe(32); // Minimum
    });

    test('should use maximum font size for close distances', () => {
      const distance = 0.3; // 30 cm
      const fontSize = textRenderer.calculateFontSize(distance);

      expect(fontSize).toBe(128); // Maximum
    });
  });

  describe('Visual Angle Calculation', () => {
    test('should calculate correct visual angle', () => {
      const physicalSize = 0.1; // 10cm
      const distance = 2.0; // 2m

      const angle = textRenderer.calculateVisualAngle(physicalSize, distance);

      // 期待値の計算: 2 * atan((0.1/2) / 2) * 180/π ≈ 2.86°
      expect(angle).toBeCloseTo(2.86, 1);
    });
  });

  describe('Text Wrapping', () => {
    test('should wrap text at max line length', () => {
      const text = 'This is a very long text that should be wrapped at a certain length';
      const maxLength = 20;

      const wrapped = textRenderer.wrapText(text, maxLength);
      const lines = wrapped.split('\n');

      lines.forEach(line => {
        expect(line.length).toBeLessThanOrEqual(maxLength);
      });
    });

    test('should not break words unnecessarily', () => {
      const text = 'Hello World';
      const maxLength = 20;

      const wrapped = textRenderer.wrapText(text, maxLength);

      expect(wrapped).toBe('Hello World');
    });
  });

  describe('Contrast Ratio', () => {
    test('should ensure WCAG AAA compliance (7.0+)', () => {
      const bgColor = '#0f172a'; // Dark background
      const fgColor = '#f8fafc'; // Light text

      const ratio = textRenderer.calculateContrastRatio(bgColor, fgColor);

      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });
  });
});
```

### VRErgonomicUI のテスト例 / VRErgonomicUI Test Example

**tests/vr-ergonomic-ui.test.js**

```javascript
describe('VRErgonomicUI', () => {
  let ergoUI;

  beforeEach(() => {
    ergoUI = new VRErgonomicUI();
  });

  describe('Viewing Zones', () => {
    test('should define comfortable horizontal zone (±30°)', () => {
      expect(ergoUI.COMFORTABLE_HORIZONTAL).toBe(30);
    });

    test('should define comfortable vertical zone (+15° to -15°)', () => {
      expect(ergoUI.COMFORTABLE_VERTICAL_UP).toBe(15);
      expect(ergoUI.COMFORTABLE_VERTICAL_DOWN).toBe(-15);
    });

    test('should validate position within comfortable zone', () => {
      const position = { x: 0, y: 0, z: -2 }; // Directly in front

      const isComfortable = ergoUI.isInComfortableZone(position);

      expect(isComfortable).toBe(true);
    });

    test('should invalidate position outside comfortable zone', () => {
      const position = { x: 2, y: 2, z: -2 }; // Too far to the side and up

      const isComfortable = ergoUI.isInComfortableZone(position);

      expect(isComfortable).toBe(false);
    });
  });

  describe('Button Size Calculation', () => {
    test('should ensure minimum button size of 8cm', () => {
      const distance = 1.0; // 1 meter

      const buttonSize = ergoUI.calculateMinButtonSize(distance);

      expect(buttonSize).toBeGreaterThanOrEqual(0.08); // 8cm in meters
    });

    test('should recommend 12cm button size for comfort', () => {
      const distance = 1.0;

      const recommendedSize = ergoUI.calculateRecommendedButtonSize(distance);

      expect(recommendedSize).toBeGreaterThanOrEqual(0.12); // 12cm
    });
  });

  describe('UI Anchoring', () => {
    test('should support world-locked anchoring', () => {
      ergoUI.setAnchorMode('world');

      expect(ergoUI.anchorMode).toBe('world');
    });

    test('should support head-locked anchoring', () => {
      ergoUI.setAnchorMode('head');

      expect(ergoUI.anchorMode).toBe('head');
    });

    test('should support lazy-follow anchoring', () => {
      ergoUI.setAnchorMode('lazy-follow');

      expect(ergoUI.anchorMode).toBe('lazy-follow');
      expect(ergoUI.followThreshold).toBe(15); // 15° threshold
    });
  });
});
```

### VRComfortSystem のテスト例 / VRComfortSystem Test Example

**tests/vr-comfort-system.test.js**

```javascript
describe('VRComfortSystem', () => {
  let comfortSystem;

  beforeEach(() => {
    comfortSystem = new VRComfortSystem();
  });

  describe('FPS Targets', () => {
    test('should have optimal FPS target of 90', () => {
      expect(comfortSystem.TARGET_FPS_OPTIMAL).toBe(90);
    });

    test('should have minimum FPS target of 72', () => {
      expect(comfortSystem.TARGET_FPS_MIN).toBe(72);
    });

    test('should have critical FPS threshold of 60', () => {
      expect(comfortSystem.TARGET_FPS_CRITICAL).toBe(60);
    });
  });

  describe('Frame Time Calculation', () => {
    test('should calculate optimal frame time (11.1ms for 90 FPS)', () => {
      const frameTime = comfortSystem.calculateFrameTime(90);

      expect(frameTime).toBeCloseTo(11.1, 1);
    });

    test('should calculate minimum frame time (13.9ms for 72 FPS)', () => {
      const frameTime = comfortSystem.calculateFrameTime(72);

      expect(frameTime).toBeCloseTo(13.9, 1);
    });
  });

  describe('Motion Sickness Prevention', () => {
    test('should enable vignette during movement', () => {
      comfortSystem.startMovement();

      expect(comfortSystem.vignetteEnabled).toBe(true);
    });

    test('should disable vignette when stopped', () => {
      comfortSystem.startMovement();
      comfortSystem.stopMovement();

      expect(comfortSystem.vignetteEnabled).toBe(false);
    });

    test('should support teleport locomotion', () => {
      const result = comfortSystem.setLocomotionMode('teleport');

      expect(result).toBe(true);
      expect(comfortSystem.locomotionMode).toBe('teleport');
    });
  });

  describe('Break Reminders', () => {
    test('should remind breaks every 30 minutes', () => {
      expect(comfortSystem.BREAK_INTERVAL_MS).toBe(30 * 60 * 1000);
    });

    test('should track session time', () => {
      comfortSystem.startSession();

      expect(comfortSystem.sessionStartTime).toBeDefined();
    });
  });
});
```

---

## 統合テスト / Integration Tests

### WebXR API統合テスト / WebXR API Integration Test

**tests/integration/webxr-integration.test.js**

```javascript
describe('WebXR API Integration', () => {
  let vrLauncher;

  beforeEach(() => {
    // WebXR APIのモック / Mock WebXR API
    global.navigator = {
      xr: {
        isSessionSupported: jest.fn().mockResolvedValue(true),
        requestSession: jest.fn().mockResolvedValue({
          addEventListener: jest.fn(),
          end: jest.fn()
        })
      }
    };

    vrLauncher = new VRLauncher();
  });

  test('should detect WebXR support', async () => {
    const supported = await vrLauncher.isVRSupported();

    expect(supported).toBe(true);
    expect(navigator.xr.isSessionSupported).toHaveBeenCalledWith('immersive-vr');
  });

  test('should enter VR session', async () => {
    await vrLauncher.enterVR();

    expect(navigator.xr.requestSession).toHaveBeenCalledWith('immersive-vr', {
      optionalFeatures: expect.arrayContaining(['hand-tracking', 'local-floor'])
    });
  });

  test('should exit VR session', async () => {
    await vrLauncher.enterVR();
    await vrLauncher.exitVR();

    expect(vrLauncher.session.end).toHaveBeenCalled();
  });
});
```

### Three.js統合テスト / Three.js Integration Test

**tests/integration/threejs-integration.test.js**

```javascript
describe('Three.js Integration', () => {
  test('should create 3D bookmark scene', () => {
    const bookmark3D = new VRBookmark3D();
    bookmark3D.init();

    expect(bookmark3D.scene).toBeDefined();
    expect(bookmark3D.camera).toBeDefined();
    expect(bookmark3D.renderer).toBeDefined();
  });

  test('should support multiple layouts', () => {
    const bookmark3D = new VRBookmark3D();

    const layouts = ['grid', 'sphere', 'wall', 'carousel'];

    layouts.forEach(layout => {
      const result = bookmark3D.setLayout(layout);
      expect(result).toBe(true);
    });
  });
});
```

---

## E2Eテスト / E2E Tests

### Playwright を使用したE2Eテスト / E2E Testing with Playwright

**インストール / Installation:**

```bash
npm install --save-dev @playwright/test
npx playwright install
```

**tests/e2e/vr-session.spec.js**

```javascript
const { test, expect } = require('@playwright/test');

test.describe('VR Session Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080');
  });

  test('should show VR button on WebXR-capable browser', async ({ page }) => {
    // VRボタンの表示を確認
    const vrButton = await page.locator('#vr-button');
    await expect(vrButton).toBeVisible();
  });

  test('should display environment selection', async ({ page }) => {
    // 設定を開く
    await page.click('[data-action="open-settings"]');

    // 環境選択が表示されることを確認
    const envSelect = await page.locator('#environment-select');
    await expect(envSelect).toBeVisible();

    // 環境を変更
    await envSelect.selectOption('space');

    // 変更が保存されることを確認
    const selectedValue = await envSelect.inputValue();
    expect(selectedValue).toBe('space');
  });

  test('should persist settings in localStorage', async ({ page }) => {
    // 設定を変更
    await page.click('[data-action="open-settings"]');
    await page.selectOption('#environment-select', 'cyberpunk');
    await page.click('[data-action="save-settings"]');

    // ページをリロード
    await page.reload();

    // 設定が保存されていることを確認
    const savedEnv = await page.evaluate(() => {
      return localStorage.getItem('vr-environment');
    });

    expect(savedEnv).toBe('cyberpunk');
  });
});
```

---

## VRデバイステスト / VR Device Testing

### 手動テストチェックリスト / Manual Testing Checklist

#### Meta Quest 2/3

```markdown
## VRセッション / VR Session
- [ ] VRモードに入れる / Can enter VR mode
- [ ] VRモードから出られる / Can exit VR mode
- [ ] セッション中にエラーが発生しない / No errors during session

## コントローラー / Controller
- [ ] トリガーでクリックできる / Trigger clicks work
- [ ] サムスティックでスクロールできる / Thumbstick scrolls
- [ ] Bボタンで戻れる / B button goes back
- [ ] Yボタンでメニューが開く / Y button opens menu

## ハンドトラッキング / Hand Tracking
- [ ] コントローラーなしで操作できる / Works without controllers
- [ ] ピンチジェスチャーでクリックできる / Pinch gesture clicks
- [ ] グラブジェスチャーでスクロールできる / Grab gesture scrolls
- [ ] ポイントジェスチャーでカーソル移動 / Point gesture moves cursor

## パフォーマンス / Performance
- [ ] 90 FPS を維持 / Maintains 90 FPS
- [ ] フレームドロップがない / No frame drops
- [ ] メモリリークがない / No memory leaks
- [ ] バッテリー消費が正常 / Normal battery consumption

## 3D UI
- [ ] 3Dブックマークが表示される / 3D bookmarks display
- [ ] 3Dタブマネージャーが動作する / 3D tab manager works
- [ ] 空間オーディオが聞こえる / Spatial audio works
- [ ] 環境切り替えができる / Environment switching works

## アクセシビリティ / Accessibility
- [ ] テキストが読みやすい / Text is readable
- [ ] ボタンが押しやすい / Buttons are easy to press
- [ ] コントラストが十分 / Sufficient contrast
- [ ] 音声コマンドが動作する / Voice commands work
```

### 自動化されたVRテスト / Automated VR Testing

**tests/vr-device/automated-vr-test.js**

```javascript
// WebXR Emulator API を使用した自動テスト
// Automated testing using WebXR Emulator API

describe('VR Device Automated Tests', () => {
  let xrDevice;

  beforeEach(async () => {
    // WebXR Emulator の初期化
    xrDevice = await XRDeviceEmulator.create('Meta Quest 2');
  });

  test('should simulate controller input', async () => {
    await xrDevice.enterVR();

    // トリガーボタンをシミュレート
    await xrDevice.controller.pressButton('trigger');

    // クリックイベントが発火することを確認
    expect(clickEventFired).toBe(true);
  });

  test('should simulate hand tracking', async () => {
    await xrDevice.enableHandTracking();

    // ピンチジェスチャーをシミュレート
    await xrDevice.hand.pinch();

    // ピンチイベントが発火することを確認
    expect(pinchEventFired).toBe(true);
  });
});
```

---

## パフォーマンステスト / Performance Testing

### FPS測定 / FPS Measurement

**tests/performance/fps-test.js**

```javascript
describe('FPS Performance', () => {
  let perfMonitor;

  beforeEach(() => {
    perfMonitor = new VRPerformanceMonitor();
  });

  test('should maintain 90 FPS in VR mode', async () => {
    perfMonitor.start();

    // 10秒間の測定
    await new Promise(resolve => setTimeout(resolve, 10000));

    const avgFPS = perfMonitor.getAverageFPS();

    expect(avgFPS).toBeGreaterThanOrEqual(90);
  });

  test('should detect frame drops', async () => {
    perfMonitor.start();

    // 重い処理をシミュレート
    await heavyComputation();

    const frameDrops = perfMonitor.getFrameDropCount();

    expect(frameDrops).toBeLessThan(5); // 5フレーム未満
  });
});
```

### メモリ使用量測定 / Memory Usage Measurement

**tests/performance/memory-test.js**

```javascript
describe('Memory Performance', () => {
  test('should stay under 2GB memory limit', async () => {
    const initialMemory = performance.memory.usedJSHeapSize;

    // すべてのVRモジュールを初期化
    await initializeAllVRModules();

    const finalMemory = performance.memory.usedJSHeapSize;
    const memoryUsedMB = (finalMemory - initialMemory) / 1024 / 1024;

    expect(memoryUsedMB).toBeLessThan(2048); // 2GB
  });

  test('should not have memory leaks', async () => {
    const measurements = [];

    // 10回VRセッションを繰り返す
    for (let i = 0; i < 10; i++) {
      await enterVR();
      await exitVR();

      measurements.push(performance.memory.usedJSHeapSize);
    }

    // メモリ使用量が増加し続けないことを確認
    const firstMeasure = measurements[0];
    const lastMeasure = measurements[measurements.length - 1];
    const increase = (lastMeasure - firstMeasure) / firstMeasure;

    expect(increase).toBeLessThan(0.1); // 10%未満の増加
  });
});
```

---

## アクセシビリティテスト / Accessibility Testing

### WCAG準拠チェック / WCAG Compliance Check

**tests/accessibility/wcag-test.js**

```javascript
const { expect } = require('chai');
const axe = require('axe-core');

describe('WCAG AAA Compliance', () => {
  test('should pass axe accessibility tests', async () => {
    const results = await axe.run(document);

    expect(results.violations).toHaveLength(0);
  });

  test('should have sufficient contrast ratios (7.0+)', () => {
    const elements = document.querySelectorAll('[data-accessibility="true"]');

    elements.forEach(el => {
      const bgColor = getComputedStyle(el).backgroundColor;
      const fgColor = getComputedStyle(el).color;

      const ratio = calculateContrastRatio(bgColor, fgColor);

      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });
  });

  test('should support keyboard navigation', () => {
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    expect(focusableElements.length).toBeGreaterThan(0);

    focusableElements.forEach(el => {
      expect(el.tabIndex).toBeGreaterThanOrEqual(0);
    });
  });
});
```

---

## CI/CD統合 / CI/CD Integration

### GitHub Actions ワークフロー / GitHub Actions Workflow

**.github/workflows/test.yml** (既存のファイルを使用)

```bash
# テストワークフローのトリガー / Trigger test workflow
git push origin main

# または手動でトリガー / Or trigger manually
gh workflow run test.yml
```

### ローカルでCIテストを実行 / Run CI Tests Locally

```bash
# すべてのチェックを実行 / Run all checks
npm run ci:test

# または個別に実行 / Or run individually
npm test                    # ユニットテスト / Unit tests
npm run test:integration    # 統合テスト / Integration tests
npm run test:e2e           # E2Eテスト / E2E tests
npm run lint               # リンター / Linter
```

---

## カバレッジ / Coverage

### カバレッジレポートの生成 / Generate Coverage Report

```bash
# カバレッジを生成 / Generate coverage
npm run test:coverage

# HTMLレポートを開く / Open HTML report
open coverage/lcov-report/index.html
```

### カバレッジ目標 / Coverage Goals

| カテゴリ / Category | 目標 / Target | 現在 / Current |
|-------------------|--------------|---------------|
| 文 / Statements | 60% | 50%+ |
| 分岐 / Branches | 60% | 50%+ |
| 関数 / Functions | 60% | 50%+ |
| 行 / Lines | 60% | 50%+ |

### カバレッジ向上のヒント / Tips to Improve Coverage

1. **未テストの関数を特定 / Identify untested functions:**
   ```bash
   npm run test:coverage -- --verbose
   ```

2. **エッジケースをテスト / Test edge cases:**
   - 境界値のテスト / Boundary value testing
   - エラーハンドリングのテスト / Error handling testing
   - 極端な入力値のテスト / Extreme input testing

3. **モックを活用 / Use mocks:**
   - 外部APIのモック / Mock external APIs
   - ブラウザAPIのモック / Mock browser APIs
   - WebXR APIのモック / Mock WebXR API

---

## ベストプラクティス / Best Practices

### テストの命名規則 / Test Naming Convention

```javascript
// ✅ 良い例 / Good
describe('VRTextRenderer', () => {
  test('should calculate font size based on viewing distance', () => {
    // ...
  });
});

// ❌ 悪い例 / Bad
describe('text', () => {
  test('test1', () => {
    // ...
  });
});
```

### AAA パターン / AAA Pattern

```javascript
test('should update FPS counter', () => {
  // Arrange（準備）
  const perfMonitor = new VRPerformanceMonitor();
  perfMonitor.start();

  // Act（実行）
  perfMonitor.updateFPS(90);

  // Assert（検証）
  expect(perfMonitor.currentFPS).toBe(90);
});
```

### モックの使用 / Using Mocks

```javascript
// WebXR APIのモック / Mock WebXR API
global.navigator = {
  xr: {
    isSessionSupported: jest.fn().mockResolvedValue(true),
    requestSession: jest.fn()
  }
};

// Three.jsのモック / Mock Three.js
jest.mock('three', () => ({
  Scene: jest.fn(),
  PerspectiveCamera: jest.fn(),
  WebGLRenderer: jest.fn()
}));
```

---

## トラブルシューティング / Troubleshooting

### テストが失敗する / Tests Failing

```bash
# キャッシュをクリア / Clear cache
npm cache clean --force
rm -rf node_modules
npm install

# 詳細ログを有効化 / Enable verbose logging
npm test -- --verbose --detectOpenHandles
```

### タイムアウトエラー / Timeout Errors

```javascript
// jest.config.js でタイムアウトを延長
module.exports = {
  testTimeout: 30000 // 30秒 / 30 seconds
};
```

### メモリ不足 / Out of Memory

```bash
# Node.jsのメモリ制限を増やす / Increase Node.js memory limit
NODE_OPTIONS=--max_old_space_size=4096 npm test
```

---

## まとめ / Summary

このガイドでは以下をカバーしました：
*This guide covered:*

✅ ユニットテストの書き方 / Writing unit tests
✅ 統合テストの実装 / Implementing integration tests
✅ E2Eテストの自動化 / Automating E2E tests
✅ VRデバイステストの手順 / VR device testing procedures
✅ パフォーマンステストの方法 / Performance testing methods
✅ アクセシビリティテスト / Accessibility testing
✅ CI/CD統合 / CI/CD integration
✅ カバレッジ管理 / Coverage management

---

**質問やフィードバックがあれば、[Issue](https://github.com/yourusername/qui-browser-vr/issues)を作成してください！**
*For questions or feedback, please [create an issue](https://github.com/yourusername/qui-browser-vr/issues)!*

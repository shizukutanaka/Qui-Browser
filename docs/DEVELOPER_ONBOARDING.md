# Developer Onboarding Guide - Qui Browser VR

## 開発者オンボーディングガイド

**Version:** 3.3.0
**Target:** New developers joining the project

このガイドは、Qui Browser VRプロジェクトに新しく参加する開発者向けの包括的なオンボーディング資料です。

This guide provides comprehensive onboarding materials for developers new to the Qui Browser VR project.

---

## 目次 | Table of Contents

1. [プロジェクト概要](#プロジェクト概要--project-overview)
2. [開発環境セットアップ](#開発環境セットアップ--development-setup)
3. [アーキテクチャ理解](#アーキテクチャ理解--architecture)
4. [開発ワークフロー](#開発ワークフロー--workflow)
5. [コーディング規約](#コーディング規約--coding-standards)
6. [テスト作成](#テスト作成--testing)
7. [デバッグ方法](#デバッグ方法--debugging)
8. [よくある質問](#よくある質問--faq)

---

## プロジェクト概要 | Project Overview

### 🎯 プロジェクトの目的

Qui Browser VRは、**軽量で高性能なWebXRベースのVRブラウザ**です。

**主な特徴:**

- 🚀 **高速**: 90 FPS @ Meta Quest 3
- 🪶 **軽量**: バンドルサイズ189 KB
- ♿ **アクセシブル**: WCAG AAA準拠
- 🌐 **多言語**: 日本語/英語対応
- 🎨 **カスタマイズ可能**: 6つの環境テーマ

### 📊 技術スタック

```
Frontend:
├── Three.js (0.181)       # 3Dグラフィックス
├── WebXR Device API       # VR/ARセッション管理
├── Web Audio API          # 空間音響
├── Service Worker         # オフライン対応
└── Web Speech API         # 音声認識

Build Tools:
├── Vite 5                 # バンドラー
├── Babel                  # トランスパイラー
├── Jest                   # テストフレームワーク
└── ESLint + Prettier      # コード品質

Deployment:
├── GitHub Pages           # 静的ホスティング
├── Netlify                # CDN + CI/CD
├── Vercel                 # エッジデプロイ
└── Docker + Nginx         # セルフホスト
```

### 📁 プロジェクト構造

```
Qui-Browser/
├── assets/                       # 静的アセット (css/images/sounds/icons)
├── src/
│   ├── main.js                   # エントリーポイント
│   ├── app.js                    # 2D アプリシェル
│   ├── monitoring.js             # 監視
│   ├── i18n/                     # 国際化カタログ
│   ├── a11y/                     # 2D アクセシビリティ
│   ├── utils/                    # ユーティリティ
│   ├── dev/                      # DevTools
│   └── vr/                       # VR ブラウザ本体
├── docs/                         # ドキュメント
│   ├── ARCHITECTURE.md           # アーキテクチャ
│   ├── COMPATIBILITY.md          # 互換性情報
│   └── DEVELOPER_ONBOARDING.md   # このファイル
├── tests/                        # テストスイート (400+ スイート)
├── tools/                        # 開発ツール (verify-*.mjs 等)
├── proxy/                        # ローカル開発用 CORS プロキシ
├── .github/
│   └── workflows/                # CI/CDワークフロー
│       ├── ci.yml                # PR チェック
│       ├── cd.yml                # CD
│       ├── deploy.yml            # デプロイ
│       └── release.yml           # リリース
├── index.html                    # エントリーポイント
├── public/manifest.json          # PWAマニフェスト（vite が dist/ へコピー）
├── package.json                  # 依存関係
├── vite.config.js                # ビルド設定
└── jest.config.js                # テスト設定
```

---

## 開発環境セットアップ | Development Setup

### ステップ 1: 前提条件

```bash
# Node.js (v18以上推奨)
node --version  # v18.0.0+

# npm (v9以上推奨)
npm --version   # v9.0.0+

# Git
git --version   # v2.30.0+
```

### ステップ 2: リポジトリクローン

```bash
# HTTPSでクローン
git clone https://github.com/shizukutanaka/Qui-Browser.git

# SSHでクローン (推奨)
git clone git@github.com:shizukutanaka/Qui-Browser.git

# ディレクトリ移動
cd Qui-Browser
```

### ステップ 3: 依存関係インストール

```bash
# 全依存関係をインストール
npm install

# 784 packages installed in 45s
```

**インストールされる主な依存関係:**

```json
{
  "dependencies": {
    "three": "^0.181.0",
    "web-vitals": "^5.3.0"
  },
  "devDependencies": {
    "vite": "^5.4.21",
    "@babel/core": "^7.23.0",
    "jest": "^29.7.0",
    "eslint": "^9.39.0",
    "prettier": "^3.1.0"
  }
}
```

### ステップ 4: 開発サーバー起動

```bash
# Vite Dev Server起動
npm run dev

# ブラウザで開きます
# http://localhost:5173
```

### ステップ 5: ビルド確認

```bash
# 本番ビルド
npm run build

# 出力ファイル確認
ls -lh dist/

# index-<hash>.js / index-<hash>.css + assets/
```

### ステップ 6: テスト実行

```bash
# 全テスト実行
npm test

# カバレッジレポート
npm run test:coverage
```

---

## アーキテクチャ理解 | Architecture

### 🏗️ システム構成

Qui Browser VRは、単一のVRコントローラー (`src/vr/VRApp.js`) が Three.js
レンダラー・XRセッション・interactablesレジストリを所有し、サブシステムが
コールバック (`onSelect` / `onHover` / `onError`) 経由で通信する構成です。
GPUコンテキストなしで Node 上のユニットテストが可能な設計になっています。

完全なモジュールマップは [ARCHITECTURE.md](ARCHITECTURE.md) を参照してください。

主な層:

- `vr/browser/` — WebPanel / TabManager / BookmarkPanel / WindowManager
- `vr/input/` — VRControllerInput / VoiceCommands / JapaneseIME
- `vr/interaction/` — GazeInteraction / HandTracking / HapticFeedback
- `vr/accessibility/` — CaptionSystem / crossModal / SemanticDOM
- `vr/rendering/` — FFRSystem / LayersSystem
- `vr/comfort/` — ComfortSystem (vignette / snap turn / teleport)
- `vr/audio/` — SpatialAudio
- `vr/media/` — ImmersiveVideo
- `src/monitoring.js` — パフォーマンス・エラー監視

### 🔄 データフロー

```javascript
// 1. ユーザー入力 (コントローラー/手/視線/音声)
User Input → VRControllerInput / GazeInteraction / VoiceCommands

// 2. interactables レジストリでヒットテスト
VRApp.hitTest() → interactable.onSelect()

// 3. ユーザー向けフィードバック (cross-modal)
Event → showVRToast() → notifyCrossModal(haptic, captions, msg)

// 4. レンダリング
VRApp → Three.js Scene → WebXR → HMD
```

---

## 開発ワークフロー | Workflow

### 🔄 Git ワークフロー

```bash
# 1. mainブランチから最新取得
git checkout main
git pull origin main

# 2. 機能ブランチ作成
git checkout -b feature/add-new-gesture

# 3. 変更を実装
# ... コード編集 ...

# 4. テスト実行
npm test

# 5. Lint + Format
npm run lint:fix
npm run format

# 6. コミット (Conventional Commits)
git add .
git commit -m "feat(input): add thumbs-up gesture recognition

- Implement thumbs-up detection in VRInputSystem
- Add unit tests for new gesture
- Update documentation

Closes #123"

# 7. プッシュ
git push origin feature/add-new-gesture

# 8. Pull Request作成
# GitHub上でPR作成
```

### 📝 コミットメッセージ規約

**Conventional Commits準拠:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:**

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: フォーマット
- `refactor`: リファクタリング
- `test`: テスト追加
- `chore`: ビルド・設定変更

**例:**

```
feat(navigation): add sphere bookmark layout

Implement Fibonacci sphere distribution for bookmark placement.
This provides better spatial distribution for large bookmark sets.

- Add calculateFibonacciSphere() method
- Update bookmark layout tests
- Add documentation

Closes #234
```

### 🔍 コードレビュープロセス

1. **PR作成**
   - 明確なタイトルと説明
   - 変更内容のスクリーンショット/動画
   - テスト結果を添付

2. **自動チェック**
   - ✅ Lint (ESLint)
   - ✅ Format (Prettier)
   - ✅ Tests (Jest)
   - ✅ Build (Vite)

3. **レビュアー確認**
   - コード品質
   - テストカバレッジ
   - パフォーマンス影響
   - ドキュメント更新

4. **マージ**
   - Squash and Merge推奨
   - リリースノート更新

---

## コーディング規約 | Coding Standards

### 📏 JavaScript スタイル

**ESLint + Prettier設定:**

```javascript
// .eslintrc.json
{
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 12,
    "sourceType": "module"
  },
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "no-console": ["warn", { "allow": ["warn", "error", "info"] }],
    "no-var": "error",
    "prefer-const": "error",
    "eqeqeq": ["error", "always"]
  }
}
```

**Good Examples:**

```javascript
// ✅ Good: const使用
const MAX_TABS = 10;

// ❌ Bad: var使用
var maxTabs = 10;

// ✅ Good: アロー関数
const calculateDistance = (a, b) => {
  return Math.sqrt(a ** 2 + b ** 2);
};

// ❌ Bad: function構文
function calculateDistance(a, b) {
  return Math.sqrt(a ** 2 + b ** 2);
}

// ✅ Good: テンプレートリテラル
const message = `Tab ${tabId} created`;

// ❌ Bad: 文字列連結
const message = 'Tab ' + tabId + ' created';

// ✅ Good: 厳密等価
if (value === null) {
}

// ❌ Bad: 緩い等価
if (value == null) {
}
```

### 🏗️ クラス設計

**パターン:**

```javascript
/**
 * VR Gesture Recognition System
 * Detects and processes hand gestures in VR
 * @version 3.3.0
 */
class VRGestureSystem {
  /**
   * Initialize gesture recognition
   * @param {Object} options - Configuration options
   * @param {number} options.threshold - Detection threshold (0-1)
   * @param {boolean} options.enableRecording - Enable gesture recording
   */
  constructor(options = {}) {
    this.threshold = options.threshold || 0.8;
    this.enableRecording = options.enableRecording || false;
    this.gestures = new Map();
    this.history = [];

    this.init();
  }

  /**
   * Initialize system
   * @private
   */
  init() {
    this.loadGestures();
    this.setupEventListeners();
  }

  /**
   * Detect pinch gesture
   * @param {Object} handData - Hand tracking data
   * @param {Object} handData.thumb - Thumb tip position
   * @param {Object} handData.index - Index finger tip position
   * @returns {Object|null} Pinch data or null
   * @public
   */
  detectPinch(handData) {
    if (!handData?.thumb || !handData?.index) {
      return null;
    }

    const distance = this.calculateDistance(handData.thumb, handData.index);

    if (distance < this.threshold) {
      return {
        detected: true,
        distance,
        strength: 1 - distance / this.threshold
      };
    }

    return null;
  }

  /**
   * Calculate Euclidean distance
   * @param {Object} a - Point A
   * @param {Object} b - Point B
   * @returns {number} Distance
   * @private
   */
  calculateDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Clean up resources
   * @public
   */
  dispose() {
    this.gestures.clear();
    this.history = [];
  }
}

// Export
export default VRGestureSystem;
```

### 📝 コメント規約

```javascript
// ✅ Good: JSDoc形式
/**
 * Create 360° video sphere
 * @param {string} url - Video URL
 * @param {Object} options - Video options
 * @param {string} options.stereoMode - 'mono'|'top-bottom'|'left-right'
 * @returns {THREE.Mesh} Video sphere mesh
 */

// ✅ Good: 複雑なロジックの説明
// Calculate Fibonacci sphere distribution for optimal bookmark placement
// Golden angle (φ): 2π * (1 - 1/φ) ≈ 2.399963
const phi = Math.PI * (3 - Math.sqrt(5));

// ❌ Bad: 自明なコメント
// Increment i by 1
i++;
```

### 🎯 命名規約

```javascript
// Classes: PascalCase
class VRInputSystem {}

// Functions/Variables: camelCase
const calculateDistance = () => {};
const userName = 'Alice';

// Constants: UPPER_SNAKE_CASE
const MAX_TABS = 10;
const DEFAULT_FPS = 90;

// Private members: _prefix
class MyClass {
  _privateMethod() {}
  publicMethod() {}
}

// Boolean: is/has/can prefix
const isVRSupported = true;
const hasHandTracking = false;
const canUseWebGPU = true;
```

---

## テスト作成 | Testing

### 🧪 テスト構造

**AAA Pattern (Arrange-Act-Assert):**

```javascript
describe('VRGestureSystem', () => {
  describe('detectPinch', () => {
    test('should detect pinch when fingers are close', () => {
      // Arrange: テストデータ準備
      const gestureSystem = new VRGestureSystem({
        threshold: 0.02
      });
      const handData = {
        thumb: { x: 0, y: 0, z: 0 },
        index: { x: 0.01, y: 0, z: 0 }
      };

      // Act: テスト実行
      const result = gestureSystem.detectPinch(handData);

      // Assert: 結果検証
      expect(result).toBeDefined();
      expect(result.detected).toBe(true);
      expect(result.distance).toBeCloseTo(0.01, 3);
      expect(result.strength).toBeGreaterThan(0.5);
    });

    test('should not detect pinch when fingers are far', () => {
      // Arrange
      const gestureSystem = new VRGestureSystem({
        threshold: 0.02
      });
      const handData = {
        thumb: { x: 0, y: 0, z: 0 },
        index: { x: 0.05, y: 0, z: 0 }
      };

      // Act
      const result = gestureSystem.detectPinch(handData);

      // Assert
      expect(result).toBeNull();
    });

    test('should return null for invalid hand data', () => {
      // Arrange
      const gestureSystem = new VRGestureSystem();

      // Act
      const result = gestureSystem.detectPinch({});

      // Assert
      expect(result).toBeNull();
    });
  });
});
```

### 🎭 モック作成

```javascript
// Three.js Mock
const mockThree = {
  Scene: class {
    add() {}
    remove() {}
  },
  Mesh: class {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
    }
  },
  Vector3: class {
    constructor(x, y, z) {
      this.x = x || 0;
      this.y = y || 0;
      this.z = z || 0;
    }
    length() {
      return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
    }
  }
};

global.THREE = mockThree;

// WebXR API Mock
global.navigator = {
  xr: {
    isSessionSupported: async (mode) => true,
    requestSession: async (mode, options) => ({
      requestAnimationFrame: (callback) => setTimeout(callback, 16),
      end: async () => {}
    })
  }
};
```

### 📊 カバレッジ目標

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
};
```

**現在のカバレッジ:**

- 📊 `npm run test:coverage` で全体レポートを確認

---

## デバッグ方法 | Debugging

### 🔍 VRデバイスでのデバッグ

#### Meta Quest (Chrome DevTools)

```bash
# 1. デバイスをUSB接続
# 2. 開発者モードを有効化
# 3. Chrome://inspect を開く
# 4. デバイスを選択
```

**Remote Debugging:**

```javascript
// コンソールログ
console.info('VR System initialized');
console.warn('Low battery:', batteryLevel);
console.error('WebXR error:', error);

// パフォーマンス計測
console.time('initSystem');
// ... 処理 ...
console.timeEnd('initSystem');
// → initSystem: 123.45ms

// オブジェクト確認
console.table({
  fps: 90,
  memory: '500MB',
  battery: '80%'
});
```

#### ローカルネットワークでのテスト

```bash
# 1. ローカルサーバー起動 (ポート指定)
npm run dev -- --port 5173 --host 0.0.0.0

# 2. IPアドレス確認
# Windows
ipconfig
# Mac/Linux
ifconfig

# 3. VRデバイスのブラウザでアクセス
# http://192.168.1.100:5173
```

### 🐛 一般的な問題と解決策

#### 問題1: Three.jsのオブジェクトが表示されない

```javascript
// デバッグコード
console.log('Scene children:', scene.children.length);
console.log('Camera position:', camera.position);
console.log('Mesh visible:', mesh.visible);

// オブジェクト検証
scene.traverse((object) => {
  console.log('Object:', object.type, object.name);
});

// 解決策
// 1. カメラ位置確認
camera.position.set(0, 1.6, 3);
camera.lookAt(0, 0, 0);

// 2. ライト追加
const light = new THREE.DirectionalLight(0xffffff, 1);
scene.add(light);

// 3. マテリアル確認
mesh.material.side = THREE.DoubleSide;
```

#### 問題2: WebXRセッションが開始しない

```javascript
// デバッグコード
navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
  console.log('VR supported:', supported);
});

// 解決策
// 1. HTTPS必須 (localhostは例外)
// 2. ユーザージェスチャー必須
button.addEventListener('click', async () => {
  const session = await navigator.xr.requestSession('immersive-vr');
});

// 3. Feature flags確認
const session = await navigator.xr.requestSession('immersive-vr', {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['hand-tracking']
});
```

#### 問題3: パフォーマンス低下

```javascript
// パフォーマンスモニタリング
const monitor = new VRSystemMonitor();

setInterval(() => {
  const metrics = {
    fps: monitor.getCurrentFPS(),
    memory: monitor.getMemoryUsage(),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles
  };

  console.table(metrics);

  if (metrics.fps < 72) {
    console.warn('FPS drop detected!', metrics);
  }
}, 1000);

// 解決策
// 1. レンダースケール削減
renderer.setPixelRatio(0.8);

// 2. ジオメトリ簡略化
const geometry = new THREE.SphereGeometry(1, 16, 16); // 32→16

// 3. テクスチャサイズ削減
texture.minFilter = THREE.LinearFilter;
texture.generateMipmaps = false;

// 4. Object Pooling使用
const pool = new ObjectPool(MyClass, 100);
```

---

## よくある質問 | FAQ

### Q1: 新機能の追加方法は?

**A:** 以下の手順で実装してください:

```bash
# 1. Issueを確認/作成
# 2. ブランチ作成
git checkout -b feature/my-new-feature

# 3. 実装
# - コード作成
# - テスト作成
# - ドキュメント更新

# 4. テスト実行
npm test
npm run lint:fix

# 5. PR作成
```

### Q2: どのファイルを編集すればいい?

**A:** 機能別の編集場所:

| 機能           | ファイル                          |
| -------------- | --------------------------------- |
| UI関連         | `src/vr/VRApp.js`                 |
| 入力処理       | `src/vr/input/`                   |
| ナビゲーション | `src/vr/browser/`                 |
| メディア       | `src/vr/media/`                   |
| 監視           | `src/monitoring.js`               |
| パフォーマンス | `src/utils/PerformanceMonitor.js` |
| セキュリティ   | `proxy/ssrfGuard.js`              |

### Q3: ビルドが遅い

**A:** 開発モード使用:

```bash
# Vite Dev Server (HMR有効)
npm run dev
```

### Q4: テストが失敗する

**A:** チェックリスト:

```bash
# 1. 依存関係再インストール
rm -rf node_modules package-lock.json
npm install

# 2. キャッシュクリア
npm run test -- --clearCache

# 3. 個別テスト実行
npm test -- a11y.test.js

# 4. Verbose出力
npm test -- --verbose
```

### Q5: VRデバイスで動作確認する方法は?

**A:** HTTPS必須:

```bash
# Option 1: ngrok
npx ngrok http 5173
# → https://xxxx.ngrok.io

# Option 2: LocalTunnel
npx localtunnel --port 5173
# → https://xxxx.loca.lt

# Option 3: 自己署名証明書
# (開発用のみ)
```

---

## リソース | Resources

### 📚 必読ドキュメント

1. **[README.md](../README.md)** - プロジェクト概要
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** - アーキテクチャ詳細
3. **[COMPATIBILITY.md](COMPATIBILITY.md)** - 互換性情報
4. **[TESTING.md](./TESTING.md)** - テストカバレッジ

### 🌐 外部リソース

- **WebXR Spec**: https://immersive-web.github.io/webxr/
- **Three.js Docs**: https://threejs.org/docs/
- **Meta Quest Development**: https://developer.oculus.com/
- **Pico Development**: https://developer-global.pico-interactive.com/

### 💬 コミュニティ

- **GitHub Issues**: プロジェクトの課題・質問
- **Discord**: リアルタイムチャット
- **Stack Overflow**: `qui-browser` タグ

---

## チェックリスト | Onboarding Checklist

### Day 1-2: 環境構築

- [ ] Node.js/npm/Gitインストール
- [ ] リポジトリクローン
- [ ] 依存関係インストール
- [ ] 開発サーバー起動確認
- [ ] ビルド成功確認
- [ ] テスト実行確認

### Day 3-5: コードベース理解

- [ ] プロジェクト構造確認
- [ ] 主要システム (11個) のコード読解
- [ ] テストコード確認
- [ ] ドキュメント全読

### Week 2: 実装開始

- [ ] 簡単なIssueを1つ解決
- [ ] PRを1つ作成
- [ ] コードレビュー参加

### Week 3-4: 本格参加

- [ ] 中規模機能実装
- [ ] テストカバレッジ向上
- [ ] ドキュメント貢献

---

**Welcome to Qui Browser VR! 🎉**

質問があれば、いつでもチームに聞いてください。
Happy coding! 🚀

**Version:** 3.3.0
**Last Updated:** 2025-10-23

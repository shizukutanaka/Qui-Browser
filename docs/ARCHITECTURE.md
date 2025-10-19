# アーキテクチャドキュメント / Architecture Documentation

Qui Browser VR の技術アーキテクチャ詳細
*Technical architecture details for Qui Browser VR*

---

## 📋 目次 / Table of Contents

1. [概要 / Overview](#概要--overview)
2. [システムアーキテクチャ / System Architecture](#システムアーキテクチャ--system-architecture)
3. [モジュール構成 / Module Structure](#モジュール構成--module-structure)
4. [データフロー / Data Flow](#データフロー--data-flow)
5. [パフォーマンス最適化 / Performance Optimization](#パフォーマンス最適化--performance-optimization)
6. [セキュリティ / Security](#セキュリティ--security)
7. [拡張性 / Extensibility](#拡張性--extensibility)

---

## 概要 / Overview

### 設計思想 / Design Philosophy

Qui Browser VR は以下の原則に基づいて設計されています：
*Qui Browser VR is designed based on the following principles:*

1. **モジュラー設計 / Modular Design**
   - 各VRモジュールは独立して動作
   - 疎結合アーキテクチャ
   - プラグイン可能な拡張機能

2. **パフォーマンスファースト / Performance First**
   - 90 FPS を維持
   - 低メモリフットプリント
   - 効率的なキャッシング戦略

3. **アクセシビリティ重視 / Accessibility Focus**
   - WCAG AAA 準拠
   - マルチモーダル入力対応
   - ユニバーサルデザイン

4. **プログレッシブエンハンスメント / Progressive Enhancement**
   - 基本機能は全デバイスで動作
   - 高性能デバイスでは拡張機能を有効化
   - フォールバック機能を提供

---

## システムアーキテクチャ / System Architecture

### 全体構成図 / Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ VR Views │  │ Settings │  │ 3D UI    │  │ Controls │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    VR Modules Layer (35+)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Core VR Systems                                       │   │
│  │  • VRLauncher • VRUtils • VRTextRenderer            │   │
│  │  • VRErgonomicUI • VRComfortSystem                   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 3D Visualization                                      │   │
│  │  • VRBookmark3D • VRTabManager3D • VRSpatialAudio   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Interaction & Input                                   │   │
│  │  • VRHandTracking • VRGestureScroll • VRKeyboard    │   │
│  │  • VRInputOptimizer • VRGestureMacro                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Advanced Features                                     │   │
│  │  • VREnvironmentCustomizer • VRContentOptimizer     │   │
│  │  • VRPerformanceProfiler • VRAccessibility          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    Browser APIs Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ WebXR    │  │ Three.js │  │ Web Audio│  │ Storage  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                   VR Device Hardware                         │
│         Meta Quest 2/3 • Pico 4 • HTC Vive Focus            │
└─────────────────────────────────────────────────────────────┘
```

### レイヤー構成 / Layer Structure

#### 1. UI Layer (User Interface)
- **責任**: ユーザーインターフェース表示
- **主要コンポーネント**:
  - VR空間内の3D UI
  - 設定パネル
  - コントロール要素
  - ナビゲーション

#### 2. VR Modules Layer
- **責任**: VR機能の実装
- **35+ モジュール**:
  - Core Systems (6 modules)
  - 3D Visualization (3 modules)
  - Interaction (5 modules)
  - Advanced Features (4 modules)
  - Media & Utils (17 modules)

#### 3. Browser APIs Layer
- **責任**: ブラウザAPIとの連携
- **使用API**:
  - WebXR Device API
  - Three.js (r152)
  - Web Audio API
  - LocalStorage API
  - Service Worker API

#### 4. Hardware Layer
- **責任**: VRデバイスとの通信
- **対応デバイス**:
  - Meta Quest 2/3/Pro
  - Pico 4/Neo 3
  - HTC Vive Focus

---

## モジュール構成 / Module Structure

### コアモジュール / Core Modules

#### VRLauncher
```javascript
// 責任: VRセッション管理
class VRLauncher {
  async enterVR() {
    // WebXR セッション開始
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['hand-tracking', 'local-floor']
    });
    // ...
  }
}
```

**依存関係**:
- WebXR Device API
- VRUtils (ユーティリティ関数)

**公開メソッド**:
- `enterVR()`: VRモード開始
- `exitVR()`: VRモード終了
- `isVRSupported()`: WebXR対応確認

#### VRTextRenderer
```javascript
// 責任: VR空間内のテキスト最適化レンダリング
class VRTextRenderer {
  calculateFontSize(distance, visualAngle = 3.45) {
    // 視角に基づくフォントサイズ計算
    const angleRadians = (visualAngle * Math.PI) / 180;
    const physicalSize = 2 * distance * Math.tan(angleRadians / 2);
    const pixelSize = physicalSize * 100 * 37.8; // PPD: 37.8
    return Math.max(32, Math.min(128, Math.round(pixelSize)));
  }
}
```

**設計パターン**: Factory Pattern
**パフォーマンス**: Canvas caching で最適化

### 3Dビジュアライゼーションモジュール / 3D Visualization Modules

#### VRBookmark3D
```javascript
// 責任: 3Dブックマークビジュアライゼーション
class VRBookmark3D {
  layouts = {
    grid: this.createGridLayout,
    sphere: this.createSphereLayout,
    wall: this.createWallLayout,
    carousel: this.createCarouselLayout
  };
}
```

**Three.js統合**:
- `Scene`: 3Dシーン管理
- `Camera`: カメラ制御
- `Raycaster`: インタラクション検出
- `Sprite`: ブックマークカード表示

**パフォーマンス最適化**:
- オブジェクトプーリング
- Frustum culling
- LOD (Level of Detail)

---

## データフロー / Data Flow

### VRセッション開始フロー / VR Session Start Flow

```
1. User clicks "Enter VR" button
   ↓
2. VRLauncher.enterVR()
   ↓
3. Check WebXR support
   ↓ (supported)
4. Request XR session
   ↓ (session granted)
5. Initialize VR modules
   ├─ VRComfortSystem.init()
   ├─ VRInputOptimizer.init()
   ├─ VRTextRenderer.init()
   └─ VRErgonomicUI.init()
   ↓
6. Setup rendering loop
   ├─ Performance monitoring
   ├─ Input handling
   └─ Scene updates
   ↓
7. VR session active
```

### イベントフロー / Event Flow

```javascript
// グローバルイベントシステム / Global Event System
window.addEventListener('vr-session-started', (e) => {
  console.log('VR session started', e.detail);
});

window.addEventListener('vr-gesture-detected', (e) => {
  const { gesture, hand } = e.detail;
  // ジェスチャーに応じた処理
});

window.addEventListener('vr-performance-warning', (e) => {
  const { fps, memoryUsage } = e.detail;
  // パフォーマンス警告への対応
});
```

### ステート管理 / State Management

```javascript
// VRブラウザの状態管理
const VRState = {
  session: null,              // XRSession
  isInVR: false,             // VRモード状態
  environment: 'space',       // 環境設定
  uiLayout: 'comfortable',   // UIレイアウト
  settings: {},              // ユーザー設定
  performance: {
    fps: 0,
    frameTime: 0,
    memoryUsage: 0
  }
};

// LocalStorage への永続化
function saveState() {
  localStorage.setItem('vr-state', JSON.stringify(VRState));
}

function loadState() {
  const saved = localStorage.getItem('vr-state');
  if (saved) Object.assign(VRState, JSON.parse(saved));
}
```

---

## パフォーマンス最適化 / Performance Optimization

### レンダリング最適化 / Rendering Optimization

#### 1. オブジェクトプーリング / Object Pooling

```javascript
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.available = [];
    this.inUse = new Set();

    // 初期プールを作成
    for (let i = 0; i < initialSize; i++) {
      this.available.push(createFn());
    }
  }

  acquire() {
    const obj = this.available.length > 0
      ? this.available.pop()
      : this.createFn();

    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    this.resetFn(obj);
    this.inUse.delete(obj);
    this.available.push(obj);
  }
}
```

#### 2. Frustum Culling

```javascript
// カメラ視錐台外のオブジェクトを非表示
const frustum = new THREE.Frustum();
const cameraViewProjectionMatrix = new THREE.Matrix4();

function updateVisibility(camera, objects) {
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  cameraViewProjectionMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);

  objects.forEach(obj => {
    obj.visible = frustum.intersectsObject(obj);
  });
}
```

#### 3. LOD (Level of Detail)

```javascript
// 距離に応じて詳細度を調整
const lod = new THREE.LOD();

// 高詳細（近距離）
const highDetail = createHighDetailModel();
lod.addLevel(highDetail, 0);

// 中詳細（中距離）
const mediumDetail = createMediumDetailModel();
lod.addLevel(mediumDetail, 5);

// 低詳細（遠距離）
const lowDetail = createLowDetailModel();
lod.addLevel(lowDetail, 10);

scene.add(lod);
```

### メモリ最適化 / Memory Optimization

#### 1. テクスチャキャッシング / Texture Caching

```javascript
const textureCache = new Map();

function getTexture(url, maxSize = 512 * 1024 * 1024) { // 512MB
  if (textureCache.has(url)) {
    return textureCache.get(url);
  }

  // キャッシュサイズチェック
  const currentSize = Array.from(textureCache.values())
    .reduce((sum, tex) => sum + tex.image.width * tex.image.height * 4, 0);

  if (currentSize > maxSize) {
    // LRU削除
    const firstKey = textureCache.keys().next().value;
    const texture = textureCache.get(firstKey);
    texture.dispose();
    textureCache.delete(firstKey);
  }

  const texture = new THREE.TextureLoader().load(url);
  textureCache.set(url, texture);
  return texture;
}
```

#### 2. ジオメトリの使い回し / Geometry Reuse

```javascript
// 同じジオメトリを複数のメッシュで共有
const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);

const mesh1 = new THREE.Mesh(sharedGeometry, material1);
const mesh2 = new THREE.Mesh(sharedGeometry, material2);
const mesh3 = new THREE.Mesh(sharedGeometry, material3);

// メモリ使用量: 1つのジオメトリ + 3つのマテリアル
```

### FPS最適化 / FPS Optimization

#### フレームタイム目標 / Frame Time Targets

| FPS | Frame Time | 用途 / Use Case |
|-----|-----------|----------------|
| 120 | 8.3ms | Meta Quest 3 (最高) |
| 90  | 11.1ms | Meta Quest 2/3 (推奨) |
| 72  | 13.9ms | 最低目標 |
| 60  | 16.7ms | 警告レベル |

#### パフォーマンス監視 / Performance Monitoring

```javascript
let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0;

function animate() {
  const now = performance.now();
  const deltaTime = now - lastFrameTime;

  frameCount++;

  // 1秒ごとにFPS計算
  if (deltaTime >= 1000) {
    fps = Math.round((frameCount * 1000) / deltaTime);
    frameCount = 0;
    lastFrameTime = now;

    // 警告: FPS低下
    if (fps < 72) {
      console.warn('FPS warning:', fps);
      window.dispatchEvent(new CustomEvent('vr-performance-warning', {
        detail: { fps, frameTime: deltaTime }
      }));
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

---

## セキュリティ / Security

### コンテンツセキュリティポリシー / Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https:;
  worker-src 'self';
">
```

### 入力サニタイゼーション / Input Sanitization

```javascript
function sanitizeURL(url) {
  try {
    const parsed = new URL(url);

    // 許可されたプロトコルのみ
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }

    return parsed.href;
  } catch (e) {
    console.error('Invalid URL:', url);
    return null;
  }
}
```

### データ暗号化 / Data Encryption

```javascript
// LocalStorage への保存時に暗号化
async function saveSecureData(key, data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));

  // Web Crypto API で暗号化
  const cryptoKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    dataBuffer
  );

  localStorage.setItem(key, JSON.stringify({
    data: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv)
  }));
}
```

---

## 拡張性 / Extensibility

### プラグインシステム / Plugin System

```javascript
class VRPluginManager {
  constructor() {
    this.plugins = new Map();
  }

  register(name, plugin) {
    if (this.plugins.has(name)) {
      console.warn(`Plugin ${name} already registered`);
      return false;
    }

    // プラグインの検証
    if (!plugin.init || typeof plugin.init !== 'function') {
      throw new Error('Plugin must have an init() method');
    }

    this.plugins.set(name, plugin);
    plugin.init();
    return true;
  }

  get(name) {
    return this.plugins.get(name);
  }

  unregister(name) {
    const plugin = this.plugins.get(name);
    if (plugin && plugin.destroy) {
      plugin.destroy();
    }
    this.plugins.delete(name);
  }
}

// 使用例 / Usage example
const pluginManager = new VRPluginManager();

pluginManager.register('customGesture', {
  init() {
    console.log('Custom gesture plugin initialized');
  },
  destroy() {
    console.log('Custom gesture plugin destroyed');
  },
  onGesture(gesture) {
    console.log('Gesture detected:', gesture);
  }
});
```

### カスタムモジュール追加 / Adding Custom Modules

```javascript
// 1. カスタムモジュールの作成
class VRCustomModule {
  constructor() {
    this.initialized = false;
  }

  init(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.initialized = true;

    // 初期化処理
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('vr-custom-event', this.handleCustomEvent.bind(this));
  }

  handleCustomEvent(event) {
    console.log('Custom event:', event.detail);
  }

  update(deltaTime) {
    if (!this.initialized) return;

    // 毎フレーム更新処理
  }
}

// 2. モジュールの登録
const customModule = new VRCustomModule();
customModule.init(scene, camera, renderer);
```

---

## まとめ / Summary

Qui Browser VR のアーキテクチャは：
*The architecture of Qui Browser VR is:*

✅ **モジュラー**: 35+ の独立したモジュール
✅ **スケーラブル**: プラグインシステムで拡張可能
✅ **パフォーマンス重視**: 90 FPS 維持
✅ **セキュア**: CSP、入力サニタイゼーション、暗号化
✅ **メンテナブル**: 明確な責任分離、依存関係管理

---

**技術スタック / Tech Stack:**
- WebXR Device API
- Three.js r152
- Web Audio API
- Service Worker API
- LocalStorage API

**パフォーマンス目標 / Performance Goals:**
- 90 FPS (optimal)
- 72 FPS (minimum)
- 2GB memory limit
- 11.1ms frame time

---

さらなる詳細は各モジュールのソースコードを参照してください。
*For more details, refer to each module's source code.*

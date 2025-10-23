# 開発者オンボーディング / Developer Onboarding

Qui Browser VR プロジェクトへようこそ！このガイドは、プロジェクトに参加する開発者向けの完全なオンボーディングチェックリストです。
*Welcome to the Qui Browser VR project! This guide provides a complete onboarding checklist for developers joining the project.*

---

## 📋 目次 / Table of Contents

1. [事前準備 / Prerequisites](#事前準備--prerequisites)
2. [環境セットアップ / Environment Setup](#環境セットアップ--environment-setup)
3. [プロジェクト理解 / Understanding the Project](#プロジェクト理解--understanding-the-project)
4. [開発ワークフロー / Development Workflow](#開発ワークフロー--development-workflow)
5. [最初の貢献 / First Contribution](#最初の貢献--first-contribution)
6. [ベストプラクティス / Best Practices](#ベストプラクティス--best-practices)

---

## 事前準備 / Prerequisites

### ✅ チェックリスト

#### 必須スキル / Required Skills
```markdown
- [ ] JavaScript (ES6+) の基本知識
- [ ] HTML5 / CSS3 の理解
- [ ] Git の基本操作
- [ ] コマンドライン操作
```

#### 推奨スキル / Recommended Skills
```markdown
- [ ] Three.js の経験
- [ ] WebXR API の知識
- [ ] PWA の理解
- [ ] Jest / テストフレームワークの経験
```

#### ハードウェア / Hardware
```markdown
- [ ] 開発用PC (推奨スペック)
  - CPU: Core i5 以上 / Ryzen 5 以上
  - RAM: 8GB 以上 (16GB 推奨)
  - OS: Windows 10/11, macOS 11+, Linux

- [ ] VRデバイス (推奨)
  - Meta Quest 2/3
  - Pico 4
  - または WebXR Emulator
```

#### ソフトウェア / Software
```markdown
- [ ] Node.js v18+ インストール済み
- [ ] npm v9+ インストール済み
- [ ] Git インストール済み
- [ ] エディタ (VS Code 推奨)
```

---

## 環境セットアップ / Environment Setup

### Day 1: 初日のセットアップ

#### ステップ 1: リポジトリのクローン
```bash
# リポジトリをクローン
git clone https://github.com/yourusername/qui-browser-vr.git
cd qui-browser-vr

# ブランチを確認
git branch -a

# 最新の main ブランチに切り替え
git checkout main
git pull origin main
```

#### ステップ 2: 依存関係のインストール
```bash
# Node.js バージョン確認
node --version  # v18+ であること
npm --version   # v9+ であること

# 依存関係をインストール
npm install

# インストール確認
npm list --depth=0
```

#### ステップ 3: 環境変数の設定
```bash
# .env.example をコピー
cp .env.example .env

# エディタで編集
code .env  # または nano .env

# 推奨設定 (開発用)
NODE_ENV=development
VR_DEFAULT_FPS_TARGET=90
VR_MIN_FPS_TARGET=72
VR_MEMORY_LIMIT_MB=2048
```

#### ステップ 4: 開発サーバーの起動
```bash
# 方法1: http-server
npx http-server -p 8080

# 方法2: VS Code Live Server
# VS Code で index.html を右クリック → "Open with Live Server"

# 方法3: Python
python -m http.server 8080
```

#### ステップ 5: 動作確認
```bash
# ブラウザで開く
open http://localhost:8080

# テストを実行
npm test

# リンターを実行
npm run lint

# フォーマットチェック
npm run format:check
```

### ✅ セットアップ完了チェックリスト

```markdown
Day 1 完了項目:
- [ ] リポジトリクローン成功
- [ ] 依存関係インストール成功
- [ ] .env ファイル作成完了
- [ ] 開発サーバー起動成功
- [ ] http://localhost:8080 でアプリ表示
- [ ] npm test が全てパス
- [ ] npm run lint がエラーなし
```

---

## プロジェクト理解 / Understanding the Project

### Day 2-3: プロジェクト構造の理解

#### ドキュメントを読む順序

```markdown
1. [ ] README.md - プロジェクト概要
2. [ ] docs/QUICK_START.md - クイックスタート
3. [ ] docs/ARCHITECTURE.md - アーキテクチャ理解
4. [ ] docs/API.md - API リファレンス
5. [ ] CONTRIBUTING.md - 貢献ガイドライン
6. [ ] docs/TESTING.md - テスト方法
```

#### プロジェクト構造の理解

```
qui-browser-vr/
├── assets/                    # アセット
│   ├── js/                   # VR モジュール (35+)
│   │   ├── vr-launcher.js   # VR セッション管理
│   │   ├── vr-text-renderer.js  # テキストレンダリング
│   │   └── ...
│   ├── css/                  # スタイル
│   ├── images/               # 画像アセット
│   └── sounds/               # サウンドアセット
│
├── docs/                      # ドキュメント (12+)
│   ├── API.md               # API リファレンス
│   ├── ARCHITECTURE.md      # アーキテクチャ
│   ├── QUICK_START.md       # クイックスタート
│   └── ...
│
├── tests/                     # テスト
│   ├── vr-modules.test.js   # ユニットテスト
│   └── integration/         # 統合テスト
│
├── tools/                     # ツール
│   ├── benchmark.js         # ベンチマーク
│   └── README.md
│
├── examples/                  # サンプル
│   ├── basic-vr-setup.html
│   └── advanced-features.html
│
├── .github/                   # GitHub設定
│   ├── workflows/           # CI/CD
│   └── ISSUE_TEMPLATE/      # テンプレート
│
├── index.html                # メインエントリーポイント
├── manifest.json             # PWA マニフェスト
├── sw.js                     # Service Worker
└── package.json              # 依存関係
```

#### コアモジュールの理解

```markdown
主要なVRモジュール:
- [ ] vr-launcher.js - VRセッション開始/終了
- [ ] vr-text-renderer.js - 3Dテキストレンダリング
- [ ] vr-ergonomic-ui.js - UIエルゴノミクス
- [ ] vr-comfort-system.js - 酔い防止システム
- [ ] vr-input-optimizer.js - 入力最適化
- [ ] vr-bookmark-3d.js - 3Dブックマーク
- [ ] vr-spatial-audio.js - 空間オーディオ
```

### Day 4: 実際のコードを読む

#### コードリーディング演習

```markdown
1. [ ] vr-launcher.js を読む (195行)
   - WebXR セッション管理を理解
   - イベントハンドリングを確認

2. [ ] vr-text-renderer.js を読む (330行)
   - 視角計算を理解
   - Canvas キャッシングを確認

3. [ ] vr-spatial-audio.js を読む (449行)
   - Web Audio API の使用を理解
   - 3D HRTF パンニングを確認

4. [ ] sw.js を読む (332行)
   - Service Worker 戦略を理解
   - キャッシュ管理を確認
```

---

## 開発ワークフロー / Development Workflow

### 通常の開発フロー

#### 1. Issue を選ぶ

```markdown
- [ ] GitHub Issues を確認
- [ ] "good first issue" ラベルを探す
- [ ] 担当を宣言（コメント）
```

#### 2. ブランチを作成

```bash
# main から最新を取得
git checkout main
git pull origin main

# 新しいブランチを作成
git checkout -b feature/my-feature
# または
git checkout -b fix/issue-123
```

#### 3. 開発を開始

```bash
# 開発サーバー起動
npm run serve

# ファイルを編集
code assets/js/vr-my-module.js

# リアルタイムで動作確認
# http://localhost:8080
```

#### 4. テストを書く

```javascript
// tests/vr-my-module.test.js
describe('VRMyModule', () => {
  test('should initialize correctly', () => {
    const module = new VRMyModule();
    expect(module.initialized).toBe(true);
  });
});
```

#### 5. コードをチェック

```bash
# テストを実行
npm test

# リンターを実行
npm run lint

# 自動修正
npm run lint:fix

# フォーマット
npm run format
```

#### 6. コミット

```bash
# 変更をステージング
git add .

# コミット（Conventional Commits形式）
git commit -m "feat: add VR my module feature

- Implement core functionality
- Add unit tests
- Update documentation"
```

#### 7. プッシュとPR作成

```bash
# プッシュ
git push origin feature/my-feature

# GitHubでPRを作成
# テンプレートに従って記入
```

---

## 最初の貢献 / First Contribution

### 推奨される最初のタスク

#### Level 1: 超簡単（1-2時間）

```markdown
1. [ ] ドキュメントの誤字修正
2. [ ] コメントの追加・改善
3. [ ] README の改善
4. [ ] サンプルコードの追加
```

#### Level 2: 簡単（2-4時間）

```markdown
1. [ ] 既存モジュールへのコメント追加
2. [ ] 簡単なバグ修正
3. [ ] テストの追加
4. [ ] FAQ への項目追加
```

#### Level 3: 中程度（4-8時間）

```markdown
1. [ ] 新しいジェスチャーパターンの追加
2. [ ] 環境プリセットの追加
3. [ ] パフォーマンス最適化
4. [ ] アクセシビリティ改善
```

#### Level 4: 高度（8+時間）

```markdown
1. [ ] 新しいVRモジュールの実装
2. [ ] WebXR API の新機能統合
3. [ ] アーキテクチャの改善
4. [ ] 大規模リファクタリング
```

### 最初のPRチェックリスト

```markdown
PR作成前の確認:
- [ ] すべてのテストがパス
- [ ] リンターエラーなし
- [ ] フォーマット済み
- [ ] ドキュメント更新済み
- [ ] CHANGELOG.md 更新済み
- [ ] コミットメッセージが適切
- [ ] PR説明が詳細
- [ ] スクリーンショット追加（UI変更の場合）
```

---

## ベストプラクティス / Best Practices

### コーディング規約

#### JavaScript スタイル

```javascript
// ✅ 良い例
class VRModule {
  constructor() {
    this.initialized = false;
  }

  init(scene, camera) {
    if (this.initialized) {
      console.warn('Already initialized');
      return;
    }

    this.scene = scene;
    this.camera = camera;
    this.initialized = true;
  }
}

// ❌ 悪い例
class vrmodule {
  constructor() {
    this.init = false  // セミコロンなし
  }

  init(scene,camera){  // スペースなし
    this.scene=scene   // スペースなし、セミコロンなし
  }
}
```

#### コメント規約

```javascript
// ✅ 良い例（日本語・英語両方）
/**
 * VRセッションを開始します / Start VR session
 * @param {Object} options - セッションオプション / Session options
 * @returns {Promise<XRSession>} VRセッション / VR session
 */
async startVRSession(options) {
  // WebXR サポートチェック / Check WebXR support
  if (!navigator.xr) {
    throw new Error('WebXR not supported');
  }
  // ...
}

// ❌ 悪い例
// start vr
async startVRSession(options) {
  // ...
}
```

### テストのベストプラクティス

```javascript
// ✅ 良い例 - AAA パターン
describe('VRTextRenderer', () => {
  test('should calculate correct font size', () => {
    // Arrange（準備）
    const renderer = new VRTextRenderer();
    const distance = 2.0;

    // Act（実行）
    const fontSize = renderer.calculateFontSize(distance);

    // Assert（検証）
    expect(fontSize).toBeGreaterThanOrEqual(32);
    expect(fontSize).toBeLessThanOrEqual(128);
  });
});
```

### パフォーマンス最適化

```javascript
// ✅ 良い例 - オブジェクトプーリング
class ObjectPool {
  constructor(createFn, size = 100) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      this.pool.push(createFn());
    }
  }

  acquire() {
    return this.pool.pop() || this.createFn();
  }

  release(obj) {
    this.pool.push(obj);
  }
}

// ❌ 悪い例 - 毎回新規作成
function createObject() {
  return new ExpensiveObject();
}
```

---

## 📚 学習リソース / Learning Resources

### 必読ドキュメント

```markdown
- [ ] MDN WebXR Device API
      https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API

- [ ] Three.js Documentation
      https://threejs.org/docs/

- [ ] Web Audio API
      https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

- [ ] Service Worker API
      https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
```

### 推奨チュートリアル

```markdown
- [ ] WebXR Tutorial (Immersive Web)
- [ ] Three.js Fundamentals
- [ ] Jest Testing Tutorial
- [ ] Git & GitHub Workflow
```

---

## 🤝 サポート / Support

### 質問がある場合

```markdown
1. [ ] FAQ を確認
2. [ ] GitHub Discussions で検索
3. [ ] 新しい Discussion を作成
4. [ ] Discord/Slack でチーム に質問
```

### コードレビュー

```markdown
レビューを依頼する:
- [ ] PR を作成
- [ ] レビュワーを指定
- [ ] CI が全てパスするまで待つ
- [ ] フィードバックに対応
```

---

## ✅ オンボーディング完了チェックリスト

```markdown
Week 1:
- [ ] 環境セットアップ完了
- [ ] プロジェクト構造理解
- [ ] 主要ドキュメント読了
- [ ] コードベースの理解
- [ ] 最初のコミット

Week 2:
- [ ] 最初のPR作成
- [ ] コードレビュー経験
- [ ] テスト作成経験
- [ ] CI/CD 理解

Week 3-4:
- [ ] 独立して機能実装
- [ ] チームとの協力
- [ ] ベストプラクティス習得
```

---

**開発者コミュニティへようこそ！**
**Welcome to the developer community!** 🎉

質問や不明点があれば、遠慮なくチームに聞いてください。
*If you have questions, don't hesitate to ask the team!*

---

**最終更新 / Last Updated:** 2025-10-19
**バージョン / Version:** 2.0.0

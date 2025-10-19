# VR Browser Examples

Qui Browser VRの機能を実際に体験できるサンプルページ集です。

## サンプル一覧

### 1. Basic VR Setup (`basic-vr-setup.html`)

**目的**: VRブラウザの基本的なセットアップと使い方を学ぶ

**含まれる機能**:
- ✅ VRセッション管理（起動/終了）
- ✅ テキストレンダリング（3Dスプライト）
- ✅ エルゴノミクスUI（ボタン配置）
- ✅ 快適性システム（モーションシックネス防止）
- ✅ 入力最適化（視線、ハンド、コントローラー）
- ✅ 通知システム

**使い方**:
1. Meta Quest、Picoなどのブラウザで開く
2. 「VRモード起動」ボタンをクリック
3. WebXR権限を許可
4. VR空間で表示されるボタンや3Dオブジェクトをインタラクション

**学習ポイント**:
```javascript
// VRシステムの基本的な初期化
const ergoUI = new VRErgonomicUI();
ergoUI.init(camera, scene);

// エルゴノミクスゾーンにUIを配置
ergoUI.positionInViewingZone(button, {
    zone: 'primary',
    distance: 2.0,
    horizontalAngle: -15,
    verticalAngle: -10,
    anchorMode: 'lazy-follow'
});
```

**推奨デバイス**: Meta Quest 2/3, Pico 4, WebXR対応ヘッドセット

---

### 2. Advanced Features (`advanced-features.html`)

**目的**: 高度なVR機能を全て体験する

**含まれる機能**:
- ✅ 環境カスタマイズ（6プリセット）
- ✅ UIレイアウト切り替え（4プリセット）
- ✅ 3Dブックマーク（4レイアウト）
- ✅ 3Dタブマネージャー（4レイアウト）
- ✅ 空間オーディオ（3D HRTF）
- ✅ ジェスチャーマクロ（録画/再生）
- ✅ パフォーマンスプロファイラー
- ✅ コンテンツ最適化

**使い方**:
1. VRモードで起動
2. 右側のコントロールパネルで各種設定を変更
3. 環境プリセットを切り替えて雰囲気を変更
4. ブックマークやタブのレイアウトを変更
5. 空間オーディオをテスト
6. ジェスチャーマクロを録画して再生
7. パフォーマンスプロファイラーでボトルネック検出

**学習ポイント**:
```javascript
// 環境カスタマイズ
envCustomizer.setEnvironmentPreset('space');

// 3Dブックマーク
bookmark3D.setLayout('sphere');
bookmark3D.addBookmark({
    title: 'Example',
    url: 'https://example.com',
    category: 'favorites'
});

// 空間オーディオ
spatialAudio.playSound('click', position, { volume: 0.8 });

// パフォーマンスプロファイリング
profiler.startProfiling();
// ... 5秒後
const results = profiler.stopProfiling();
const recommendations = profiler.getRecommendations();
```

**推奨デバイス**: Meta Quest 3, Pico 4（高性能）

---

## ファイル構成

```
examples/
├── README.md                    # このファイル
├── basic-vr-setup.html          # 基本セットアップ
├── advanced-features.html       # 高度な機能デモ
└── config/
    ├── performance-low.json     # 低スペック設定
    └── performance-high.json    # 高スペック設定
```

---

## セットアップ方法

### ローカルサーバーで実行

**Python 3**:
```bash
cd "Qui Browser"
python -m http.server 8000
```

**Node.js (http-server)**:
```bash
npm install -g http-server
cd "Qui Browser"
http-server -p 8000
```

**アクセス**:
1. VRデバイスのブラウザを開く
2. `http://[PCのIPアドレス]:8000/examples/` にアクセス
3. サンプルを選択

### GitHub Pagesでホスティング

1. GitHubリポジトリにプッシュ
2. Settings > Pages > Source: `main` branch
3. `https://[username].github.io/qui-browser-vr/examples/` でアクセス

---

## デバイス別の注意点

### Meta Quest 2/3

**最適設定**:
- リフレッシュレート: 90Hz（Quest 2）/ 120Hz（Quest 3）
- 解像度スケール: 100%
- ハンドトラッキング: オン（推奨）

**既知の問題**:
- Quest 2では120Hzは利用不可
- 一部のWebXR APIは実験的機能として有効化が必要

### Pico 4

**最適設定**:
- リフレッシュレート: 90Hz
- 解像度スケール: 100%
- ハンドトラッキング: 実験的機能で有効化

**既知の問題**:
- ハンドトラッキングはファームウェアv5.7.0+が必要
- 一部の空間オーディオ機能は制限あり

### HTC Vive / その他

**最適設定**:
- SteamVR経由でアクセス
- Chrome/Edge推奨
- コントローラー必須

---

## パフォーマンス最適化

### 低スペックデバイス向け

`examples/config/performance-low.json`:
```json
{
  "display": {
    "targetFPS": 72,
    "resolutionScale": 0.7,
    "antialiasing": false,
    "foveatedRendering": true
  },
  "environment": {
    "preset": "minimal",
    "particles": false,
    "fog": false
  },
  "performance": {
    "cacheStrategy": "aggressive",
    "preload": false
  }
}
```

**適用方法**:
```javascript
fetch('/examples/config/performance-low.json')
    .then(r => r.json())
    .then(config => {
        // 設定を適用
        contentOptimizer.updateSettings(config);
    });
```

### 高スペックデバイス向け

`examples/config/performance-high.json`:
```json
{
  "display": {
    "targetFPS": 120,
    "resolutionScale": 1.2,
    "antialiasing": true,
    "foveatedRendering": false
  },
  "environment": {
    "preset": "cyberpunk",
    "particles": true,
    "particleCount": 5000,
    "fog": true
  },
  "performance": {
    "cacheStrategy": "balanced",
    "preload": true
  }
}
```

---

## トラブルシューティング

### Q: VRモードが起動しない

**解決策**:
1. HTTPSでアクセスしているか確認（`https://`）
2. WebXRサポートを確認:
   ```javascript
   navigator.xr?.isSessionSupported('immersive-vr')
       .then(supported => console.log('WebXR:', supported));
   ```
3. ブラウザを最新版に更新

### Q: パフォーマンスが低い（<72 FPS）

**解決策**:
1. 低スペック設定を適用
2. 環境を「Minimal」に変更
3. パーティクルを無効化
4. 解像度スケールを下げる（70-80%）

### Q: ハンドトラッキングが動作しない

**解決策**:
1. デバイス設定でハンドトラッキング有効化
2. 十分な照明を確保
3. 手をカメラの視野内に配置
4. ブラウザでハンドトラッキング権限を許可

### Q: 空間オーディオが聞こえない

**解決策**:
1. オーディオ権限を許可
2. ブラウザのオートプレイポリシーを確認
3. ユーザーインタラクション後に再生
4. 音量設定を確認

---

## カスタマイズ

### 独自のVRアプリを作成

サンプルをベースに独自のVRアプリを作成できます：

```javascript
// 1. Three.jsシーン作成
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.xr.enabled = true;

// 2. VRシステム初期化
const vrLauncher = new VRLauncher();
const ergoUI = new VRErgonomicUI();
ergoUI.init(camera, scene);

// 3. 独自コンテンツ追加
const myButton = ergoUI.createButton('My Button', {
    onClick: () => console.log('Clicked!'),
    width: 0.36,
    height: 0.12
});
scene.add(myButton);

// 4. VRモード起動
vrLauncher.enterVR();

// 5. レンダーループ
renderer.setAnimationLoop(() => {
    ergoUI.update(clock.getDelta());
    renderer.render(scene, camera);
});
```

---

## 次のステップ

1. **基本を理解**: `basic-vr-setup.html` から始める
2. **高度な機能を試す**: `advanced-features.html` で全機能を体験
3. **APIドキュメント参照**: `/docs/API.md` で詳細を確認
4. **独自アプリ作成**: サンプルをベースにカスタマイズ
5. **コミュニティ参加**: GitHubで質問やフィードバック

---

## リソース

- **APIドキュメント**: `/docs/API.md`
- **使用ガイド**: `/docs/USAGE_GUIDE.md`
- **GitHub**: https://github.com/yourusername/qui-browser-vr
- **Issues**: https://github.com/yourusername/qui-browser-vr/issues

---

**Version**: 2.0.0
**Last Updated**: 2025-10-19
**License**: MIT

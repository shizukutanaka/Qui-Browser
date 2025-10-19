# よくある質問 / Frequently Asked Questions (FAQ)

Qui Browser VR についてよく寄せられる質問と回答
*Frequently asked questions and answers about Qui Browser VR*

---

## 📋 目次 / Table of Contents

1. [一般的な質問 / General Questions](#一般的な質問--general-questions)
2. [技術的な質問 / Technical Questions](#技術的な質問--technical-questions)
3. [パフォーマンス / Performance](#パフォーマンス--performance)
4. [互換性 / Compatibility](#互換性--compatibility)
5. [トラブルシューティング / Troubleshooting](#トラブルシューティング--troubleshooting)
6. [開発 / Development](#開発--development)

---

## 一般的な質問 / General Questions

### Q1: Qui Browser VR とは何ですか？ / What is Qui Browser VR?

**A:** Qui Browser VR は、Meta Quest、Picoなどの VR デバイス向けに最適化された軽量の WebXR ブラウザです。3D UI、ハンドトラッキング、空間オーディオなど、35+ の VR モジュールを搭載しています。

*Qui Browser VR is a lightweight WebXR browser optimized for VR devices like Meta Quest and Pico. It features 35+ VR modules including 3D UI, hand tracking, and spatial audio.*

---

### Q2: 無料で使えますか？ / Is it free to use?

**A:** はい、完全に無料です。MIT ライセンスの下でオープンソースとして提供されています。

*Yes, it's completely free. It's provided as open source under the MIT License.*

```
MIT License - 商用利用、修正、配布が自由
Commercial use, modification, and distribution are permitted
```

---

### Q3: どのVRデバイスに対応していますか？ / Which VR devices are supported?

**A:** 以下のデバイスに対応しています：
*The following devices are supported:*

✅ **完全対応 / Fully Supported:**
- Meta Quest 2
- Meta Quest 3
- Meta Quest Pro
- Pico 4
- Pico Neo 3

⚠️ **部分的対応 / Partially Supported:**
- HTC Vive Focus
- その他の WebXR 対応デバイス

---

### Q4: インストールは必要ですか？ / Do I need to install anything?

**A:** いいえ、インストール不要です。VR デバイスのブラウザで直接アクセスできます。

*No installation required. You can access it directly from your VR device's browser.*

**アクセス方法 / Access method:**
1. VR デバイスのブラウザを開く / Open browser on VR device
2. URL を入力 / Enter URL
3. "Enter VR" ボタンをクリック / Click "Enter VR" button

---

### Q5: 日本語に対応していますか？ / Is Japanese supported?

**A:** はい、完全対応しています。

*Yes, fully supported.*

✅ 日本語 UI / Japanese UI
✅ 日本語音声コマンド / Japanese voice commands
✅ 日本語ドキュメント / Japanese documentation

**音声コマンド例 / Voice command examples:**
- "戻る" → 前のページ / Previous page
- "進む" → 次のページ / Next page
- "更新" → リロード / Reload

---

## 技術的な質問 / Technical Questions

### Q6: どの技術を使っていますか？ / What technologies are used?

**A:** 主要な技術スタック：
*Main technology stack:*

```
Frontend:
- WebXR Device API (VR/AR support)
- Three.js r152 (3D graphics)
- Web Audio API (spatial audio)
- Service Worker (offline support)

Architecture:
- Pure client-side (no server required)
- Progressive Web App (PWA)
- Modular design (35+ modules)

Languages:
- JavaScript (ES6+)
- HTML5
- CSS3
```

---

### Q7: サーバーは必要ですか？ / Do I need a server?

**A:** いいえ、完全にクライアントサイドで動作します。

*No, it runs entirely on the client side.*

**デプロイオプション / Deployment options:**
- GitHub Pages (無料 / Free)
- Netlify (無料 / Free)
- Vercel (無料 / Free)
- 静的ファイルサーバー / Static file server
- Docker コンテナ / Docker container

---

### Q8: オフラインで使えますか？ / Can I use it offline?

**A:** はい、Service Worker によるオフライン対応済みです。

*Yes, offline support is provided via Service Worker.*

**キャッシュされるもの / Cached content:**
- ✅ VR JavaScript モジュール (21+)
- ✅ CSS スタイル
- ✅ HTML ページ
- ✅ Three.js ライブラリ

**初回アクセス後、オフラインでも動作します。**
*Works offline after first visit.*

---

### Q9: データはどこに保存されますか？ / Where is data stored?

**A:** すべてローカルストレージに保存されます。

*All data is stored in local storage.*

**保存されるデータ / Stored data:**
- 設定 / Settings
- ブックマーク / Bookmarks
- 閲覧履歴 / Browsing history
- UI レイアウト / UI layout preferences

**サーバーへの送信は一切ありません。**
*No data is sent to servers.*

---

## パフォーマンス / Performance

### Q10: 推奨スペックは？ / What are the recommended specs?

**A:** デバイスごとの推奨設定：
*Recommended settings per device:*

**Meta Quest 3 / Pico 4:**
```
Target FPS: 120
Resolution Scale: 120%
Antialiasing: On
Environment: Cyberpunk (high quality)
```

**Meta Quest 2:**
```
Target FPS: 90
Resolution Scale: 100%
Antialiasing: Off
Foveated Rendering: On
Environment: Minimal (performance mode)
```

---

### Q11: FPS が低い場合はどうすればいいですか？ / What if FPS is low?

**A:** パフォーマンス最適化の手順：
*Performance optimization steps:*

**1. 設定を調整 / Adjust settings:**
```bash
Ctrl + , (Settings)
→ Performance
→ Select "Performance Mode"
```

**2. 環境を変更 / Change environment:**
```javascript
// Minimal environment (lightest)
Environment: Minimal
```

**3. FPS カウンターを無効化 / Disable FPS counter:**
```bash
Press 'P' to toggle performance monitor
```

**4. キャッシュをクリア / Clear cache:**
```javascript
Settings → Clear Cache
```

---

### Q12: メモリ使用量を減らすには？ / How to reduce memory usage?

**A:** メモリ最適化設定：
*Memory optimization settings:*

**設定ファイル例 / Example configuration:**
```json
{
  "vr_memory_limit_mb": 1536,
  "texture_cache_limit_mb": 256,
  "max_bookmarks_3d": 50,
  "max_tabs": 5,
  "enable_cache_trimming": true
}
```

**自動最適化 / Auto-optimization:**
- メモリ使用量が 1.5GB を超えると警告
- 2GB に達すると自動的にキャッシュクリア
- *Warning at 1.5GB usage*
- *Auto-clear cache at 2GB*

---

## 互換性 / Compatibility

### Q13: PC のブラウザで使えますか？ / Can I use it on PC browsers?

**A:** はい、WebXR 対応ブラウザなら使用可能です。

*Yes, if the browser supports WebXR.*

**対応ブラウザ / Supported browsers:**
- ✅ Chrome 90+ (with WebXR emulator)
- ✅ Edge 90+
- ⚠️ Firefox (experimental WebXR support)
- ❌ Safari (WebXR not supported)

**開発用 / For development:**
- [WebXR Emulator Extension](https://chrome.google.com/webstore/detail/webxr-api-emulator/) をインストール
- *Install WebXR Emulator Extension*

---

### Q14: スマートフォンで使えますか？ / Can I use it on smartphones?

**A:** 基本機能は使えますが、VR 機能は制限されます。

*Basic features work, but VR features are limited.*

**利用可能な機能 / Available features:**
- ✅ ブラウジング / Browsing
- ✅ ブックマーク / Bookmarks
- ✅ 設定 / Settings
- ❌ VR モード / VR mode
- ❌ ハンドトラッキング / Hand tracking
- ❌ 空間オーディオ / Spatial audio

---

### Q15: Oculus Rift や HTC Vive で使えますか？ / Can I use it with Oculus Rift or HTC Vive?

**A:** PC VR ヘッドセットは部分的にサポートされています。

*PC VR headsets are partially supported.*

**必要なもの / Requirements:**
- WebXR 対応ブラウザ (Chrome/Edge)
- SteamVR または Oculus ソフトウェア
- *WebXR-compatible browser*
- *SteamVR or Oculus software*

**制限事項 / Limitations:**
- ハンドトラッキングは非対応
- 一部の最適化が無効
- *Hand tracking not supported*
- *Some optimizations disabled*

---

## トラブルシューティング / Troubleshooting

### Q16: "Enter VR" ボタンが表示されない / "Enter VR" button doesn't appear

**A:** 以下を確認してください：
*Please check the following:*

**1. WebXR サポートを確認 / Check WebXR support:**
```javascript
// ブラウザコンソールで実行 / Run in browser console
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr')
    .then(supported => console.log('WebXR supported:', supported));
} else {
  console.log('WebXR not available');
}
```

**2. HTTPS 接続を確認 / Check HTTPS connection:**
- WebXR は HTTPS または localhost が必要
- *WebXR requires HTTPS or localhost*

**3. ブラウザを更新 / Update browser:**
- Meta Quest Browser を最新版に
- *Update to latest Meta Quest Browser*

---

### Q17: VR モードに入れない / Cannot enter VR mode

**A:** エラーメッセージを確認してください：
*Check the error message:*

**一般的なエラーと解決方法 / Common errors and solutions:**

| エラー / Error | 原因 / Cause | 解決方法 / Solution |
|---------------|-------------|-------------------|
| SecurityError | HTTP 接続 | HTTPS を使用 |
| NotAllowedError | ユーザーが拒否 | 再度クリック |
| NotFoundError | VR デバイス未接続 | デバイス接続確認 |

---

### Q18: ハンドトラッキングが動作しない / Hand tracking doesn't work

**A:** デバイス設定を確認してください：
*Check device settings:*

**Meta Quest の場合 / For Meta Quest:**
1. 設定 → 動作 → ハンドトラッキング → **オン**
   *Settings → Movement → Hand Tracking → ON*

2. コントローラーを置く
   *Put down controllers*

3. 明るい場所で使用
   *Use in well-lit area*

**Pico の場合 / For Pico:**
1. 設定 → ハンドトラッキング → **オン**
   *Settings → Hand Tracking → ON*

2. ハンドトラッキングモードに切り替え
   *Switch to hand tracking mode*

---

### Q19: 音が出ない / No sound

**A:** 音声設定を確認してください：
*Check audio settings:*

**1. ブラウザの権限 / Browser permissions:**
```
アドレスバー → サイト設定 → 音声 → 許可
Address bar → Site settings → Audio → Allow
```

**2. 空間オーディオの確認 / Check spatial audio:**
```javascript
// ブラウザコンソールで確認 / Check in console
VRSpatialAudio.isMuted()  // Should return false
```

**3. デバイスの音量 / Device volume:**
- VR デバイスの音量設定を確認
- *Check VR device volume settings*

---

### Q20: アプリがクラッシュする / App crashes

**A:** 以下の手順を試してください：
*Try the following steps:*

**1. キャッシュをクリア / Clear cache:**
```bash
Settings → Storage → Clear Cache
```

**2. ブラウザを再起動 / Restart browser:**
- Meta Quest Browser を完全に終了して再起動
- *Completely close and restart Meta Quest Browser*

**3. デバイスを再起動 / Restart device:**
- VR デバイスを再起動
- *Restart VR device*

**4. Issue を報告 / Report issue:**
- [GitHub Issues](https://github.com/yourusername/qui-browser-vr/issues) に報告
- ブラウザコンソールのエラーを添付
- *Report on GitHub Issues*
- *Attach browser console errors*

---

## 開発 / Development

### Q21: カスタムモジュールを追加できますか？ / Can I add custom modules?

**A:** はい、プラグインシステムで追加可能です。

*Yes, you can add them via the plugin system.*

**例 / Example:**
```javascript
// カスタムモジュールの作成 / Create custom module
class VRCustomModule {
  init(scene, camera, renderer) {
    console.log('Custom module initialized');
  }

  update(deltaTime) {
    // 毎フレーム更新 / Update every frame
  }
}

// 登録 / Register
const customModule = new VRCustomModule();
customModule.init(scene, camera, renderer);
```

詳細は [ARCHITECTURE.md](./ARCHITECTURE.md#拡張性--extensibility) を参照してください。
*See [ARCHITECTURE.md](./ARCHITECTURE.md#extensibility) for details.*

---

### Q22: ローカル開発環境のセットアップ方法は？ / How to set up local development?

**A:** [QUICK_START.md](./QUICK_START.md) を参照してください。

*See [QUICK_START.md](./QUICK_START.md).*

**簡易手順 / Quick steps:**
```bash
# 1. クローン / Clone
git clone https://github.com/yourusername/qui-browser-vr.git
cd qui-browser-vr

# 2. 依存関係インストール / Install dependencies
npm install

# 3. 開発サーバー起動 / Start dev server
npx http-server -p 8080

# 4. VR デバイスでアクセス / Access from VR device
# http://[YOUR_PC_IP]:8080
```

---

### Q23: テストはどう書けばいいですか？ / How do I write tests?

**A:** Jest を使用してテストを記述します。

*Write tests using Jest.*

**テスト例 / Test example:**
```javascript
// tests/custom.test.js
describe('Custom VR Module', () => {
  test('should initialize correctly', () => {
    const module = new VRCustomModule();
    module.init();

    expect(module.initialized).toBe(true);
  });
});
```

**実行 / Run:**
```bash
npm test
```

詳細は [TESTING.md](./TESTING.md) を参照してください。
*See [TESTING.md](./TESTING.md) for details.*

---

### Q24: パフォーマンステストはどうやって実行しますか？ / How do I run performance tests?

**A:** ベンチマークツールを使用します。

*Use the benchmark tool.*

```bash
# 全モジュールをベンチマーク / Benchmark all modules
npm run benchmark:all

# 特定のモジュール / Specific module
npm run benchmark -- --module vr-text-renderer --iterations 1000

# レポート生成 / Generate report
npm run benchmark:report
```

詳細は [tools/README.md](../tools/README.md) を参照してください。
*See [tools/README.md](../tools/README.md) for details.*

---

### Q25: 貢献するにはどうすればいいですか？ / How can I contribute?

**A:** [CONTRIBUTING.md](../CONTRIBUTING.md) を参照してください。

*See [CONTRIBUTING.md](../CONTRIBUTING.md).*

**貢献方法 / Ways to contribute:**
1. 🐛 バグ報告 / Bug reports
2. ✨ 機能提案 / Feature requests
3. 📖 ドキュメント改善 / Documentation improvements
4. 💻 コード貢献 / Code contributions
5. 🌍 翻訳 / Translations

**プルリクエストの手順 / PR process:**
```bash
# 1. フォーク / Fork
# 2. ブランチ作成 / Create branch
git checkout -b feature/my-feature

# 3. 変更を実装 / Implement changes
# 4. テスト / Test
npm test

# 5. コミット / Commit
git commit -m "Add my feature"

# 6. プッシュ / Push
git push origin feature/my-feature

# 7. PR作成 / Create PR
```

---

## さらなる質問 / More Questions?

質問が解決しない場合：
*If your question wasn't answered:*

1. 📖 [完全なドキュメント](./USAGE_GUIDE.md)を確認
   *Check the [complete documentation](./USAGE_GUIDE.md)*

2. 🔍 [GitHub Issues](https://github.com/yourusername/qui-browser-vr/issues) を検索
   *Search [GitHub Issues](https://github.com/yourusername/qui-browser-vr/issues)*

3. 💬 [Discussions](https://github.com/yourusername/qui-browser-vr/discussions) で質問
   *Ask in [Discussions](https://github.com/yourusername/qui-browser-vr/discussions)*

4. 📧 メール: support@qui-browser.example.com
   *Email: support@qui-browser.example.com*

---

**最終更新 / Last Updated:** 2025-10-19
**バージョン / Version:** 2.0.0

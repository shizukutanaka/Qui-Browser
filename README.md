# Qui Browser VR

**軽量WebXR VRブラウザ - Meta Quest、Pico、その他VRデバイス向け**

## 概要

Qui Browser VRは、VRヘッドセット向けに最適化された軽量Webブラウザです。純粋なクライアントサイドアプリケーションとして動作し、WebXR APIを活用した没入型ブラウジング体験を提供します。

### 主な特徴

- **WebXR対応** - 完全なVR/AR体験をサポート
- **軽量設計** - 依存関係ゼロ、わずか4.5MBのフットプリント
- **PWA対応** - オフライン動作とアプリインストール可能
- **VR最適化UI** - 3D空間での快適な操作
- **マルチデバイス対応** - Meta Quest、Pico、HTC Vive等に対応
- **高パフォーマンス** - 90Hz/120Hz対応、低レイテンシ
- **セキュア** - CSP、XSS対策、安全なブラウジング

## 対応デバイス

- Meta Quest 2 / 3 / Pro
- Pico 4 / Neo 3
- HTC Vive Focus
- その他WebXR対応VRヘッドセット

## 使い方

### 方法1: VRデバイスで直接アクセス

1. VRヘッドセットのブラウザを開く
2. プロジェクトをホスティング（GitHub Pages、Netlify等）
3. URLにアクセス
4. VRモードを起動

### 方法2: ローカルサーバーで開発

```bash
# Python 3を使用
python -m http.server 8000

# または npm経由
npm run serve
```

その後、VRデバイスのブラウザで `http://[あなたのIPアドレス]:8000` にアクセス

### 方法3: PWAとしてインストール

1. VRデバイスのブラウザでサイトにアクセス
2. メニューから「ホーム画面に追加」を選択
3. インストール後、アプリとして起動

## ファイル構成

```
Qui Browser/
├── index.html              # メインエントリーポイント
├── manifest.json           # PWAマニフェスト
├── package.json           # プロジェクト設定
├── LICENSE                # MITライセンス
├── README.md              # このファイル
├── public/                # 公開ファイル
│   ├── vr-browser.html    # VRブラウザUI
│   ├── vr-video.html      # VR動画プレーヤー
│   ├── sw.js              # Service Worker
│   ├── offline.html       # オフラインページ
│   └── manifest.json      # PWA設定
└── assets/                # リソース
    ├── icon.svg           # アプリアイコン
    ├── icons/             # 各種サイズのアイコン
    ├── js/                # JavaScriptモジュール
    │   ├── browser-core.js
    │   ├── webxr-integration.js
    │   ├── vr-*.js        # VR関連機能
    │   └── ...
    └── styles/            # スタイルシート（存在する場合）
```

## 機能

### VRブラウジング

- **3D UI** - 空間に配置されたブラウザUI
- **ハンドトラッキング** - コントローラー不要の操作
- **ジェスチャーコントロール** - 直感的な操作
- **音声コマンド** - ハンズフリー操作
- **マルチタブ** - VR空間で複数タブを同時表示

### パフォーマンス

- **高フレームレート** - 90Hz/120Hz対応
- **低レイテンシ** - 即座のレスポンス
- **効率的なメモリ管理** - 長時間使用可能
- **バッテリー最適化** - 省電力設計

### セキュリティ

- **Content Security Policy** - XSS攻撃防止
- **安全な通信** - HTTPS優先
- **プライバシー保護** - トラッキング防止
- **サンドボックス化** - 安全な実行環境

## 開発

### 前提条件

- WebXR対応ブラウザ
- HTTPS環境（開発時はlocalhostでOK）
- 静的ファイルサーバー

### カスタマイズ

VRブラウザの動作をカスタマイズするには、以下のファイルを編集します：

- `assets/js/browser-core.js` - コアブラウザ機能
- `assets/js/webxr-integration.js` - WebXR統合
- `assets/js/vr-*.js` - 各種VR機能

### デバッグ

VRデバイスでのデバッグ：

1. **Chrome DevTools**（Meta Quest）
   ```bash
   adb connect [デバイスIP]:5555
   chrome://inspect
   ```

2. **コンソールログ**
   ```javascript
   console.log('Debug message');
   ```

3. **パフォーマンスモニター**
   - VR内で統計情報を表示

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 貢献

プルリクエストを歓迎します！大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## サポート

- **Issues**: [GitHub Issues](https://github.com/yourusername/qui-browser/issues)
- **Discussions**: コミュニティフォーラム
- **Email**: support@qui-browser.example.com

## ロードマップ

### v2.1（予定）

- [ ] 音声アシスタント統合
- [ ] AI駆動の推奨機能
- [ ] マルチプレイヤーブラウジング
- [ ] クラウド同期

### v2.2（予定）

- [ ] 360度動画サポート強化
- [ ] WebGPU対応
- [ ] 拡張機能システム
- [ ] テーマカスタマイズ

## 参考リンク

- [WebXR Device API](https://www.w3.org/TR/webxr/)
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Meta Quest Development](https://developer.oculus.com/)
- [Pico Development](https://developer-global.pico-interactive.com/)

## クレジット

Qui Browser VR Team により開発・メンテナンス

---

**Version**: 2.0.0
**Last Updated**: 2025-10-19
**Status**: Production Ready ✅

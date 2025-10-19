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

- **3D UI** - 空間に配置されたブラウザUI（4つのレイアウトプリセット）
- **ハンドトラッキング** - WebXRハンドトラッキング対応、コントローラー不要
- **ジェスチャーコントロール** - 12種類のジェスチャーパターン認識
- **音声コマンド** - 日本語音声コマンド対応（戻る、進む、更新など）
- **マルチタブ** - 3D空間で最大10タブを同時管理（Arc/Stack/Grid/Cylinderレイアウト）
- **3Dブックマーク** - 4つの3D視覚化レイアウト（Grid/Sphere/Wall/Carousel）
- **環境カスタマイズ** - 6つのプリセット環境（宇宙、森、海、ミニマル、夕焼け、サイバーパンク）
- **ジェスチャーマクロ** - カスタムジェスチャーシーケンスの録画・再生

### パフォーマンス

- **高フレームレート** - 90Hz/120Hz対応（90FPS最適、72FPS最小）
- **低レイテンシ** - 即座のレスポンス（11.1ms目標フレームタイム）
- **効率的なメモリ管理** - 長時間使用可能（2GB制限内で動作）
- **バッテリー最適化** - 省電力設計、バッテリー監視機能
- **パフォーマンスプロファイラー** - リアルタイムFPS/CPU/GPU/メモリ監視
- **ボトルネック検出** - 自動パフォーマンス問題検出と最適化提案
- **動的品質調整** - パフォーマンスに応じた自動品質調整
- **コンテンツ最適化** - 360°動画/画像の適応的ビットレート調整

### セキュリティ & アクセシビリティ

- **Content Security Policy** - XSS攻撃防止
- **安全な通信** - HTTPS優先
- **プライバシー保護** - トラッキング防止
- **サンドボックス化** - 安全な実行環境
- **WCAG AAA準拠** - 7.0+コントラスト比、完全なアクセシビリティ
- **テキスト拡大** - 0.5-2.0倍のテキストスケーリング（48px最小）
- **ハイコントラストテーマ** - 3つのテーマ（ダーク、ライト、黄色-黒）
- **色覚異常対応** - 3種類のフィルター（第1、第2、第3色覚異常）
- **モーション軽減** - アニメーション無効化オプション
- **スクリーンリーダー** - VR空間でのスクリーンリーダー対応
- **視線トラッキング** - 800ms滞留時間での選択
- **VR快適性システム** - モーションシックネス防止（ビネット、テレポート、90FPS維持）

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

#### 主要VRモジュール（35+）

**UI/UX最適化**:
- `vr-text-renderer.js` - 研究ベースのテキストレンダリング（650行）
- `vr-ergonomic-ui.js` - エルゴノミクスUI配置（620行）
- `vr-comfort-system.js` - モーションシックネス防止（590行）
- `vr-input-optimizer.js` - マルチモーダル入力（680行）
- `vr-accessibility-enhanced.js` - アクセシビリティ（720行）

**高度な機能**:
- `vr-environment-customizer.js` - 環境カスタマイズ（680行）
- `vr-gesture-macro.js` - ジェスチャーマクロ（790行）
- `vr-content-optimizer.js` - コンテンツ最適化（650行）
- `vr-performance-profiler.js` - パフォーマンスプロファイリング（580行）

**3D視覚化**:
- `vr-bookmark-3d.js` - 3Dブックマーク（590行）
- `vr-tab-manager-3d.js` - 3Dタブマネージャー（595行）
- `vr-spatial-audio.js` - 空間オーディオ（449行）

**インタラクション**:
- `vr-hand-tracking.js` - ハンドトラッキング（450行）
- `vr-gesture-scroll.js` - ジェスチャースクロール（487行）
- `vr-keyboard.js` - 仮想キーボード（550行）
- `vr-navigation.js` - VRナビゲーション（550行）

**メディア**:
- `vr-video-player.js` - 360°/180°ビデオプレーヤー（600行）

**コア機能**:
- `vr-launcher.js` - VRモード起動（195行）
- `vr-utils.js` - ユーティリティ（340行）
- `vr-settings.js` - 設定管理（450行）
- `vr-performance-monitor.js` - パフォーマンス監視（330行）

**総コード量**: 約23,000+行

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

## 技術仕様

### VR UI/UX最適化（研究ベース）

- **テキストレンダリング** - 1.33°-3.45°視野角に基づく最適フォントサイズ計算
- **エルゴノミクスUI** - 快適視野ゾーン（プライマリ: ±30°水平、±15°垂直）
- **UIアンカリング** - 4つのモード（World、Head、Smooth-Follow、Lazy-Follow）
- **最適視距離** - 2.0m標準、0.5-3.0m範囲
- **最小ボタンサイズ** - 8cm（推奨12cm）
- **コントラスト比** - WCAG AAA 7.0+

### 入力システム

- **マルチモーダル入力** - 視線（1s滞留）、ハンド、コントローラー、ハイブリッド
- **ジェスチャー認識** - スワイプ（4方向）、円描画、ピンチ、グラブ、ポイント、ウェーブ、静的ポーズ
- **触覚フィードバック** - ハプティック統合
- **音声コントロール** - 日本語コマンド対応

### コンテンツサポート

- **360°動画** - 4K解像度、適応的ビットレートストリーミング
- **360°画像** - 8K解像度、プログレッシブロード
- **WebXRシーン** - マテリアル/ジオメトリ最適化、LODシステム
- **空間オーディオ** - 3D HRTF位置オーディオ（10種のUIサウンド）

### パフォーマンス目標

- **FPS**: 90（最適）/ 72（最小）/ 60（クリティカル）
- **フレームタイム**: 11.1ms（最適）/ 13.9ms（許容）/ 16.7ms（クリティカル）
- **メモリ**: 2GB制限、1.5GB警告閾値
- **視野角**: 90°水平FOV
- **リフレッシュレート**: 90Hz/120Hz対応

## ロードマップ

### v2.0.0（現在） ✅

- [x] 35+ VRモジュール実装
- [x] UI/UX最適化システム
- [x] 環境カスタマイズ（6プリセット）
- [x] ジェスチャーマクロシステム
- [x] コンテンツ最適化
- [x] パフォーマンスプロファイラー
- [x] WCAG AAA準拠
- [x] 日本語サポート

### v2.1.0（予定）

- [ ] AI駆動のコンテンツ推奨
- [ ] マルチプレイヤーブラウジング（共有セッション）
- [ ] クラウド同期（ブックマーク、履歴、設定）
- [ ] 拡張ジェスチャーライブラリ
- [ ] VRキーボード改善（予測入力）

### v2.2.0（予定）

- [ ] WebGPU対応（高度なレンダリング）
- [ ] 拡張機能システム
- [ ] カスタムテーマエディター
- [ ] 高度な空間オーディオ（Dolby Atmos）
- [ ] アバターシステム

### v3.0.0（長期）

- [ ] フルARモード対応
- [ ] ニューラルレンダリング
- [ ] ブレインコンピューターインターフェース統合
- [ ] メタバース統合

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

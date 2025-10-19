# クイックスタートガイド / Quick Start Guide

このガイドでは、Qui Browser VR を最速で開始する方法を説明します。
*This guide will help you get started with Qui Browser VR as quickly as possible.*

---

## 📋 目次 / Table of Contents

1. [必要なもの / Prerequisites](#必要なもの--prerequisites)
2. [開発環境のセットアップ / Development Setup](#開発環境のセットアップ--development-setup)
3. [プロジェクトの起動 / Running the Project](#プロジェクトの起動--running-the-project)
4. [VRデバイスでのテスト / Testing on VR Devices](#vrデバイスでのテスト--testing-on-vr-devices)
5. [基本的な使い方 / Basic Usage](#基本的な使い方--basic-usage)
6. [よくある問題 / Common Issues](#よくある問題--common-issues)

---

## 必要なもの / Prerequisites

### VRデバイス / VR Device (推奨 / Recommended)

以下のいずれかのデバイスがあると最適です：
*One of the following devices is optimal:*

- ✅ Meta Quest 2 / 3 / Pro
- ✅ Pico 4 / Neo 3
- ✅ HTC Vive Focus
- ⚠️ PC + WebXR対応ブラウザ（開発用）/ PC + WebXR browser (for development)

### ソフトウェア / Software

```bash
# 必須 / Required
Node.js: v18.0.0 以上 / v18.0.0 or higher
npm: v9.0.0 以上 / v9.0.0 or higher

# 推奨 / Recommended
Git: 最新版 / latest version
Visual Studio Code: 最新版 / latest version
```

**確認方法 / Check versions:**

```bash
node --version   # v20.x.x 推奨 / recommended
npm --version    # v10.x.x 推奨 / recommended
git --version    # 2.x.x 以上 / or higher
```

---

## 開発環境のセットアップ / Development Setup

### 1. リポジトリのクローン / Clone Repository

```bash
# HTTPSでクローン / Clone via HTTPS
git clone https://github.com/yourusername/qui-browser-vr.git

# SSHでクローン / Clone via SSH
git clone git@github.com:yourusername/qui-browser-vr.git

# ディレクトリに移動 / Navigate to directory
cd qui-browser-vr
```

### 2. 依存関係のインストール / Install Dependencies

```bash
# 依存パッケージをインストール / Install dependencies
npm install

# または開発用依存関係も含めて / Or with dev dependencies
npm ci
```

**インストールされるもの / What gets installed:**

- Three.js (3D graphics library)
- Jest (testing framework)
- Babel (JavaScript transpiler)
- その他の開発ツール / Other dev tools

### 3. 環境設定 / Environment Configuration

```bash
# .env.exampleをコピー / Copy example env file
cp .env.example .env

# 必要に応じて編集 / Edit as needed
nano .env  # または / or: code .env
```

**主要な設定項目 / Key configuration options:**

```bash
# .env ファイル
NODE_ENV=development              # 開発モード / development mode
VR_BROWSER_VERSION=2.0.0         # バージョン / version
VR_DEFAULT_FPS_TARGET=90         # 目標FPS / target FPS
VR_MIN_FPS_TARGET=72             # 最低FPS / minimum FPS
VR_MEMORY_LIMIT_MB=2048          # メモリ制限 / memory limit
DEFAULT_ENVIRONMENT=space        # デフォルト環境 / default environment
DEFAULT_UI_LAYOUT=comfortable    # デフォルトUIレイアウト / default UI layout
```

---

## プロジェクトの起動 / Running the Project

### ローカル開発サーバー / Local Development Server

#### 方法1: シンプルなHTTPサーバー / Simple HTTP Server

```bash
# Node.jsの http-server を使用 / Use Node.js http-server
npx http-server -p 8080 -c-1

# または Python を使用（Python 3）/ Or use Python (Python 3)
python -m http.server 8080

# または Python 2 の場合 / Or Python 2
python -m SimpleHTTPServer 8080
```

ブラウザで開く: `http://localhost:8080`
*Open in browser: `http://localhost:8080`*

#### 方法2: Live Server (VSCode拡張機能) / Live Server (VSCode Extension)

1. VSCodeで [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) をインストール
   *Install Live Server extension in VSCode*

2. `index.html` を右クリック → "Open with Live Server"
   *Right-click `index.html` → "Open with Live Server"*

3. 自動的にブラウザが開きます（通常 `http://127.0.0.1:5500`）
   *Browser opens automatically (usually `http://127.0.0.1:5500`)*

#### 方法3: Docker を使用 / Using Docker

```bash
# Dockerイメージをビルド / Build Docker image
npm run docker:build

# コンテナを起動 / Run container
npm run docker:run

# または docker-compose を使用 / Or use docker-compose
npm run docker:compose
```

アクセス: `http://localhost:8080`
*Access: `http://localhost:8080`*

---

## VRデバイスでのテスト / Testing on VR Devices

### Meta Quest での手順 / Steps for Meta Quest

#### 1. 開発者モードを有効化 / Enable Developer Mode

1. Meta Quest アプリ（スマートフォン）を開く
   *Open Meta Quest app on smartphone*

2. デバイス → 開発者モード → オンにする
   *Device → Developer Mode → Turn ON*

3. ヘッドセットを再起動
   *Restart headset*

#### 2. 同じWi-Fiネットワークに接続 / Connect to Same WiFi

- PCとMeta Questを同じWi-Fiに接続
  *Connect PC and Meta Quest to same WiFi*

- PCのIPアドレスを確認:
  *Check PC's IP address:*

```bash
# Windows
ipconfig | findstr IPv4

# macOS/Linux
ifconfig | grep inet
```

#### 3. VRブラウザでアクセス / Access in VR Browser

1. Meta Quest Browser を起動
   *Launch Meta Quest Browser*

2. アドレスバーに入力:
   *Enter in address bar:*
   ```
   http://[YOUR_PC_IP]:8080
   ```
   例 / Example: `http://192.168.1.100:8080`

3. "Enter VR" ボタンをクリック
   *Click "Enter VR" button*

#### 4. HTTPSを使用する場合（推奨）/ Using HTTPS (Recommended)

WebXRは通常HTTPSを要求しますが、`localhost`は例外です。
*WebXR typically requires HTTPS, but `localhost` is an exception.*

**ngrokを使用してHTTPSトンネルを作成:**
*Create HTTPS tunnel using ngrok:*

```bash
# ngrokをインストール / Install ngrok
npm install -g ngrok

# トンネルを作成 / Create tunnel
ngrok http 8080

# 表示されたHTTPS URLをVRデバイスで開く
# Open the displayed HTTPS URL on VR device
```

### Pico での手順 / Steps for Pico

1. Pico Browser を起動
   *Launch Pico Browser*

2. PCのIPアドレスにアクセス（Meta Questと同じ手順）
   *Access PC's IP address (same as Meta Quest)*

3. WebXR権限を許可
   *Allow WebXR permissions*

---

## 基本的な使い方 / Basic Usage

### VRモードに入る / Entering VR Mode

1. ブラウザでアプリを開く
   *Open app in browser*

2. 右下の**浮遊する青いVRボタン**をクリック
   *Click the **floating blue VR button** in the bottom-right*

3. VRデバイスを装着
   *Put on VR headset*

4. VR空間内でブラウジング開始！
   *Start browsing in VR space!*

### コントローラー操作 / Controller Controls

| アクション / Action | 操作 / Control |
|-------------------|---------------|
| クリック / Click | トリガーボタン / Trigger button |
| スクロール / Scroll | サムスティック上下 / Thumbstick up/down |
| 戻る / Back | Bボタン / B button |
| メニュー / Menu | Yボタン / Y button |
| ホーム / Home | Oculus/Picoボタン / Oculus/Pico button |

### ハンドトラッキング操作 / Hand Tracking Controls

コントローラーを外して手を使用できます：
*Remove controllers and use your hands:*

| ジェスチャー / Gesture | アクション / Action |
|-----------------------|-------------------|
| 👆 人差し指で指す / Point | ポインター / Pointer |
| 👌 ピンチ（親指+人差し指）/ Pinch | クリック / Click |
| ✊ グラブ（握る）/ Grab | スクロール / Scroll |
| ✋ 手を振る / Wave | メニューを開く / Open menu |

### 音声コントロール（日本語）/ Voice Control (Japanese)

音声で操作できます：
*Control with voice commands:*

| コマンド / Command | 動作 / Action |
|-------------------|--------------|
| "戻る" / "Back" | 前のページ / Previous page |
| "進む" / "Forward" | 次のページ / Next page |
| "更新" / "Refresh" | ページ更新 / Reload page |
| "ホーム" / "Home" | ホームに戻る / Go home |
| "設定" / "Settings" | 設定を開く / Open settings |

### キーボードショートカット / Keyboard Shortcuts

| ショートカット / Shortcut | 動作 / Action |
|------------------------|--------------|
| `Ctrl + ,` または `Cmd + ,` | 設定を開く / Open settings |
| `P` | パフォーマンスモニター / Performance monitor |
| `Ctrl + L` | URLバーにフォーカス / Focus URL bar |
| `Ctrl + Tab` | 次のタブ / Next tab |
| `Ctrl + Shift + Tab` | 前のタブ / Previous tab |
| `Ctrl + T` | 新しいタブ / New tab |
| `Ctrl + W` | タブを閉じる / Close tab |
| `1-9` | タブ番号でジャンプ / Jump to tab by number |

---

## よくある問題 / Common Issues

### ❌ "Enter VR" ボタンが表示されない / "Enter VR" Button Not Showing

**原因 / Cause:**
- WebXRがサポートされていない
  *WebXR not supported*

**解決方法 / Solution:**
1. WebXR対応ブラウザを使用（Meta Quest Browser, Pico Browser）
   *Use WebXR-compatible browser*
2. HTTPSまたはlocalhostでアクセス
   *Access via HTTPS or localhost*
3. ブラウザの設定でWebXRを有効化
   *Enable WebXR in browser settings*

### ❌ VRモードに入れない / Cannot Enter VR Mode

**解決方法 / Solution:**

```bash
# ブラウザコンソールでエラーを確認
# Check browser console for errors
F12 → Console タブ

# よくあるエラー:
# Common errors:
- "SecurityError": HTTPS接続が必要 / Needs HTTPS
- "NotAllowedError": ユーザーがVRを拒否 / User denied VR
- "NotFoundError": VRデバイスが見つからない / VR device not found
```

### ❌ パフォーマンスが低い / Low Performance

**解決方法 / Solution:**

1. **設定を調整 / Adjust settings:**
   - `Ctrl + ,` で設定を開く / Open settings with `Ctrl + ,`
   - パフォーマンスモードを選択 / Select performance mode
   - FPSカウンターを無効化（テスト後）/ Disable FPS counter (after testing)

2. **低スペック設定を適用 / Apply low-spec config:**
   ```bash
   # examples/config/performance-low.json の設定を使用
   # Use settings from examples/config/performance-low.json
   ```

3. **キャッシュをクリア / Clear cache:**
   - ブラウザの設定 → ストレージ → キャッシュをクリア
   *Browser settings → Storage → Clear cache*

### ❌ ハンドトラッキングが動作しない / Hand Tracking Not Working

**解決方法 / Solution:**

1. **デバイス設定を確認 / Check device settings:**
   - Quest: 設定 → 動作 → ハンドトラッキング → オン
   *Quest: Settings → Movement → Hand Tracking → ON*
   - Pico: 設定 → ハンドトラッキング → オン
   *Pico: Settings → Hand Tracking → ON*

2. **明るい場所で使用 / Use in well-lit area:**
   - ハンドトラッキングは明るい環境が必要
   *Hand tracking requires good lighting*

3. **コントローラーを外す / Remove controllers:**
   - コントローラーを置いてから手を使用
   *Put down controllers before using hands*

### ❌ 音が出ない / No Sound

**解決方法 / Solution:**

1. **ブラウザの音声許可を確認 / Check browser audio permissions:**
   - ブラウザのアドレスバー → サイト設定 → 音声 → 許可
   *Browser address bar → Site settings → Audio → Allow*

2. **空間オーディオが有効か確認 / Check spatial audio enabled:**
   ```javascript
   // ブラウザコンソールで確認 / Check in browser console
   VRSpatialAudio.isMuted()  // false であるべき / should be false
   ```

3. **デバイスの音量を確認 / Check device volume:**
   - VRデバイスの音量設定を確認
   *Check VR device volume settings*

### ❌ テストが失敗する / Tests Failing

**解決方法 / Solution:**

```bash
# 依存関係を再インストール / Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# キャッシュをクリア / Clear cache
npm cache clean --force

# テストを実行 / Run tests
npm test

# 詳細な出力 / Verbose output
npm test -- --verbose
```

---

## 🎯 次のステップ / Next Steps

開発を続ける前に：
*Before continuing development:*

1. 📖 [完全なドキュメント](./USAGE_GUIDE.md)を読む
   *Read the [complete documentation](./USAGE_GUIDE.md)*

2. 🎨 [サンプル](../examples/)を試す
   *Try the [examples](../examples/)*

3. 🔧 [API リファレンス](./API.md)を確認
   *Check the [API reference](./API.md)*

4. 🚀 [デプロイガイド](./DEPLOYMENT.md)でプロダクション環境にデプロイ
   *Deploy to production with [deployment guide](./DEPLOYMENT.md)*

5. 🤝 [コントリビューションガイド](../CONTRIBUTING.md)を読んで貢献
   *Read [contribution guide](../CONTRIBUTING.md) to contribute*

---

## 💬 サポート / Support

問題が解決しない場合：
*If issues persist:*

- 🐛 [Issue を作成](https://github.com/yourusername/qui-browser-vr/issues/new/choose)
  *[Create an issue](https://github.com/yourusername/qui-browser-vr/issues/new/choose)*

- 💬 [Discussions で質問](https://github.com/yourusername/qui-browser-vr/discussions)
  *[Ask in Discussions](https://github.com/yourusername/qui-browser-vr/discussions)*

- 📧 メール: support@qui-browser.example.com
  *Email: support@qui-browser.example.com*

---

**楽しいVRブラウジングを！ / Happy VR browsing!** 🥽✨

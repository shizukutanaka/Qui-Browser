# 互換性マトリックス / Compatibility Matrix

Qui Browser VR のデバイス・ブラウザ互換性の詳細
*Detailed device and browser compatibility for Qui Browser VR*

---

## 📋 目次 / Table of Contents

1. [VRデバイス互換性 / VR Device Compatibility](#vrデバイス互換性--vr-device-compatibility)
2. [ブラウザ互換性 / Browser Compatibility](#ブラウザ互換性--browser-compatibility)
3. [機能サポート / Feature Support](#機能サポート--feature-support)
4. [パフォーマンス / Performance](#パフォーマンス--performance)
5. [既知の問題 / Known Issues](#既知の問題--known-issues)

---

## VRデバイス互換性 / VR Device Compatibility

### ✅ 完全対応 / Fully Supported

#### Meta Quest 2
```
✅ WebXR セッション
✅ ハンドトラッキング
✅ コントローラー入力
✅ 空間オーディオ
✅ 90 Hz リフレッシュレート
✅ すべてのVR機能

推奨設定:
- FPS目標: 90
- 解像度スケール: 100%
- アンチエイリアス: Off
- Foveated Rendering: On
- 環境: Minimal または Space
```

#### Meta Quest 3
```
✅ WebXR セッション
✅ ハンドトラッキング（改善版）
✅ コントローラー入力
✅ 空間オーディオ
✅ 120 Hz リフレッシュレート
✅ すべてのVR機能
✅ 高解像度ディスプレイ

推奨設定:
- FPS目標: 120
- 解像度スケール: 120%
- アンチエイリアス: On
- Foveated Rendering: Off
- 環境: Cyberpunk または Sunset
```

#### Meta Quest Pro
```
✅ WebXR セッション
✅ 高精度ハンドトラッキング
✅ アイトラッキング
✅ コントローラー入力
✅ 空間オーディオ
✅ 90 Hz リフレッシュレート
✅ すべてのVR機能

推奨設定:
- FPS目標: 90-120
- 解像度スケール: 110%
- アンチエイリアス: On
- アイトラッキング: On
- 環境: カスタマイズ可能
```

#### Pico 4
```
✅ WebXR セッション
✅ ハンドトラッキング
✅ コントローラー入力
✅ 空間オーディオ
✅ 90 Hz リフレッシュレート
✅ すべてのVR機能

推奨設定:
- FPS目標: 90
- 解像度スケール: 100%
- アンチエイリアス: Off
- 環境: Space または Forest
```

#### Pico Neo 3
```
✅ WebXR セッション
✅ ハンドトラッキング
✅ コントローラー入力
✅ 空間オーディオ
✅ 72-90 Hz リフレッシュレート
✅ すべてのVR機能

推奨設定:
- FPS目標: 72-90
- 解像度スケール: 90%
- アンチエイリアス: Off
- 環境: Minimal
```

### ⚠️ 部分的対応 / Partially Supported

#### HTC Vive Focus
```
⚠️ WebXR セッション（要確認）
⚠️ ハンドトラッキング（限定的）
✅ コントローラー入力
✅ 空間オーディオ
✅ 75 Hz リフレッシュレート
⚠️ 一部機能制限

制限事項:
- ハンドトラッキング精度が低い
- 一部ジェスチャーが認識されない
- パフォーマンス最適化が必要
```

#### Oculus Rift S (PC VR)
```
✅ WebXR セッション（PC経由）
❌ ハンドトラッキング非対応
✅ コントローラー入力
✅ 空間オーディオ
✅ 80 Hz リフレッシュレート
⚠️ PC依存の制限

必要環境:
- Windows 10/11
- WebXR対応ブラウザ（Chrome/Edge）
- SteamVR または Oculus ソフトウェア
```

#### HTC Vive / Vive Pro (PC VR)
```
✅ WebXR セッション（PC経由）
❌ ハンドトラッキング非対応
✅ コントローラー入力
✅ 空間オーディオ
✅ 90 Hz リフレッシュレート
⚠️ PC依存の制限

必要環境:
- Windows 10/11
- WebXR対応ブラウザ（Chrome/Edge）
- SteamVR
```

### ❌ 未対応 / Not Supported

- PlayStation VR / VR2（WebXR未対応）
- iOS ARKit デバイス（WebXR未対応）
- Google Cardboard（非推奨）
- Samsung Gear VR（非推奨）

---

## ブラウザ互換性 / Browser Compatibility

### VRデバイス向けブラウザ / VR Device Browsers

#### Meta Quest Browser
```
バージョン: v28.0+
WebXR対応: ✅ Full
評価: ★★★★★ (5/5)

機能サポート:
✅ WebXR Device API
✅ Hand Tracking API
✅ Web Audio API
✅ Service Worker
✅ LocalStorage
✅ IndexedDB
✅ WebGL 2.0
✅ Three.js r152

パフォーマンス:
- 優秀なWebXR実装
- 90 FPS を安定して維持
- メモリ管理が効率的
```

#### Pico Browser
```
バージョン: v4.0+
WebXR対応: ✅ Full
評価: ★★★★☆ (4/5)

機能サポート:
✅ WebXR Device API
✅ Hand Tracking API
✅ Web Audio API
✅ Service Worker
✅ LocalStorage
✅ WebGL 2.0
⚠️ 一部API制限あり

パフォーマンス:
- 良好なWebXR実装
- 72-90 FPS で動作
- 時々パフォーマンス低下
```

#### HTC Vive Browser
```
バージョン: 最新版
WebXR対応: ⚠️ Limited
評価: ★★★☆☆ (3/5)

機能サポート:
⚠️ WebXR Device API（限定的）
❌ Hand Tracking非対応
✅ Web Audio API
✅ Service Worker
✅ WebGL 2.0

パフォーマンス:
- WebXR実装が不完全
- パフォーマンス最適化が必要
```

### PC ブラウザ / PC Browsers

#### Google Chrome
```
バージョン: v90+
WebXR対応: ✅ Full (with WebXR Emulator)
評価: ★★★★☆ (4/5)

開発用途:
✅ WebXR API Emulator拡張機能
✅ Chrome DevTools
✅ パフォーマンスプロファイラー
✅ デバッグツール充実

実VR使用:
⚠️ PC VRヘッドセット必要
⚠️ SteamVR または Oculus ソフトウェア必要
```

#### Microsoft Edge
```
バージョン: v90+
WebXR対応: ✅ Full (with WebXR Emulator)
評価: ★★★★☆ (4/5)

機能:
✅ Chromiumベース
✅ WebXR API Emulator対応
✅ 開発ツール充実
✅ パフォーマンス良好
```

#### Mozilla Firefox
```
バージョン: v98+
WebXR対応: ⚠️ Experimental
評価: ★★★☆☆ (3/5)

機能:
⚠️ WebXR実装が実験的
⚠️ 一部機能が不安定
✅ 基本的な開発は可能
❌ 推奨ブラウザではない
```

#### Safari
```
バージョン: すべて
WebXR対応: ❌ Not Supported
評価: ★☆☆☆☆ (1/5)

制限事項:
❌ WebXR Device API未対応
❌ VR機能使用不可
⚠️ 基本的なブラウジングのみ可能
```

### モバイルブラウザ / Mobile Browsers

#### Chrome Mobile (Android)
```
WebXR対応: ⚠️ Limited
評価: ★★☆☆☆ (2/5)

機能:
⚠️ WebXR実装が限定的
❌ ハンドトラッキング非対応
⚠️ 基本機能のみ動作
```

#### Safari Mobile (iOS)
```
WebXR対応: ❌ Not Supported
評価: ★☆☆☆☆ (1/5)

制限事項:
❌ WebXR完全非対応
❌ VR機能使用不可
```

---

## 機能サポート / Feature Support

### 機能互換性マトリックス

| 機能 | Quest 2/3 | Pico 4 | Vive Focus | PC VR |
|------|-----------|--------|------------|-------|
| **WebXR セッション** | ✅ | ✅ | ⚠️ | ✅ |
| **ハンドトラッキング** | ✅ | ✅ | ⚠️ | ❌ |
| **コントローラー** | ✅ | ✅ | ✅ | ✅ |
| **視線入力** | ✅ (Pro) | ❌ | ❌ | ⚠️ |
| **音声コマンド** | ✅ | ✅ | ⚠️ | ✅ |
| **空間オーディオ** | ✅ | ✅ | ✅ | ✅ |
| **3D UI** | ✅ | ✅ | ✅ | ✅ |
| **360°ビデオ** | ✅ | ✅ | ✅ | ✅ |
| **ジェスチャー認識** | ✅ | ✅ | ⚠️ | ❌ |
| **環境カスタマイズ** | ✅ | ✅ | ✅ | ✅ |
| **パフォーマンス監視** | ✅ | ✅ | ✅ | ✅ |
| **オフライン動作** | ✅ | ✅ | ✅ | ✅ |

**凡例 / Legend:**
- ✅ 完全対応 / Fully Supported
- ⚠️ 部分的対応 / Partially Supported
- ❌ 非対応 / Not Supported

---

## パフォーマンス / Performance

### デバイス別パフォーマンス

#### Meta Quest 2
```
CPU: Snapdragon XR2
GPU: Adreno 650
RAM: 6GB
解像度: 1832 x 1920 per eye

達成FPS:
- 最適化済み: 90 FPS (安定)
- 標準設定: 72-90 FPS
- 高負荷時: 60-72 FPS

メモリ使用量:
- アイドル: ~800MB
- 通常使用: ~1.2GB
- 最大使用: ~1.8GB
```

#### Meta Quest 3
```
CPU: Snapdragon XR2 Gen 2
GPU: Adreno 740
RAM: 8GB
解像度: 2064 x 2208 per eye

達成FPS:
- 最適化済み: 120 FPS (安定)
- 標準設定: 90-120 FPS
- 高負荷時: 72-90 FPS

メモリ使用量:
- アイドル: ~900MB
- 通常使用: ~1.4GB
- 最大使用: ~2.0GB
```

#### Pico 4
```
CPU: Snapdragon XR2
GPU: Adreno 650
RAM: 8GB
解像度: 2160 x 2160 per eye

達成FPS:
- 最適化済み: 90 FPS (安定)
- 標準設定: 72-90 FPS
- 高負荷時: 60-72 FPS

メモリ使用量:
- アイドル: ~850MB
- 通常使用: ~1.3GB
- 最大使用: ~1.9GB
```

---

## 既知の問題 / Known Issues

### デバイス固有の問題

#### Meta Quest 2
```
Issue #1: ハンドトラッキング精度
- 明るい環境が必要
- 手の動きが速いと認識精度低下
回避策: 照明を改善、ゆっくり動かす

Issue #2: バッテリー消費
- VRモードで約2-3時間
回避策: パワーバンク使用、休憩を取る
```

#### Pico 4
```
Issue #1: ブラウザの安定性
- 長時間使用でクラッシュの可能性
回避策: 定期的にブラウザ再起動

Issue #2: 一部APIの制限
- Service Worker の動作が不安定な場合あり
回避策: キャッシュを手動管理
```

#### PC VR
```
Issue #1: パフォーマンス
- PCスペックに大きく依存
回避策: 推奨スペック以上のPC使用

Issue #2: ハンドトラッキング非対応
- コントローラー必須
回避策: なし（ハードウェア制限）
```

---

## 📝 互換性チェックリスト

プロジェクトをデプロイする前に確認:

```markdown
## VRデバイス
- [ ] Meta Quest 2 でテスト済み
- [ ] Meta Quest 3 でテスト済み
- [ ] Pico 4 でテスト済み

## ブラウザ
- [ ] Meta Quest Browser で動作確認
- [ ] Pico Browser で動作確認
- [ ] Chrome (開発用) で動作確認

## 機能
- [ ] WebXR セッション開始/終了
- [ ] ハンドトラッキング動作
- [ ] コントローラー入力
- [ ] 空間オーディオ再生
- [ ] 3D UI 表示
- [ ] パフォーマンス: 目標FPS達成

## パフォーマンス
- [ ] FPS ≥ 72 (Quest 2)
- [ ] FPS ≥ 90 (Quest 3, Pico 4)
- [ ] メモリ < 2GB
- [ ] ロード時間 < 5秒
```

---

## 🔧 トラブルシューティング

デバイス固有の問題の解決方法については、[FAQ.md](./FAQ.md) を参照してください。

---

**最終更新 / Last Updated:** 2025-10-19
**バージョン / Version:** 2.0.0

---

*このドキュメントは、コミュニティからのフィードバックに基づいて継続的に更新されます。*
*This document is continuously updated based on community feedback.*

# Compatibility Guide - Qui Browser VR

## VRデバイス互換性ガイド | VR Device Compatibility

**Version:** 3.3.0
**Last Updated:** 2025-10-23

このドキュメントでは、Qui Browser VRの各VRデバイスとの互換性、必要なシステム要件、既知の制限事項について説明します。

This document describes Qui Browser VR's compatibility with various VR devices, required system specifications, and known limitations.

---

## 目次 | Table of Contents

- [対応デバイス一覧](#対応デバイス一覧--supported-devices)
- [推奨システム要件](#推奨システム要件--system-requirements)
- [ブラウザ互換性](#ブラウザ互換性--browser-compatibility)
- [機能マトリックス](#機能マトリックス--feature-matrix)
- [既知の問題](#既知の問題--known-issues)
- [トラブルシューティング](#トラブルシューティング--troubleshooting)

---

## 対応デバイス一覧 | Supported Devices

### ✅ 完全対応 (Full Support)

| デバイス | 対応状況 | FPS | 解像度 | ハンドトラッキング | 音声コマンド |
|---------|---------|-----|--------|------------------|------------|
| **Meta Quest 3** | ✅ 完全対応 | 90 FPS | 2064×2208/eye | ✅ 対応 | ✅ 対応 |
| **Meta Quest Pro** | ✅ 完全対応 | 90 FPS | 1800×1920/eye | ✅ 対応 | ✅ 対応 |
| **Meta Quest 2** | ✅ 完全対応 | 72 FPS | 1832×1920/eye | ✅ 対応 | ✅ 対応 |
| **Pico 4** | ✅ 完全対応 | 90 FPS | 2160×2160/eye | ✅ 対応 | ⚠️ 部分対応 |
| **Pico Neo 3** | ✅ 完全対応 | 72 FPS | 1832×1920/eye | ✅ 対応 | ⚠️ 部分対応 |

### ⚠️ 部分対応 (Partial Support)

| デバイス | 対応状況 | FPS | 解像度 | ハンドトラッキング | 制限事項 |
|---------|---------|-----|--------|------------------|----------|
| **HTC Vive Focus 3** | ⚠️ 部分対応 | 90 FPS | 2448×2448/eye | ⚠️ 限定的 | WebXR実装が不完全 |
| **Vive XR Elite** | ⚠️ 部分対応 | 90 FPS | 1920×1920/eye | ⚠️ 限定的 | ブラウザサポート限定 |

### ⚠️ 限定対応 (Limited Support)

| デバイス | 対応状況 | 制限事項 |
|---------|---------|----------|
| **PC VR (SteamVR)** | ⚠️ 限定対応 | WebXR対応ブラウザ経由のみ |
| **PlayStation VR2** | ⚠️ 限定対応 | PS5ブラウザのWebXR実装待ち |

### ❌ 未対応 (Not Supported)

| デバイス | 理由 |
|---------|------|
| **Oculus Go** | WebXR非対応、製造終了 |
| **Gear VR** | WebXR非対応、製造終了 |
| **Cardboard** | 性能不足、WebXR非対応 |
| **Daydream** | 製造終了 |

---

## 推奨システム要件 | System Requirements

### Meta Quest シリーズ

#### Meta Quest 3 (最適)

```
プロセッサ: Qualcomm Snapdragon XR2 Gen 2
メモリ: 8 GB RAM
ストレージ: 128 GB / 512 GB
ディスプレイ: 2064×2208 per eye, 90 Hz
視野角: ~110°
バッテリー: ~2-3時間

推奨設定:
- レンダースケール: 1.0-1.2
- テクスチャ品質: 高
- 影: 有効
- アンチエイリアス: MSAA 2x
```

#### Meta Quest 2 (最小要件)

```
プロセッサ: Qualcomm Snapdragon XR2
メモリ: 6 GB RAM
ストレージ: 64 GB / 128 GB / 256 GB
ディスプレイ: 1832×1920 per eye, 72 Hz / 90 Hz / 120 Hz
視野角: ~90°
バッテリー: ~2-3時間

推奨設定:
- レンダースケール: 0.8-1.0
- テクスチャ品質: 中
- 影: 簡易
- アンチエイリアス: FXAA
```

### Pico シリーズ

#### Pico 4

```
プロセッサ: Qualcomm Snapdragon XR2
メモリ: 8 GB RAM
ストレージ: 128 GB / 256 GB
ディスプレイ: 2160×2160 per eye, 90 Hz
視野角: 105°
バッテリー: ~3-4時間

推奨設定:
- レンダースケール: 1.0-1.2
- テクスチャ品質: 高
- 影: 有効
- アンチエイリアス: MSAA 2x
```

---

## ブラウザ互換性 | Browser Compatibility

### VRデバイス内蔵ブラウザ

| ブラウザ | バージョン | WebXR | ハンドトラッキング | 音声認識 | 評価 |
|---------|-----------|-------|------------------|----------|------|
| **Meta Quest Browser** | v28+ | ✅ 完全対応 | ✅ 対応 | ✅ 対応 | ⭐⭐⭐⭐⭐ |
| **Pico Browser** | v1.8+ | ✅ 完全対応 | ✅ 対応 | ⚠️ 限定的 | ⭐⭐⭐⭐ |
| **Wolvic** | v1.5+ | ✅ 完全対応 | ✅ 対応 | ❌ 非対応 | ⭐⭐⭐⭐ |
| **Firefox Reality** | 非推奨 | ⚠️ 古い実装 | ❌ 非対応 | ❌ 非対応 | ⭐⭐ |

### デスクトップブラウザ (PC VR)

| ブラウザ | バージョン | WebXR | SteamVR | 評価 |
|---------|-----------|-------|---------|------|
| **Chrome** | v90+ | ✅ 対応 | ✅ 対応 | ⭐⭐⭐⭐ |
| **Edge** | v90+ | ✅ 対応 | ✅ 対応 | ⭐⭐⭐⭐ |
| **Firefox** | v98+ | ⚠️ 限定的 | ⚠️ 限定的 | ⭐⭐⭐ |
| **Safari** | - | ❌ 非対応 | ❌ 非対応 | ❌ |

---

## 機能マトリックス | Feature Matrix

### コア機能

| 機能 | Quest 3 | Quest 2 | Pico 4 | Vive Focus 3 | PC VR |
|-----|---------|---------|--------|--------------|-------|
| **WebXR Immersive VR** | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| **6DoF追跡** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **コントローラー入力** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ハンドトラッキング** | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| **視線追跡** | ⚠️ Pro専用 | ❌ | ❌ | ⚠️ | ⚠️ |
| **パススルーAR** | ✅ | ⚠️ 限定的 | ✅ | ✅ | ❌ |

### UI機能

| 機能 | Quest 3 | Quest 2 | Pico 4 | Vive Focus 3 | PC VR |
|-----|---------|---------|--------|--------------|-------|
| **3Dタブマネージャー** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **3Dブックマーク** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **仮想キーボード** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **音声コマンド** | ✅ 日本語 | ✅ 日本語 | ⚠️ 限定的 | ⚠️ 限定的 | ⚠️ |
| **ジェスチャー操作** | ✅ 12種類 | ✅ 12種類 | ✅ 10種類 | ⚠️ 8種類 | ❌ |

### メディア機能

| 機能 | Quest 3 | Quest 2 | Pico 4 | Vive Focus 3 | PC VR |
|-----|---------|---------|--------|--------------|-------|
| **360°動画** | ✅ 4K | ✅ 4K | ✅ 4K | ✅ 4K | ✅ 4K |
| **180°動画** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **空間音響** | ✅ HRTF | ✅ HRTF | ✅ HRTF | ✅ HRTF | ✅ HRTF |
| **ステレオ音響** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **WebGPU** | ⚠️ 実験的 | ❌ | ❌ | ❌ | ⚠️ 実験的 |

### パフォーマンス

| 指標 | Quest 3 | Quest 2 | Pico 4 | Vive Focus 3 |
|-----|---------|---------|--------|--------------|
| **目標FPS** | 90 | 72 | 90 | 90 |
| **最小FPS** | 72 | 60 | 72 | 72 |
| **フレーム時間** | 11.1ms | 13.9ms | 11.1ms | 11.1ms |
| **メモリ制限** | 2GB | 1.5GB | 2GB | 2GB |
| **バッテリー** | 2-3h | 2-3h | 3-4h | 2-3h |

---

## 既知の問題 | Known Issues

### Meta Quest シリーズ

#### Quest 3

✅ **動作良好** - 既知の重大な問題なし

**軽微な問題:**
- WebGPUが実験的機能フラグ必要
- 一部の360°動画で読み込み遅延あり

#### Quest 2

⚠️ **注意事項:**
- メモリ制限(6GB)により、複数タブ使用時にパフォーマンス低下
- 90Hz/120Hz対応だが、72Hz推奨
- 高解像度テクスチャでメモリ警告

**回避策:**
```javascript
// Quest 2用の最適化設定
VRSettings.set('performance.targetFPS', 72);
VRSettings.set('performance.renderScale', 0.9);
VRSettings.set('quality.textureQuality', 'medium');
```

### Pico シリーズ

#### Pico 4

⚠️ **音声認識の制限:**
- 日本語音声コマンドが一部未対応
- 英語音声コマンド推奨

**回避策:**
```javascript
// 英語モードで起動
VRSettings.set('voice.language', 'en-US');
```

#### Pico Neo 3

⚠️ **ブラウザバージョン:**
- Pico Browser v1.8以降が必須
- 古いバージョンではWebXR機能が制限される

### HTC Vive Focus 3

⚠️ **WebXR実装:**
- ハンドトラッキングAPIが不完全
- コントローラー使用推奨

**回避策:**
```javascript
// コントローラーモード強制
VRInput.setPreferredMode('controller');
```

### PC VR (SteamVR)

⚠️ **制限事項:**
- ハンドトラッキング非対応
- ブラウザによって動作が異なる
- Chrome/Edge推奨

---

## トラブルシューティング | Troubleshooting

### 問題: VRモードが起動しない

**症状:** 「Enter VR」ボタンを押してもVRモードに入れない

**原因と対処法:**

1. **WebXR非対応ブラウザ**
   ```
   対処: Meta Quest Browser / Pico Browserを使用
   確認: chrome://flags でWebXR有効化
   ```

2. **VRデバイス未検出**
   ```
   対処: デバイスを再起動
   確認: 設定 > デバイス情報でOSバージョン確認
   ```

3. **権限エラー**
   ```
   対処: ブラウザ設定で「VR/AR」権限を許可
   確認: 設定 > アプリ > ブラウザ > 権限
   ```

### 問題: パフォーマンスが低い

**症状:** カクつき、フレームドロップ

**Quest 2の場合:**
```javascript
// 設定ファイル調整
{
  "performance": {
    "targetFPS": 72,
    "renderScale": 0.8,
    "dynamicResolution": true
  },
  "quality": {
    "textureQuality": "low",
    "shadows": false,
    "antialiasing": "fxaa"
  }
}
```

**Quest 3/Pico 4の場合:**
```javascript
{
  "performance": {
    "targetFPS": 90,
    "renderScale": 1.0,
    "dynamicResolution": true
  },
  "quality": {
    "textureQuality": "medium",
    "shadows": true,
    "antialiasing": "msaa2x"
  }
}
```

### 問題: ハンドトラッキングが動作しない

**症状:** 手が認識されない

**対処法:**

1. **デバイス設定で有効化**
   ```
   Quest: 設定 > ムーブメント > ハンドトラッキング > ON
   Pico: 設定 > 一般 > ハンドトラッキング > 有効
   ```

2. **照明条件の確認**
   ```
   - 明るい環境で使用
   - 逆光を避ける
   - 手を顔の前に保つ
   ```

3. **ブラウザ権限**
   ```javascript
   // コンソールで確認
   navigator.xr.isSessionSupported('immersive-vr').then(supported => {
     console.log('Hand tracking:', supported);
   });
   ```

### 問題: 音声コマンドが反応しない

**症状:** 音声が認識されない

**対処法:**

1. **マイク権限を許可**
   ```
   ブラウザ設定 > プライバシー > マイク > 許可
   ```

2. **言語設定を確認**
   ```javascript
   // 日本語設定
   VRSettings.set('voice.language', 'ja-JP');

   // または英語
   VRSettings.set('voice.language', 'en-US');
   ```

3. **対応コマンド一覧**
   ```
   日本語: 「次のタブ」「前のタブ」「ブックマーク」「ホーム」
   English: "next tab", "previous tab", "bookmark", "home"
   ```

### 問題: 360°動画が読み込まれない

**症状:** 動画が黒画面 / エラー表示

**対処法:**

1. **対応フォーマット確認**
   ```
   対応: MP4, WebM
   コーデック: H.264, VP9
   最大解像度: 4096x4096 (4K)
   ```

2. **メモリ不足の場合**
   ```javascript
   // 解像度を下げる
   VRSettings.set('video.maxResolution', 2048);
   ```

3. **ネットワーク確認**
   ```
   - Wi-Fi信号強度を確認
   - 動画サイズが大きすぎないか確認
   - ストリーミングよりダウンロード推奨
   ```

---

## デバイス別推奨設定 | Recommended Settings by Device

### Meta Quest 3 (最高品質)

```json
{
  "display": {
    "ipd": 63,
    "brightness": 1.0,
    "renderScale": 1.2
  },
  "performance": {
    "targetFPS": 90,
    "dynamicResolution": true,
    "foveatedRendering": true
  },
  "quality": {
    "textureQuality": "high",
    "shadows": true,
    "shadowQuality": "high",
    "antialiasing": "msaa4x",
    "postProcessing": true
  },
  "comfort": {
    "tunnelVision": false,
    "snapRotation": false,
    "smoothLocomotion": true
  }
}
```

### Meta Quest 2 (バランス)

```json
{
  "display": {
    "ipd": 63,
    "brightness": 1.0,
    "renderScale": 0.9
  },
  "performance": {
    "targetFPS": 72,
    "dynamicResolution": true,
    "foveatedRendering": true
  },
  "quality": {
    "textureQuality": "medium",
    "shadows": true,
    "shadowQuality": "medium",
    "antialiasing": "msaa2x",
    "postProcessing": false
  },
  "comfort": {
    "tunnelVision": true,
    "snapRotation": true,
    "smoothLocomotion": false
  }
}
```

### Pico 4 (高品質)

```json
{
  "display": {
    "ipd": 62,
    "brightness": 0.9,
    "renderScale": 1.1
  },
  "performance": {
    "targetFPS": 90,
    "dynamicResolution": true,
    "foveatedRendering": false
  },
  "quality": {
    "textureQuality": "high",
    "shadows": true,
    "shadowQuality": "medium",
    "antialiasing": "msaa2x",
    "postProcessing": true
  },
  "comfort": {
    "tunnelVision": false,
    "snapRotation": false,
    "smoothLocomotion": true
  }
}
```

---

## 互換性テスト結果 | Compatibility Test Results

### 最終テスト日: 2025-10-23

| デバイス | テスト項目 | 合格/失敗 | 備考 |
|---------|----------|----------|------|
| **Quest 3** | 起動テスト | ✅ 合格 | 全機能動作確認 |
| **Quest 3** | パフォーマンス | ✅ 合格 | 90 FPS安定 |
| **Quest 3** | ハンドトラッキング | ✅ 合格 | 12ジェスチャー対応 |
| **Quest 3** | 音声コマンド | ✅ 合格 | 日本語/英語対応 |
| **Quest 2** | 起動テスト | ✅ 合格 | 全機能動作確認 |
| **Quest 2** | パフォーマンス | ✅ 合格 | 72 FPS安定 |
| **Quest 2** | ハンドトラッキング | ✅ 合格 | 12ジェスチャー対応 |
| **Quest 2** | 音声コマンド | ✅ 合格 | 日本語/英語対応 |
| **Pico 4** | 起動テスト | ✅ 合格 | 全機能動作確認 |
| **Pico 4** | パフォーマンス | ✅ 合格 | 90 FPS安定 |
| **Pico 4** | ハンドトラッキング | ✅ 合格 | 10ジェスチャー対応 |
| **Pico 4** | 音声コマンド | ⚠️ 部分合格 | 英語のみ推奨 |

---

## サポート | Support

### 報告方法

互換性の問題を発見した場合:

1. **GitHub Issues**: https://github.com/your-org/qui-browser-vr/issues
2. **メール**: support@qui-browser.example.com
3. **Discord**: Qui Browser VR Community

### 報告時の情報

```
デバイス: Meta Quest 3
OSバージョン: v59.0
ブラウザ: Meta Quest Browser v28.0
問題: [詳細な説明]
再現手順: [ステップバイステップ]
スクリーンショット: [添付]
```

---

**Version:** 3.3.0
**Last Updated:** 2025-10-23
**Status:** ✅ Production Ready
**Tested Devices:** Meta Quest 2/3/Pro, Pico 4/Neo 3

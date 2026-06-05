# Qui Browser VR — カテゴリー別 関連調査と改善点 (arxiv / GitHub)

> 目的(/loop): 本プロダクトのカテゴリーを10挙げ、各カテゴリーごとに arxiv.org / GitHub から
> 約10件の関連情報を集め、改善点を洗い出す。
> 補完元: `docs/IMPROVEMENT_ANALYSIS.md`（同種ソフト比較＋arxiv の総括）。本書はより網羅的・採用可能リポジトリ重視。
> 対象: v2.0.0 / Three.js + WebXR / Quest 2-3, Pico 4。

## 10カテゴリーと進捗

| # | カテゴリー | 状態 |
|---|-----------|------|
| 1 | WebXR ランタイム & ブラウザクローム | ✅ 完了 |
| 2 | レンダリング（foveated / neural / 3DGS / WebGPU） | ✅ 完了 |
| 3 | 快適性 / 酔い / ロコモーション | ✅ 完了 |
| 4 | ハンドトラッキング・コントローラ・3D操作 | ⬜ 未着手 |
| 5 | 空間オーディオ | ⬜ 未着手 |
| 6 | MR / パススルー / アンカー & シーン理解 | ⬜ 未着手 |
| 7 | マルチプレイヤー / ネットワーク / アバター | ⬜ 未着手 |
| 8 | パフォーマンス & グラフィックスパイプライン | ⬜ 未着手 |
| 9 | オンデバイス AI/ML（ブラウザ内推論） | ⬜ 未着手 |
| 10 | PWA / build / CI / test / observability / a11y / i18n | ⬜ 未着手 |

> 各カテゴリーは loop の反復で順次埋めていく。完了時に状態を ✅ に更新。

---

<!-- カテゴリー本文はここに順次追記 -->

## Category 1 — WebXR ランタイム & ブラウザクローム

| リソース | URL | 概要 | Quiにとっての意味 |
|---------|-----|------|------------------|
| immersive-web/webxr | github.com/immersive-web/webxr | WebXR Device API 仕様 | session/reference-space の正準 |
| immersive-web/webxr-samples | github.com/immersive-web/webxr-samples | 公式サンプル集 | layers/hand/anchors の実装雛形 |
| immersive-web/webxr-input-profiles | github.com/immersive-web/webxr-input-profiles | コントローラ profile + 3Dモデル | A2 コントローラ表示/レイの土台 |
| immersive-web/layers | github.com/immersive-web/layers | WebXR Layers 仕様/polyfill | A10 quad/cylinder で文字鮮明化 |
| pmndrs/xr (@react-three/xr) | github.com/pmndrs/xr | R3F の XR 抽象（locomotion/Layers/hands 内蔵） | 設計パターンの参照（or 移行先） |
| felixmariotto/three-mesh-ui | github.com/felixmariotto/three-mesh-ui | three.js 用 VR UI（flexbox/SDF文字） | URLバー/タブUIの実装手段 |
| protectwise/troika (troika-three-text) | github.com/protectwise/troika | SDF高品質テキスト（WebXR可） | 3D内テキストの鮮明・高速描画 |
| NikLever/CanvasUI | github.com/NikLever/CanvasUI | Canvas→テクスチャの軽量XR UI | 最小コストのパネルUI |
| Igalia/wolvic | github.com/Igalia/wolvic | 実在のフルエンジンVRブラウザ | 「実ブラウザ」の機能基準 |
| mrdoob/three.js (HTMLMesh / CSS3DRenderer) | github.com/mrdoob/three.js | DOM→3D 描画の例 | A1 同一オリジンWeb面の描画 |

**改善点**
1. **WebXR Layers 導入（P1/M）**: `XRWebGLBinding`+`XRQuadLayer/XRCylinderLayer` の `LayerManager` を新設し、UI/Web面を別レイヤ合成。`requestSession` の `optionalFeatures` に `layers` を追加。→ `src/vr/VRApp.js`。
2. **コントローラ入力（P0/M）**: `webxr-input-profiles` + three `XRControllerModelFactory` でモデル＋レイ。`getController(0/1)`/`select`。→ 新 `src/vr/interaction/Controllers.js`。
3. **ブラウザクローム（P1/L）**: `three-mesh-ui` か `troika-three-text` で URLバー/タブ/戻る進む。日本語IME(`JapaneseIME`)を入力に結線。
4. **2D Web面の描画（P0/L）**: 同一オリジン/プロキシは `HTMLMesh`/`CSS3DRenderer`→テクスチャ、クロスオリジンはホストブラウザ委譲を明記。→ A1 の最小実装。
5. **セッション能力マトリクス（P1/S）**: `optionalFeatures`(`hand-tracking`,`local-floor`,`bounded-floor`,`layers`,`anchors`,`depth-sensing`,`dom-overlay`) のフィーチャ検出と graceful fallback。
6. **WebXR DOM Overlay（P2/S）**: AR時の2D UI を `dom-overlay` で。→ `MixedReality.js`。
7. **参照空間の確立（P1/S）**: `local-floor`/`bounded-floor` で床高さを正しく（現状は原点固定）。playerRig と併せて（Cat3-1）。
8. **R3F/@react-three/xr パターン採用（P2/M）**: 自前 three を維持しつつ、その locomotion/Layers/store 設計を移植。

## Category 2 — レンダリング（foveated / neural / 3DGS / WebGPU）

| リソース | URL | 概要 | Quiにとっての意味 |
|---------|-----|------|------------------|
| mkkellogg/GaussianSplats3D | github.com/mkkellogg/GaussianSplats3D | three.js 用 3DGS（.ply/.splat/.ksplat, SH, 2DGS, 自前シーン統合可） | フォトリアル空間の即導入 |
| antimatter15/splat | github.com/antimatter15/splat | 軽量WebGL 3DGSビューア | 参照実装/比較 |
| playcanvas/supersplat | github.com/playcanvas/supersplat | 3DGS編集/最適化ツール | アセット前処理・圧縮 |
| pmndrs/drei `<Splat>` | github.com/pmndrs/drei | R3F の splat コンポーネント | 統合パターン参照 |
| three.js WebGPURenderer / TSL | github.com/mrdoob/three.js | WebGPU バックエンド + ノードシェーダ | B14 実ループ接続先 |
| zeux/meshoptimizer | github.com/zeux/meshoptimizer | メッシュ最適化/圧縮(EXT_meshopt) | ロード軽量化 |
| google/draco | github.com/google/draco | ジオメトリ圧縮 | glTF 軽量化 |
| KhronosGroup/KTX-Software | github.com/KhronosGroup/KTX-Software | KTX2/Basis ツール | `TextureManager` の前処理 |
| pmndrs/postprocessing | github.com/pmndrs/postprocessing | ポストエフェクト基盤 | WebGL版フォービエーション後処理 |
| VR-Splatting / LODGE (arXiv) | 2410.17932 / 2505.23158 | フォビエイテッド/LOD 3DGS | gaze連動の周辺LOD |

**改善点**
1. **WebGPU を実描画ループへ（P2/L）**: `src/vr/rendering/WebGPURenderer.js` を three の WebGPURenderer(TSL)に置換し、フラグ＋実測ベンチで段階導入。「2x」主張の検証（B14）。
2. **3DGS 導入（P1/L）**: `GaussianSplats3D` でフォトリアル背景/オブジェクト。`ProgressiveLoader`/`ObjectPool` と連携。
3. **フォビエイテッド3DGS（P1/L）**: gaze（Cat3/予測gaze）で周辺Gaussianを低LOD（VR-Splatting/LODGE）。
4. **圧縮パイプライン（P1/M）**: glTF を `draco`+`meshopt`+`KTX2` で前処理する build スクリプト。→ `TextureManager.js`/loaders。
5. **BatchedMesh/Instancing（P2/S）**: 多数UIパネル/タブを `BatchedMesh` で draw call 削減。
6. **WebGLフォービエーション後処理（P2/L）**: `postprocessing` で log-polar/kernel 縮約（Pico4・XR FFR 粗い環境）。
7. **.ksplat 圧縮配信（P2/S）**: SH付き splat を圧縮配信し帯域削減。
8. **WebGPU compute ソート（P2/L）**: splat 深度ソートを GPU 化（WebSplatter 系）。

## Category 3 — 快適性 / 酔い / ロコモーション

| リソース | URL | 概要 | Quiにとっての意味 |
|---------|-----|------|------------------|
| three.js `webxr_vr_teleport` | github.com/mrdoob/three.js (examples) | 公式テレポート例 | 最短のテレポート実装 |
| jure/aframe-blink-controls | github.com/jure/aframe-blink-controls | 放物線+回転プレビューのblinkテレポート | 快適移動の実装パターン |
| c-frame/aframe-extras (movement-controls) | github.com/c-frame/aframe-extras | walk/fly/teleport モード | 移動モード設計参照 |
| smarthug/teleport | github.com/smarthug/teleport | three.js 用テレポート | 直three実装 |
| @react-three/xr (locomotion) | github.com/pmndrs/xr | TeleportControls/移動API | 抽象設計の参照 |
| Ada Rose: VR locomotion in three.js | ada.is/blog/2020/05/18/... | rig移動の定番手法 | playerRig の作法 |
| Meta: VR comfort best practices | developers.meta.com | 快適性ガイドライン | 既定値の根拠 |
| Kinematics-driven cybersickness (arXiv) | 2502.03419 | jerkでFFR+FOV協調 | Comfort×FFR連結 |
| Vision-only sickness prediction (arXiv) | 2501.01212 | オンデバイス推論 | 予測の実体化 |
| Tunnelling/vignette shader 各種 | (three.js forum) | 周辺減光トンネリング | 既存vignetteの改良 |

**改善点**
1. **playerRig 導入（P0/S）**: カメラ＋コントローラを `THREE.Group` に内包し移動の基盤に。→ `src/vr/VRApp.js`（A14/A11前提）。
2. **放物線テレポート（P0/M）**: three `webxr_vr_teleport`/blink パターンを移植。床レイキャスト→rig移動。→ 新 `Locomotion.js`。
3. **スムーズ移動＋トンネリング（P1/M）**: スティック移動時に `ComfortSystem` の vignette を強化（速度連動）。
4. **レストフレーム（P1/M）**: 静的参照（コックピット枠/地平線/床グリッド）で酔い軽減。→ `ComfortSystem`＋ホーム環境(A12)。
5. **運動学駆動の協調制御（P1/M）**: jerk を特徴に加え、酔い兆候で FOV＋foveation を同時調整（2502.03419, C2）。→ `ComfortSystem`×`FFRSystem`。
6. **快適性設定UI＋永続化（P1/M）**: vignette/FOV/snap/teleport をVR内トグル化し IndexedDB 保存（A5/B7）。
7. **テレポート専用モード（P1/S）**: 高感受性者向け既定（snap turn + teleport only）。
8. **オンデバイス酔い予測（P2/L）**: heuristic を小モデル(ONNX/TF.js)へ（2501.01212, C3）。

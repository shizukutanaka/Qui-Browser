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
| 4 | ハンドトラッキング・コントローラ・3D操作 | ✅ 完了 |
| 5 | 空間オーディオ | ✅ 完了 |
| 6 | MR / パススルー / アンカー & シーン理解 | ✅ 完了 |
| 7 | マルチプレイヤー / ネットワーク / アバター | ✅ 完了 |
| 8 | パフォーマンス & グラフィックスパイプライン | ✅ 完了 |
| 9 | オンデバイス AI/ML（ブラウザ内推論） | ✅ 完了 |
| 10 | PWA / build / CI / test / observability / a11y / i18n | ✅ 完了 |

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

## Category 4 — ハンドトラッキング・コントローラ・3D操作

| リソース | URL | 概要 | Quiにとっての意味 |
|---------|-----|------|------------------|
| three.js `XRHandModelFactory`/`OculusHandModel` | github.com/mrdoob/three.js | 関節Group・ハンドモデル・pinch | `HandTracking` の基盤（既利用） |
| stewartsmith/handy.js | stewartsmith.io/work/handy-js | 宣言的ハンドポーズ認識 | アドホックなジェスチャ判定を置換 |
| AdaRose/handy-work | github.com/MozillaReality/handy-work | ポーズ→イベント認識 | スクロール/選択へ写像 |
| immersive-web/webxr-input-profiles | github.com/immersive-web/webxr-input-profiles | コントローラ profile/モデル | A2 コントローラ対応 |
| pmndrs/xr (interactions) | github.com/pmndrs/xr | pointer/interactable 抽象 | 統一ポインタ設計の参照 |
| Meta WebXR Hands docs | developers.meta.com/horizon/.../webxr-hands | pinch/emulated gamepad | 入力仕様の正準 |
| WebKit transient-pointer | webkit.org/blog/15162 | Vision Pro gaze-pinch入力 | visionOS 対応 |
| STMG microgestures (ACM CHI'24) | dl.acm.org/doi/10.1145/3613904.3642702 | 親指マイクロジェスチャ | 低疲労スクロール/タブ |
| ViewfinderVR / Expanding targets (arXiv) | 2110.02514 / 2308.12515 | 遠距離選択改善 | リンク選択の精度 |

**改善点**
1. **ポインタ抽象の統一（P0/M）**: ハンド＋コントローラを共通の `Pointer`（origin/direction/select）に。raycast 対象は interactable レイヤに登録。→ 新 `src/vr/interaction/Pointer.js`。
2. **宣言的ポーズ認識（P1/M）**: `handy.js`/`handy-work` を導入し `HandTracking` のジェスチャ判定を置換・拡張。
3. **遠距離選択の改善（P2/M）**: ターゲット拡大/viewfinder（2308.12515/2110.02514）でリンク選択を高精度化。gazeと融合可。
4. **transient-pointer 対応（P2/S）**: Vision Pro の gaze-pinch 入力に対応。→ セッション入力処理。
5. **マイクロジェスチャ操作（P1/S）**: 親指スワイプ→スクロール/タブ切替（STMG）。→ `HandTracking` にイベント追加。
6. **触覚の結線（P1/S）**: `HapticFeedback`(既存) を select/hover に接続（現状ジェスチャ→音のみ）。
7. **両手操作（P2/M）**: パネルの拡大縮小/回転を両手ピンチで。
8. **インタラクタブル登録機構（P1/S）**: 物理不要のヒット対象レジストリ＋ホバー/プレス状態管理。

## Category 5 — 空間オーディオ

| リソース | URL | 概要 | Quiにとっての意味 |
|---------|-----|------|------------------|
| GoogleChrome/omnitone | github.com/GoogleChrome/omnitone | アンビソニックのバイノーラル描画 | 360音場ベッド |
| polarch/JSAmbisonics | github.com/polarch/JSAmbisonics | FOA/HOA＋SOFA HRTF | 高次アンビソニック/個人化 |
| Resonance Audio (web) | resonance-audio.github.io | 空間音響SDK（omnitone基盤） | ルーム音響/減衰の参照 |
| Web Audio `PannerNode` (HRTF) | MDN | 内蔵HRTFパン | 既存 `SpatialAudio` の土台 |
| SOFA HRTF (SADIE) | sofaconventions.org | 標準HRTFデータ | 個人化/高品質化 |
| AudioWorklet | MDN | 低遅延カスタムDSP | NN/畳み込みの実行基盤 |
| LINN (arXiv) | 2509.14069 | 軽量バイノーラルNN | 注目話者の高品質化 |
| ASAudio survey (arXiv) | 2508.10924 | 空間音響研究の俯瞰 | LOD/知覚最適化の指針 |

**改善点**
1. **知覚的オーディオLOD（P1/S）**: 近接/大音源のみフルHRTF、遠方は等電力パン。→ `src/vr/audio/SpatialAudio.js`（純ロジック）。
2. **アンビソニック背景音（P2/M）**: `omnitone` で 360 環境音ベッドを合成。
3. **ルーム音響/残響（P2/M）**: `ConvolverNode` ＋シーン寸法駆動のリバーブ。
4. **SOFA HRTF 個人化（P2/M）**: `JSAmbisonics` でユーザー選択HRTF。
5. **遮蔽/障害（MR連携）（P2/M）**: シーン形状(Cat6)で減衰/ローパス。
6. **マルチプレイヤ音声のHRTF化（P1/M）**: 遠隔音声を話者位置の panner 経由に（B11）。
7. **LINN高品質パス（P2/M）**: AudioWorklet+ONNXで注目話者のみ高品質バイノーラル。
8. **距離減衰/ドップラ較正（P2/S）**: rolloff 調整・ドップラ無効化（酔い/不快回避）。

## Category 6 — MR / パススルー / アンカー & シーン理解

| リソース | URL | 概要 | Quiにとっての意味 |
|---------|-----|------|------------------|
| webxr-samples hit-test-anchors | github.com/immersive-web/webxr-samples | ヒットテスト＋アンカー | 実面への配置 |
| immersive-web/real-world-meshing | immersive-web.github.io/real-world-meshing | Mesh Detection 仕様 | 実環境メッシュ取得 |
| immersive-web/depth-sensing | github.com/immersive-web/depth-sensing | Depth API 仕様 | 遮蔽/即時ヒットテスト |
| Meta IWSDK (Scene Understanding) | developers.meta.com/.../iwsdk-guide-scene-understanding | plane/mesh/anchor 統合SDK | 実装パターンの宝庫 |
| Babylon.js WebXR AR features | doc.babylonjs.com/.../webXRARFeatures | AR機能の実装参照 | 機能網羅の比較 |
| Meta Depth API in Browser | uploadvr (Horizon 40.4) | Depth駆動の即時ヒットテスト | Scene Mesh無しで配置 |
| WebXR Anchors (persistent) | immersive-web | アンカー保存/復元 | B8 配置の永続化 |
| WebXR Plane Detection | immersive-web | 平面検出 | 壁/机に窓を貼る |

**改善点**
1. **永続アンカー（P1/M）**: `MixedReality.js` のメモリ内 Map を、アンカーハンドル export/restore＋IndexedDB 保存に（B8/A5）。
2. **Depth Sensing（P1/M）**: `depth-sensing` で実物遮蔽＋即時ヒットテスト（Quest 3）。
3. **平面/メッシュ検出（P1/M）**: 壁・机・床にブラウザ窓を吸着配置。
4. **光推定（P2/S）**: `light-estimation` で仮想物の馴染み向上。
5. **アンカー連動の窓配置（P1/M）**: ブラウザ窓を部屋に固定し再訪時復元（B5＋B8）。
6. **dom-overlay（AR 2D UI）（P2/S）**: AR時の2D UIを `dom-overlay` で。
7. **IWSDK パターン移植（P2/M）**: Scene Understanding のアンカー/メッシュ設計を参照実装。
8. **パススルー品質/セグメンテーション（P2/M）**: 手/人セグメンテーションで合成改善。

## Category 7 — マルチプレイヤー / ネットワーク / アバター / プレゼンス

| リソース | URL | 概要 | Quiにとっての意味 |
|---------|-----|------|------------------|
| networked-aframe/networked-aframe | github.com/networked-aframe/networked-aframe | NAF: コンポーネント同期＋音声/映像 | 同期戦略の参照 |
| colyseus/colyseus | github.com/colyseus/colyseus | 権威サーバ状態同期(schema) | スケールする状態管理 |
| Croquet / Multisynq | multisynq.io | 決定論的同期・スナップショット | サーバレス同期/再開 |
| versatica/mediasoup | github.com/versatica/mediasoup | WebRTC SFU | P2Pメッシュ超えの音声配信 |
| feross/simple-peer | github.com/feross/simple-peer | WebRTC ラッパ | RTC実装の簡素化 |
| Ready Player Me | readyplayer.me | glTFアバター生成 | アバター即導入 |
| Hubs-Foundation/hubs | github.com/Hubs-Foundation/hubs | フル機能ソーシャルVR | プレゼンス設計の宝庫 |
| geckos.io | github.com/geckosio/geckos.io | UDP(WebRTC datachannel) | 低遅延状態同期 |
| Open Metaverse arch (arXiv) | 2404.05317 | NAF/A-Frame基盤の構成論 | アーキ指針 |

**改善点**
1. **死んだインフラ置換（P1/S）**: `MultiplayerSystem.js` の Heroku signaling / numb.viagenie.ca TURN を撤去し設定可能化。状態は Colyseus/geckos も検討（A3）。
2. **アバター（P2/M）**: Ready Player Me の glTF を読み込み、頭/手トランスフォームを送受信。
3. **SFU 音声（P2/L）**: `mediasoup` で多人数音声をスケール（P2Pメッシュの限界回避）。
4. **空間ボイスのHRTF化（P1/M）**: 遠隔音声を話者位置 panner に（Cat5-6）。
5. **補間/デッドレコニング（P2/M）**: 遠隔トランスフォームの平滑化。
6. **プレゼンス/名簿（P2/S）**: join/leave・参加者一覧。
7. **同期戦略の明確化（P2/M）**: NAF式コンポーネント同期 or Colyseus schema を採用。
8. **simple-peer 採用（P2/S）**: WebRTC ボイラープレート削減。

## Category 8 — パフォーマンス & グラフィックスパイプライン

| リソース | URL | 概要 | Quiにとっての意味 |
|---------|-----|------|------------------|
| three.js `renderer.info` / BatchedMesh | github.com/mrdoob/three.js | draw call/メモリ計測・バッチ描画 | `PerformanceMonitor` 拡張 |
| mrdoob/stats.js | github.com/mrdoob/stats.js | FPS/フレーム計測 | 基本HUD |
| BabylonJS/spector.js | github.com/BabylonJS/Spector.js | WebGLフレームデバッグ | 描画ボトルネック解析 |
| utsuboco/r3f-perf | github.com/utsuboco/r3f-perf | R3F向け詳細perf | 計測指標の参照 |
| donmccurdy/glTF-Transform | github.com/donmccurdy/glTF-Transform | glTF最適化(prune/draco/ktx2) | アセット軽量化CLI |
| Meta OVR Metrics Tool | developers.meta.com | 端末側GPU/温度/FPS | 実機計測 |
| XRWebGLLayer `framebufferScaleFactor` | W3C WebXR | 動的解像度 | 負荷連動の解像度制御 |
| WebGPU timestamp-query | gpuweb | GPU時間計測 | 正確なGPUプロファイル |

**改善点**
1. **GPU/CPUバジェット計測（P1/M）**: `renderer.info`＋WebGPU timestamp で実測。→ `src/utils/PerformanceMonitor.js` 拡張（現状はFPS/メモリ中心）。
2. **draw call 削減（P1/S）**: `BatchedMesh`/ジオメトリ統合（UI/タブ多数時）。
3. **動的解像度スケーリング（P1/M）**: GPU負荷で `framebufferScaleFactor` を可変（FFRと協調）。
4. **glTF-Transform パイプライン（P1/M）**: prune/dedup/draco/ktx2 を build 時適用（Cat2-4と統合）。
5. **LODシステム（P2/M）**: `THREE.LOD` で距離別ディテール。
6. **テクスチャ予算の強制（P2/S）**: `TextureManager` 統計に上限・退避を実装。
7. **ホットパスの脱アロケーション（P2/S）**: `ObjectPool` を update ループの一時オブジェクトへ拡張。
8. **計測ツール統合（P2/S）**: dev時に spector.js/r3f-perf 相当を `DevTools` へ。

## Category 9 — オンデバイス AI/ML（ブラウザ内推論）

| リソース | URL | 概要 | Quiにとっての意味 |
|---------|-----|------|------------------|
| microsoft/onnxruntime-web | github.com/microsoft/onnxruntime | ONNX 推論(WASM/WebGPU EP) | 汎用モデル実行基盤 |
| tensorflow/tfjs | github.com/tensorflow/tfjs | TF.js（WebGL/WebGPU） | 既存コメントの実体化先 |
| huggingface/transformers.js | github.com/huggingface/transformers.js | ブラウザ内Transformer(v3/4) | 要約/検索/NLU |
| google-ai-edge/mediapipe | github.com/google-ai-edge/mediapipe | 手/顔/ジェスチャ実時間推論 | Cat4 ジェスチャ補強 |
| webmachinelearning/webnn | github.com/webmachinelearning/webnn | WebNN（HW最適経路） | 省電力推論 |
| mlc-ai/web-llm | github.com/mlc-ai/web-llm | ブラウザ内LLM(WebGPU) | 補助/要約(将来) |
| GazeProphet / vision-only sickness (arXiv) | 2508.13546 / 2501.01212 | 視線/酔い予測 | C1/C3 の実体化 |

**改善点**
1. **AI推薦の実体化（P1/M）**: `src/ai/AIRecommendation.js` を `onnxruntime-web`/`tfjs` で実装（A4、コンテンツ整備後）。
2. **オンデバイス酔い予測（P2/L）**: ORT-Web(WebGPU) で小モデル（C3/2501.01212）。
3. **ソフト視線予測（P1/M）**: GazeProphet 系の小モデル→共有 `GazeProvider`（Cat3/Cat2連携, C1）。
4. **MediaPipe ハンド（P2/M）**: ジェスチャ認識の補強/フォールバック（Cat4）。
5. **transformers.js（P2/M）**: 閲覧内容の要約/オンデバイス検索。
6. **WebNN バックエンド（P2/S）**: 対応時に省電力経路へ。
7. **モデル配信/キャッシュ（P1/S）**: `ProgressiveLoader`＋Cache/IndexedDBでモデルを遅延ロード・永続キャッシュ。
8. **音声コマンドNLU（P2/M）**: `VoiceCommands` のキーワード一致を小NLUへ。

## Category 10 — PWA / build / CI / test / observability / a11y / i18n

| リソース | URL | 概要 | Quiにとっての意味 |
|---------|-----|------|------------------|
| vite-plugin-pwa / GoogleChrome/workbox | github.com/vite-pwa/vite-plugin-pwa | SW自動生成/precache/更新 | 手書きSWの置換 |
| microsoft/playwright | github.com/microsoft/playwright | e2e（WebXRエミュレート可） | 統合テスト基盤 |
| vitest | github.com/vitest-dev/vitest | 高速ユニットテスト | jest代替候補 |
| i18next / FormatJS | github.com/i18next/i18next | i18n フレームワーク | A6 多言語化 |
| dequelabs/axe-core | github.com/dequelabs/axe-core | a11y 自動検査 | A7 のCIゲート |
| GoogleChrome/lighthouse-ci | github.com/GoogleChrome/lighthouse-ci | 性能/PWA予算 | `.lighthouserc` の実行 |
| immersive-web WebXR emulator | github.com/MozillaReality/WebXR-emulator-extension | 非実機XRテスト | CI/開発のXR検証 |
| renovatebot / dependabot | github.com/renovatebot/renovate | 依存更新自動化 | 保守性 |
| rollup-plugin-visualizer | github.com/btd/rollup-plugin-visualizer | バンドル可視化 | サイズ管理 |

**改善点**
1. **lockfile コミット（P1/S）**: `package-lock.json` を un-ignore（CIの `npm ci` 成立, A13）。
2. **テスト拡充＋e2e（P1/M）**: 主要サブシステムのユニット（A8）＋ Playwright + WebXR emulator の e2e。
3. **PWA基盤の置換（P1/M）**: 手書き `service-worker.js` を `vite-plugin-pwa`/workbox に（自動precache/更新, B9と相乗）。
4. **i18n 導入（P2/M）**: i18next/FormatJS（A6）。
5. **a11y CIゲート（P1/S）**: `axe-core` をランディング/DOM overlay に（A7）。
6. **Lighthouse CI 予算（P1/S）**: 既存 `.lighthouserc.json` を CI で実行・予算超過で失敗。
7. **依存自動更新（P2/S）**: Renovate/Dependabot。
8. **可観測性の実活用（P2/S）**: web-vitals(導入済)＋Sentry(opt-in) のダッシュボード化。
9. **バンドル可視化（P2/S）**: rollup-plugin-visualizer でサイズ監視。

---

## まとめ — 横断テーマ（10カテゴリー俯瞰）

カテゴリー横断で繰り返し現れた要石:
- **A1/B5 実Webコンテンツ＋クローム** が全ての前提（推薦・履歴・テキスト編集・セキュリティはこれに依存）。
- **共有 `GazeProvider`**（Cat2/3/4/9）= フォービエーション・酔い・選択・配信が同じ視線信号を共有。
- **永続化レイヤ(IndexedDB)**（Cat3/6/7/9/10）= 設定・履歴・アンカー・モデルキャッシュの共通基盤。
- **playerRig＋統一ポインタ**（Cat3/4）= 移動と操作の土台。
- **WebGPU＋圧縮パイプライン**（Cat2/8）= 性能の中核（「2x」主張の実証含む）。
- **正直な訴求と再現可能ビルド/テスト**（Cat10, B15, A8/A13）= 信頼性。

> 注: 本書は arxiv/GitHub の一次情報（リポジトリ/論文ID）に基づく要点抽出。数値・最新IDは原典で要確認。`assets/js/` v5.x が「主張のみ」保有する高度機能の多くは、本書の改善点として live `src/` への実体化・実測が必要。

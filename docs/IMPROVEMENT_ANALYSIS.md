# Qui Browser VR — 改善点分析 (Improvement Analysis)

> 目的: 同種ソフト（WebXRブラウザ）と arxiv.org の研究を参照し、改善点を洗い出す。
> 対象バージョン: v2.0.0 / スタック: Three.js + WebXR、想定端末: Meta Quest 2/3, Pico 4。
>
> 構成:
> - **Part A — 実装現状ベースのギャップ**（本リポジトリのコード根拠つき）
> - **Part B — 同種ソフトとの比較**（Wolvic / Quest Browser / visionOS ほか）
> - **Part C — arxiv 研究からの適用候補**
>
> 優先度: P0=中核価値/即対応, P1=高, P2=中。工数: S(数日) / M(1–2週) / L(1ヶ月+)。

---

## Part A — 実装現状ベースのギャップ（コード根拠つき）

### A1. 【最重要 / P0・L】実際にWebページを描画できない — "ブラウザ"の中核機能が無い
- **コード根拠**: `src/vr/VRApp.js` の `setupScene()` は `ambientLight` と `directionalLight` を追加するだけ。`src/` 全体に iframe / CSS3D / HTMLMesh / DOM-to-texture / URLバー / タブ / 履歴 / ナビゲーションの実装が無い（grep で確認: 該当は VoiceCommands のコマンド名スタブと DevTools のインスペクタタブのみ）。
- **影響**: 製品名・README は「VR browser / 17 features」を謳うが、入室しても照明のみで**Webを閲覧できない**。最大の機能・信頼性ギャップ。
- **推奨**:
  1. Webコンテンツのレンダリング経路を1本通す。最小実装は `OffscreenCanvas`/`<iframe>` → テクスチャ化したパネル（quadメッシュ）。クロスオリジン制約があるため、まずは自前コンテンツ/プロキシ or `same-origin` のPWA内ビューから。
  2. URLバー・戻る/進む・タブ・ブックマーク・履歴の最小UIを3Dパネルとして実装。
  3. 鮮明な文字のため **WebXR Layers API**（quad/cylinder layer）を使う（A10参照）。
- **代替方針**: もし「ブラウザ」ではなく「VR体験プラットフォーム」が本意なら、命名と訴求を改め、A1の優先度は下げる（要・意思決定）。

### A2. 【P0・M】コントローラ入力が無い（ハンドトラッキングのみ）
- **コード根拠**: `getController()` / `XRControllerModelFactory` / レーザーポインタ / `selectstart`/`squeeze` の実装が無い。入力は `src/vr/interaction/HandTracking.js`（`getPointingRay`）に限定。
- **影響**: Quest ユーザーの大多数は**コントローラ**を使う。現状そのレイ操作・選択・移動ができない。
- **推奨**: `XRControllerModelFactory` でコントローラモデル表示＋レイキャスト選択（`three/examples/jsm/webxr/`）。ハンドとコントローラを共通の「ポインタ」抽象に統一。

### A3. 【P1・S】Multiplayer が停止済みインフラに依存
- **コード根拠**: `src/vr/multiplayer/MultiplayerSystem.js` に `signalingUrl = 'wss://qui-browser-signaling.herokuapp.com'`（Heroku無料dynoは2022に廃止）と `turn:numb.viagenie.ca`（数年前にサービス終了）がハードコード。
- **影響**: 有効化しても**接続不能**。
- **推奨**: signaling/TURN を環境変数化（既定は明示的に未設定→experimental扱い）。動作するTURN（例: 自前 coturn / Twilio NTS）を案内。当面はREADME/設定で「実験的・要サーバ」と明示。

### A4. 【P1・M】AIRecommendation は実体の無いスタブ
- **コード根拠**: `src/ai/AIRecommendation.js` は `this.model = null`、コメントに「For production, would load actual TensorFlow.js model」「Fallback to heuristic-based recommendations」。推薦対象のコンテンツ・カタログも存在しない（A1依存）。
- **影響**: 機能として成立していない。
- **推奨**: A1 で実コンテンツ（履歴/ブックマーク/タブ）が出来てから、軽量 on-device 推論（`onnxruntime-web` か TF.js）で。それまでは「heuristic」と正直に明示。

### A5. 【P1・S】設定・ユーザープロファイルの永続化が無い
- **コード根拠**: `localStorage`/`IndexedDB` 不使用。`AIRecommendation` に「export user profile」はあるが保存先が無い。快適性プリセット（`ComfortSystem.setPreset`）もリロードで消える。
- **推奨**: 設定・快適性プリセット・履歴・プロファイルを `IndexedDB`（or `localStorage`）に永続化。将来的にアカウント同期。

### A6. 【P2・M】i18n フレームワークが無い
- **コード根拠**: UI文字列は英語固定（`index.html` / `main.js`）。日本語は `VoiceCommands`(`ja-JP`) と IME のみ。メッセージカタログ機構が無い。
- **推奨**: 軽量 i18n（キー→多言語カタログ、`Intl` 連携）。日本語IMEを持つ強みを活かし ja/en を一級対応。

### A7. 【P1・M】アクセシビリティが弱い
- **コード根拠**: `aria-*` は `index.html` に1箇所のみ。空間音声の字幕（caption）・色覚配慮・コントラスト・快適性設定UIが無い。
- **推奨**: 空間音声の字幕/キャプション、色覚モード、コントラスト/フォントサイズ、快適性設定パネル（vignette/FOV/snap/teleportのトグル）。XR a11y は差別化要因。

### A8. 【P1・M】テストカバレッジが極小
- **コード根拠**: `src/` は20モジュール中、能動テストが触れるのは3つ（`ObjectPool`, `AIRecommendation`, `VoiceCommands` — `tests/app-smoke.test.js`）。`jest` の `coverageThreshold` は暫定 0。
- **推奨**: 主要サブシステム（FFR/Comfort/TextureManager/ProgressiveLoader/HandTracking）にユニットテストを追加し、`src/` 限定の現実的な閾値を再設定。

### A9. 【P2・M】FFR が静的（視線追従が無い）
- **コード根拠**: `src/vr/rendering/FFRSystem.js` は `projectionLayer.fixedFoveation = intensity` のみ（GPU負荷駆動）。`eye-tracking`/`gaze` 不使用。
- **推奨**: Quest Pro / Quest 3 の eye-tracking が使える場面で **gaze-contingent foveation**（中心窩を視線に追従）。Part C 参照。

### A10. 【P1・M】WebXR Layers API 未活用（文字が滲む）
- **コード根拠**: `XRWebGLBinding` は FFR の projection layer 取得にのみ使用。quad/cylinder layer による2Dコンテンツの直接合成が無い。
- **影響**: Webパネル（A1）をシーン内テクスチャで描くと**テキストが不鮮明**になりやすい。
- **推奨**: テキスト/UI/Web面は `XRQuadLayer` / `XRCylinderLayer` で合成（再投影でシャープ・低遅延）。

### A11. 【P2・S】テレポート移動が無い
- **コード根拠**: `ComfortSystem` は snap/smooth turn と移動検知のみ。teleport locomotion の実装が無い。
- **推奨**: 放物線テレポート（最も酔いにくい移動）を追加。ブラウザ用途では移動は限定的だが、空間配置のため有用。

### A12. 【P2・S】入室直後のシーンが空（ホーム環境が無い）
- **コード根拠**: `setupScene()` は照明のみ。スカイボックス/床/既定環境が無い。
- **推奨**: 既定のホームスペース（床グリッド+スカイボックス+ウェルカムパネル）。空間の基準（rest frame）は酔い軽減にも寄与（Part C）。

### A13. 【P2・S】再現可能ビルド: lockfile 未コミット
- **コード根拠**: `package-lock.json` が `.gitignore` 対象だが、CI（`ci.yml` ほか）は `npm ci` を使用 — lockfile が必須。
- **推奨**: `package-lock.json` をコミット（un-ignore）し `npm ci` を成立させる。

### A14. 【P2・S】フレームクロックの一貫性
- **コード根拠**: `VRApp.render(timestamp, xrFrame)` は `updateSystems(timestamp,...)` を呼ぶ一方、`ComfortSystem.update(deltaTime)` は別系統。`THREE.Clock` の単一デルタに統一されていない。
- **推奨**: 単一のフレームクロック（delta）を各サブシステムへ配布。可変フレームでの挙動安定。

---

## Part B — 同種ソフトとの比較（Wolvic / Meta Quest Browser / visionOS Safari / Hubs / FRAME ほか）

**総括**: 実在のVRブラウザ（Wolvic=Gecko/Chromium, Quest Browser=Chromium, Vision Pro Safari=WebKit, Android XR=Chrome）はすべて**フルWebエンジンで任意のDOM/HTMLを描画**する。Qui はこれを持たないため、比較上のギャップは「エンジン非搭載」に集約される。以下は Part A と重複しない**ブラウザらしさ**の差分。

| ID | 改善点 | 競合の実例 | Qui の現状 | 優先 | 工数 |
|----|--------|-----------|-----------|------|------|
| B5 | ブラウザクローム（URLバー/タブ/複数ウィンドウ/履歴） | Quest Browser はマルチウィンドウ＋タブ＋プライベート | 皆無 | P1 | L |
| B6 | ブックマーク/履歴/同期 | 全競合が標準装備 | 永続化レイヤ自体が無い（A5と同根） | P1 | S |
| B7 | VR内設定パネル | Quest/Wolvic は headset 内設定UI | `VRApp.settings` はハードコードのみ・UIなし | P1 | M |
| B8 | 永続アンカー（MR配置の保存/復元） | Quest は persistent anchors を保存/復元 | `MixedReality.js` はメモリ内 Map のみ・復元なし | P1 | M |
| B9 | PWA install → 即没入起動 | Meta 推奨: ロード直後に `requestSession` | 2Dランディング→クリック待ち（自動没入なし） | P1 | S |
| B11 | アバター/プレゼンス/空間ボイス | Hubs/FRAME は glТF アバター＋WebRTC空間音声 | `MultiplayerSystem` は雛形のみ（A3で停止URL） | P2 | L |
| B12 | メディアパネル（PDF/動画/360/画面共有） | FRAME/Hubs は空間にメディア配置 | WebCodecs等の素材はあるが配置UIなし | P2 | M |
| B13 | オリジン別サンドボックス/権限 | 実ブラウザはエンジンレベルで分離 | 遠隔コンテンツ描画(A1)時の権限/分離設計なし | P2 | M |
| B14 | WebGPU を実描画ループへ | 各エンジンが WebGPU 移行中 | `WebGPURenderer.js` は実験的・ループ未接続（「2x」は未実証） | P2 | L |
| B15 | 訴求と実態の整合 | — | README は「production-ready browser / 17 features / 90-120 FPS」だが閲覧・移動・コントローラ操作が無い | P2 | S |

**最重要メッセージ（B15）**: 現状の成果物は「機能フラグのデモ／空間シェル」であり、Webブラウジング・ロコモーション・コントローラ操作を欠く。`browser` の語は **A1・A2・A11・B5** が揃うまで留保し、README を実態（"WebXR performance-optimized app framework / spatial shell"）に合わせて再定義し、上記を公開ロードマップ化するのが信頼性の観点で最善。

## Part C — arxiv 研究からの適用候補（2024–2026）

**総括**: 直接適用しやすい研究が多数。特に**フォービエーション×酔い×3DGS×ストリーミング×選択**は「視線（gaze）信号」を共通入力とするため、横断的な `GazeProvider` を1本用意すると一気に実装が安くなる（末尾の横断提案）。

| ID | 改善点 | 論文 (arXiv) | 技術要約 | 適用先サブシステム | 優先 | 工数 |
|----|--------|-------------|---------|------------------|------|------|
| C1 | アイトラッカー無しの**視線予測**で動的フォービエーション | GazeProphet 2508.13546 | 頭部/コントローラ動作＋シーンから注視点を軽量予測 | `FFRSystem`（A9の代替経路）/ Quest 2/3・Pico 4 | P0 | M |
| C2 | 運動学駆動で **FFR＋FOV を同時制御**して酔い軽減 | 2502.03419 | 頭部の速度/加速度/**jerk**で酔いを予測しFOV＋フォービエーションを協調調整 | `ComfortSystem` × `FFRSystem` の連結 | P0 | M |
| C3 | **オンデバイス**酔い予測モデル（vision-only） | 2501.01212 | 消費者級信号からリアルタイム推論（GNN蒸留） | `ComfortSystem`（ONNX Runtime Web/TF.js, 1秒間隔） | P0 | L |
| C4 | **フォービエイテッド 3DGS**（中心窩=neural点/周辺=粗Gaussian） | VR-Splatting 2410.17932 | 90Hz級・周辺LOD低減 | （3DGS導入時）gaze と LOD 連結 | P1 | L |
| C5 | 大規模3DGSの **LOD＋空間チャンク・ストリーミング** | LODGE 2505.23158 | 距離別Gaussian選択＋チャンク逐次読込 | ObjectPool/ProgressiveLoader 再利用 | P1 | L |
| C6 | **WebGPU 3DGS**（GPUソート/compute前処理） | WebSplatter 2602.03207* | CPUソート除去で大幅高速化 | 実験的 `WebGPURenderer` の活用先（B14と相乗） | P1 | L |
| C7 | 軽量**バイナラル合成NN** | LINN 2509.14069 | 少パラメータでHRTF級品質 | `SpatialAudio`（AudioWorklet+WASM/ONNX、近接話者のみ） | P1 | M |
| C8 | **親指マイクロジェスチャ**（低疲労入力） | STMG (CHI'24) | 7種を95%級で認識（スクロール/タブ切替に） | `HandTracking` にイベント追加（スクロール/タブ） | P1 | S |
| C9 | マイクロジェスチャ**テキスト編集** | microGEXT 2504.04198 | センサ不要でURL/フォーム編集を高速化 | URLバー/フォーム入力（A1/B5と連動） | P1 | M |
| C10 | **視線駆動フォービエイテッド転送**（配信/360） | EyeNexus 2509.11807 | 注視点へ高ビットレート集中 | 360/WebRTC 経路、gaze と ABR 連結 | P1 | M |
| C11 | **遅延最小化**（late-latching / ASW誘導） | PredATW; 2301.10408 | poseをrAF末端で最遅サンプル | render ループ・dead-reckoning予測 | P2 | M |
| C12 | **知覚的オーディオLOD** | ASAudio survey 2508.10924 | 近接/大音源のみフルHRTF、遠方は等電力パン | `SpatialAudio`（純ロジック） | P2 | S |
| C13 | **kernel/log-polar フォービエーション**（自前WebGL経路） | Kernel Foveated; FoVolNet 2209.09965 | 周辺をlog-polar縮約→再構成 | `FFRSystem` のpost-process（Pico 4向け） | P2 | L |
| C14 | **遠距離選択**（target expansion / viewfinder） | ViewfinderVR 2110.02514; 2308.12515 | 動的ターゲット拡大でレイ選択を改善 | コントローラ・レイ層（A2）＋gaze融合 | P2 | M |
| C15 | **アイトラッキング品質ゲート**（ETFR堅牢化） | 2403.07210 | 輝度/ずれで精度低下→フォービ半径を安全側へ | （眼トラ対応時）信頼度で foveal 半径制御 | P2 | S |

\* 2602.03207 / 2512.08478 は非常に新しいIDのため要確認（下記caveat）。

### 横断アーキテクチャ提案（最重要・低コスト）: 共有 `GazeProvider` バス
C1, C2, C4, C10, C14 はいずれも**同じ注視点**を必要とする。現状は FFR・酔い・（将来の）3DGS・配信・選択が各々で動作を追跡。`GazeProvider`（実gaze→予測gaze→頭部前方の3段フォールバック）を1本用意し各系が購読すれば、C1/C2/C4/C10 をまとめて安価に実装できる。**Part A の各サブシステムを疎結合化する設計上の要石。**

### Caveat（正直な但し書き）
- arxiv.org は WebFetch が 403 のため、技術要約は検索アブストラクト由来。数値（例: LINN 72.7%, 各精度）は**PDF原文で要検証**。
- 2件の新しいarXiv ID（WebSplatter 2602.03207, Visionary 2512.08478）は実在/詳細を要確認。
- **重要**: `assets/js/` の v5.x SDK には既に `vr-foveated-rendering-unified.js`・`vr-cybersickness-preventer.js`・`vr-gaussian-splatting.js`・`vr-eye-tracking-foveation-advanced.js`・`vr-hand-tracking-enhanced.js` 等が**存在を主張**している（本セッションで確認した src/ と assets/js/ の二重コードベース）。C1/C2/C8 等は「新規実装」ではなく**既存主張の実体化・live `src/` への結線・実測検証**として扱うべき。誇大主張の是正（B15）と一体。

---

## 優先度サマリ（Part A）

| ID | 改善点 | 優先 | 工数 |
|----|--------|------|------|
| A1 | 実Web描画（中核機能） | P0 | L |
| A2 | コントローラ入力＋レイ操作 | P0 | M |
| A3 | Multiplayer インフラ設定可能化 | P1 | S |
| A4 | AI推薦の実体化（A1依存） | P1 | M |
| A5 | 設定/プロファイル永続化 | P1 | S |
| A7 | アクセシビリティ強化 | P1 | M |
| A8 | テストカバレッジ拡充 | P1 | M |
| A10 | WebXR Layers でテキスト鮮明化 | P1 | M |
| A6 | i18n フレームワーク | P2 | M |
| A9 | gaze追従フォービエーション | P2 | M |
| A11 | テレポート移動 | P2 | S |
| A12 | ホーム環境 | P2 | S |
| A13 | lockfile コミット | P2 | S |
| A14 | フレームクロック統一 | P2 | S |

---

## 総合ロードマップ（A/B/C 統合・推奨順）

優先順位は「中核価値 → 信頼性 → 体験品質 → 先端機能」の順。

**フェーズ 1 — 中核価値と正直さ（まずブラウザにする）**
1. **B15/A1**: 訴求を実態に合わせる＋Web描画経路を1本通す（最小: 自前/プロキシ面をquad layerで）。
2. **A2 + B5**: コントローラ・レイ操作 → URLバー/タブ/履歴の最小クローム。
3. **A10**: WebXR Layers（quad/cylinder）でテキストを鮮明化（閲覧デバイスの最重要品質）。
4. **A11**: テレポート移動（playerRig 導入）。

**フェーズ 2 — 信頼性・永続化・基盤整備**
5. **A5/B6/B7**: IndexedDB 永続化（設定/履歴/ブックマーク）＋VR内設定パネル。
6. **A3**: Multiplayer の signaling/TURN を設定可能化（停止URL除去）。
7. **A8**: 主要サブシステムのテスト拡充＋`src/`限定の現実的カバレッジ閾値。
8. **A13**: lockfile コミットで `npm ci` 成立。
9. **B9**: PWA install→即没入起動。

**フェーズ 3 — 体験品質（研究の即時適用）**
10. **横断: `GazeProvider` バス**を導入（C1の予測gazeをフォールバックに）。
11. **C2 + A9/C1**: ComfortSystem×FFRSystem を連結し、運動学で FOV＋フォービエーションを協調制御。
12. **C8/C9**: マイクロジェスチャでスクロール/タブ/テキスト編集（疲労低減）。
13. **A7/B10**: アクセシビリティ（gaze-and-dwell、字幕、色覚/高コントラスト、片手操作）。
14. **C12**: 知覚的オーディオLOD（純ロジックで低コスト）。

**フェーズ 4 — 先端・差別化**
15. **B14 + C6**: WebGPU を実描画ループへ（3DGS の GPU ソート）。
16. **C4/C5**: フォービエイテッド/LOD 3D Gaussian Splatting（要 3DGS 導入）。
17. **C3**: オンデバイス酔い予測モデルの実体化（assets/js の主張を live 化）。
18. **B11/B12**: アバター・空間ボイス・メディアパネル。
19. **C10/C14/C11/C15**: フォービエイテッド配信、ターゲット拡大選択、late-latching、ETFR品質ゲート。

> 注: フェーズ1の 1–3 が「VRブラウザ」を名乗る最低条件。フェーズ3以降の研究適用は、`assets/js/` の v5.x で**主張のみ**存在する高度機能（unified FFR/ETFR、cybersickness preventer、gaussian splatting 等）を live `src/` に**実体化・検証**する作業と重なる。

## 出典（Sources）

### 同種ソフト（Part B）
- Wolvic — https://github.com/Igalia/wolvic ／ Chromium移行 https://www.uploadvr.com/wolvic-switching-to-chromium/
- Meta Quest Browser — PWA-WebXR https://developers.meta.com/horizon/documentation/web/pwa-webxr/ ／ MR/anchors https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/ ／ release notes https://developers.meta.com/horizon/release-notes/web/
- Meta: WebXR Layers — https://developers.meta.com/horizon/blog/achieve-better-rendering-and-performance-with-webxr-layers-in-oculus-browser/
- visionOS 2 WebXR — https://www.uploadvr.com/visionos-2-apple-vision-pro-webxr/
- W3C WebXR Layers — https://www.w3.org/TR/webxrlayers-1/ ／ samples https://immersive-web.github.io/webxr-samples/layers-samples/
- immersiveweb.dev — https://immersiveweb.dev/
- Android XR for the web — https://developer.android.com/develop/xr/web
- WebXR Input Profiles — https://github.com/immersive-web/webxr-input-profiles
- Hubs — https://docs.hubsfoundation.org/ ／ FRAME — https://learn.framevr.io/features
- Three.js ロコモーション — https://medium.com/samsung-internet-dev/vr-locomotion-740dafa85914

### arxiv 研究（Part C）
- GazeProphet — https://arxiv.org/abs/2508.13546
- Dynamic Cybersickness Mitigation (FFR/FoV) — https://arxiv.org/abs/2502.03419
- Vision-Only Cybersickness Prediction — https://arxiv.org/abs/2501.01212
- VR-Splatting — https://arxiv.org/abs/2410.17932
- LODGE — https://arxiv.org/abs/2505.23158
- WebSplatter — https://arxiv.org/abs/2602.03207 ／ Visionary — https://arxiv.org/abs/2512.08478
- LINN (binaural) — https://arxiv.org/abs/2509.14069
- ASAudio survey — https://arxiv.org/abs/2508.10924
- STMG microgestures — https://dl.acm.org/doi/10.1145/3613904.3642702
- microGEXT — https://arxiv.org/abs/2504.04198
- EyeNexus — https://arxiv.org/abs/2509.11807
- PredATW — https://dl.acm.org/doi/10.1145/3677329 ／ Motion-to-Photon — https://arxiv.org/abs/2301.10408
- FoVolNet — https://arxiv.org/abs/2209.09965 ／ Kernel Foveated Rendering — https://dl.acm.org/doi/10.1145/3203199
- ViewfinderVR — https://arxiv.org/abs/2110.02514 ／ Expanding Targets (Fitts) — https://arxiv.org/abs/2308.12515
- Quest Pro eye-tracking signal quality — https://arxiv.org/abs/2403.07210

> Caveat: arxiv.org は自動取得が制限されていたため、技術要約は検索アブストラクト由来。数値・新規ID（2602.03207, 2512.08478）は原文で要確認。

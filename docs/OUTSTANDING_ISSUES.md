# Qui-Browser: 過不足（excess/deficiency）棚卸しリスト

このドキュメントは、現時点（CLAUDE.md Session 43 時点）で確認済みだが未対応の「過不足」（excess = 動くが無意味なコード／deficiency = 欠落している実装）を一覧化したものです。次のセッション（Opus/Sonnet いずれでも）がこのリストだけを見て単独で判断・着手できるよう、ファイルパス・行・再現条件・判断根拠を明記しています。

各項目には「対応可否」の目安として難易度と優先度を付けています。優先度は「実際にユーザーに影響するか」を基準にしており、コード上の見た目の重大さとは一致しない場合があります。

---

## A. 削除（Session 74 で完了）— イーロン・マスクのアルゴリズム step 2

「**部品を削除せよ。削除したものの 10% を戻していないなら、削除が足りない**」を適用した。
A-1 / A-2 は Session 38 から凍結されていたが、ユーザーが「イーロン・マスク思考法で完成させて」を
指示したことで解除。**削除した 129,204 行はすべて git 履歴に残る**ので、本当に必要になれば戻せる。

| 対象 | 行数 | 削除理由（すべて実測） |
|---|---|---|
| `assets/js/` | 119,698 | `src/` の旧並行実装。live 参照ゼロ（唯一の参照元 `tests/archive/` も同時削除＝閉じた死のペア） |
| `tests/archive/` | 4,276 | テスト実行から除外済みの stale ファイル |
| `src/vr/multiplayer/` | 1,390 | `enableMultiplayer` 既定 false で**トグルが存在せず**、加えて**リポジトリに signaling サーバが無い**ので第2ピアは原理的に接続不能 |
| `server/` + `api/` | 1,235 | Stripe 課金。`src/` に決済 UI が皆無、DB も無し、fail-closed スタブのみ |
| `src/vr/ar/MixedReality.js` | 963 | `startSession()` の呼び出し元ゼロ → `enabled` が真にならず `update()` も通らない |
| `src/ai/AIRecommendation.js` | 638 | 唯一の出力 `getRecommendations()` に消費者ゼロ。Session 33 で出力は空に濾過済み |
| `src/vr/rendering/WebGPURenderer.js` | 600 | `new` と `dispose` のみ。レンダーループ未接続 |
| `src/utils/ObjectPool.js` | 404 | 参照ゼロ（Session 34 で最後の消費者を削除） |
| **合計** | **129,204** | |

あわせて削除: 専用テスト6ファイル、`tsconfig.json`（`.ts` ファイルはゼロ）、
未使用 devDependencies **19件**（webpack ツールチェーン一式 + TypeScript）、
サーバ専用 runtime deps 5件（express/cors/stripe/dotenv/body-parser）、
未使用 `i18next` 2件、孤児となった i18n キー3件、`vite.config.js` の死んだ manualChunks エントリ2件。

### 実測された効果

| 指標 | before | after |
|---|---|---|
| リポジトリの JS | 165,443 行 | **36,239 行（−78%）** |
| 出荷バンドル（gzip） | 235.2 kB | **218.9 kB（−6.9%）** |
| lockfile のパッケージ数 | 807 | **474（−333）** |
| runtime dependencies | 9 | **2**（`three`, `web-vitals`） |
| lint warnings | 84 | **50** |
| テスト | 1,477 | 1,348（削除したコードのテスト129件が同時に消えた） |

**テスト数が減ったことは劣化ではない** —— 消えたのは到達不能なコードを検証していたテストで、
残った 1,348 件はすべてユーザーが到達できる経路を守っている。

### 戻す（add back）候補
マスクのアルゴリズムは「削除しすぎたら 10% を戻せ」と言う。現時点で戻す価値があるのは
**`server/` を SSRF 対策付きの取得プロキシとして作り直すこと**だけ（F-1 参照）。
課金・マルチプレイヤ・AI・WebGPU・AR は戻す理由が現状無い。

---

## B. 調査済み・意図的に未修正（理由付き）

### B-1. `DeviceCompatibility.js` の AR 機能フラグが不正確（優先度: 低、難易度: 低〜中）
- **場所**: `src/utils/DeviceCompatibility.js` の `_probeOptionalFeatures(xr, vrSupported, tier)`（86–116行目）
- **問題**: `hitTest`/`anchors`/`planeDetection` は本来 AR（`immersive-ar`）セッションの機能だが、`vrSupported` を基準に判定しており、`arSupported` を一切参照していない（`check()` 内でも `arSupported` はこの関数に渡されていない）。VR専用でARに非対応な端末があれば誤った値になる。
- **なぜ未修正か**: `deviceCompat.check()` の戻り値のうち、VRApp が実際に読むのは `deviceTier`（`targetFPS()` 経由）だけ。`hitTest`/`anchors`/`planeDetection`/`eyeTracking` はどこからも参照されていない（`grep` で確認済み）。つまり不正確ではあるが実害ゼロの死んだ計算値。
- **対応するなら**: `check()` 内で `this._probeOptionalFeatures(xr, vrSupported, deviceTier, arSupported)` のように `arSupported` を渡し、AR系フラグは `arSupported` を基準に判定するよう修正。ただし前述の通り消費者が存在しないため、優先度は低い。

### B-2. `curvedGeometry.js` の頂点インデックスバッファがオーバーフローしうる（優先度: 低、難易度: 低）
- **場所**: `src/vr/browser/curvedGeometry.js` の `curvedPlaneData()`（57行目: `new Uint16Array(sx * sy * 6)`）
- **問題**: `Uint16Array` は 65,535 が上限。`cols * rows`（= `(segmentsX+1) * (segmentsY+1)`）がこれを超えると、頂点インデックスが暗黙にラップして破損したジオメトリになる（エラーは出ない）。
- **なぜ未修正か**: 唯一の呼び出し元 `src/vr/browser/WebPanel.js:549-554` は `segmentsX: 24, segmentsY: 1` を固定値で渡しており、頂点数は50。65,536に到達する余地が現状ゼロ。
- **対応するなら**: `cols * rows > 65536` の場合は `Uint32Array` にフォールバックする（`geo.setIndex` は Uint32BufferAttribute も受け付ける）。ただし今日的には到達不能なので優先度は低い。

### B-3. `TextureManager` 経由ではない `ProgressiveLoader.getAdaptiveUrl()` の非冪等性（優先度: 低、難易度: 中）
- **場所**: `src/utils/ProgressiveLoader.js` の `loadResource()`（216–259行目付近）と `getAdaptiveUrl()`（452–470行目付近）
- **問題**: `getAdaptiveUrl()` は拡張子の直前に品質サフィックスを挿入する（例: `photo.jpg` → `photo_high.jpg`）が、冪等ではない。`loadResource()` の再試行パスは自分自身を再帰呼び出しするため、リトライのたびに `item.url`（既に加工済み）に対して再度 `getAdaptiveUrl()` が適用され、`photo_high.jpg` → `photo_high_high.jpg` のようにサフィックスが累積し、ほぼ確実に404になる。
- **なぜ未修正か**: `strategy.adaptiveQuality` はデフォルト `true` だが、現行コードで `addResource`/`loadResource` を実際に呼んでいるのは `VRApp.loadAudioAssets()` のみで、これは `.mp3` しか読み込まない。`getAdaptiveUrl()` の対象拡張子は `/\.(jpg|jpeg|png|webp|mp4|webm)$/i` なので `.mp3` にはマッチせず、このバグ自体は現状どこからも到達しない。
- **対応するなら**: 加工済みURLかどうかを判定する（例えば正規表現でサフィックス済みかチェックする）か、リトライ時は「オリジナルURL」を別フィールドで保持し、毎回オリジナルから再導出する設計に直す。画像/動画を実際にロードする呼び出し元が将来追加されたときに顕在化するバグなので、その時点で一緒に直すのが自然。

### B-4. `TabManager` のタブストリップのホバー色がdispose時にリセットされない（優先度: 極低、難易度: 低）
- **場所**: `src/vr/browser/TabManager.js` の `stripMesh` のホバーハンドラ（73–79行目）と `dispose()`（324行目以降）
- **問題**（Session 25 で指摘、未修正のまま）: `dispose()` は `unregisterInteractable(stripMesh)` を呼ぶが、ホバー中に破棄されると、次フレームの `updateHover()` が「以前ホバーしていたオブジェクト」の `onHoverEnd` を呼び、既に破棄済みの `material.color.set(...)` を実行する。
- **なぜ優先度が低いか**: 自分で追跡・検証済み。`THREE.Material.dispose()` は `.color`（Colorインスタンス）自体をnullにしない — GPUリソース解放をレンダラーに通知するだけなので、破棄後に `.color.set()` を呼んでも例外は出ず、単に無駄な代入が発生するだけ。実害（クラッシュや誤表示）は無い。
- **対応するなら**: `dispose()`内で `controller.userData.hovered` からこの `stripMesh` への参照も明示的にクリアするか、`onHoverEnd` ハンドラ内で `this.stripMesh` の生存確認を厳密にする。優先度が低いため急ぎ対応不要。

---

## C. ロードマップ Phase 3（未着手・大規模リファクタ）

### C-1. AccessibilityCoordinator への切り出し（優先度: 中、難易度: 高）— **完了（Session 44, 45, 47）**
- **対象**: `src/vr/VRApp.js`（3,100行超）に散在する `captionSystem`/`hapticFeedback`/`gazeInteraction` を専用クラス `src/vr/accessibility/AccessibilityCoordinator.js` に集約する。
- **理由**: VRApp が肥大化しており、アクセシビリティ設定のテスト・保守が困難。CLAUDE.md 冒頭の "Critical Gaps #4" として記録済み。
- **完了内容**: `captionSystem`（Session 44）、`hapticFeedback`（Session 45）、`gazeInteraction`（Session 47）の3系統すべてを `AccessibilityCoordinator` に移動。VRApp側は各々に `get`/`set` を追加し、`this.a11y.X` に委譲。既存の全呼び出し箇所（構築・設定パネルの `apply` クロージャ・毎フレームの gaze-dwell ポーリング・dispose・`notifyCrossModal`/`fireTeleportFeedback` 等の呼び出し、合計40箇所以上）は一切変更不要——`tests/vr-app-wiring.test.js` の既存テストも無変更のまま通過することを確認済み。3系統とも「field-decl null → 構築 →（hapticFeedbackのみ）dispose時null再代入」という同一の形をしており、同じ getter/setter パターンがそのまま適用できた。挙動を変えない安全なリファクタであることを検証済み（フルスイート953件、無変更で通過）。
- **スコープ外と判断したもの**: `highContrast`/`motionSensitivity`/`windowDistance` の同期ロジックは ComfortSystem/WindowManager 向けであり、この4系統（caption/haptic/gaze + 元々のhigh-contrast同期）のうち前者3つのみを対象とした。`highContrast` トグルの複合クロージャ（VRApp.js ~1177行）は `captionSystem.setHighContrast()`/`gazeInteraction.setHighContrast()` を呼ぶが、これらは対象オブジェクトのメソッド呼び出しであり `this.captionSystem`/`this.gazeInteraction` 自体の再代入ではないため、getter経由で問題なく動作する。

### C-2. 設定パネルのグルーピング（優先度: 低、難易度: 中）
- **対象**: `src/vr/VRApp.js` の `createSettingsPanel()` 付近。20以上の設定項目が単一の2カラムレイアウトに未分類で並んでいる。
- **理由**: UX上の発見性の問題（CLAUDE.md "Medium-Priority Gaps #5"）。ロコモーション/アクセシビリティ/レンダリング/オプション機能ごとに折りたたみセクション化し、各ボタンにヘルプテキスト（キャプション経由）を追加する。

### C-3. Top Sites の視覚的スピードダイヤルタイル（優先度: 低、難易度: 中、Session 17 から保留）
- **対象**: `src/vr/browser/BookmarkPanel.js`
- **理由**: Session 16/17 でフレセンシーランキング機能自体（データ層・音声コマンド）は実装済みだが、視覚的な「よく使うサイト」タイル表示は未実装のまま。
- **保留理由**: BookmarkPanel に3つ目のタブを追加するとスクロール矢印ゾーンと座標が衝突する。canvas描画のためVRヘッドセットなしでは見た目を目視確認できない制約もある。着手する場合はレイアウト設計からやり直す必要がある。

### C-4. `MixedReality`（AR/パススルー）が完全に未配線（優先度: 中、難易度: 高、Session 49 で発見）
- **対象**: `src/vr/ar/MixedReality.js`（963行）、`src/vr/VRApp.js`（`initializeSystems()` の `checkSupport()` 呼び出しのみ）
- **現状**: `VRApp` は `new MixedReality(...)` を構築し `checkSupport()` を呼ぶだけ。`enabled` フラグは `startSession()` の中でのみ `true` になるが、`startSession()` を呼ぶコード（設定パネルボタン・音声コマンド・メニュー等）がリポジトリ内に一つも存在しない。平面/メッシュ検出・ヒットテスト設置・IndexedDB永続化アンカーなど、docstring に書かれた機能一式が実行時には完全に不動作 — Session 39 で削除した `AvatarSystem`（完全に重複した未配線コード）と同型だが、こちらは重複ではなく本当に唯一のAR実装なので削除ではなく配線が必要。
- **保留理由**: (1) 実機（Quest 3等のARパススルー対応ヘッドセット）がないと動作検証不能。(2) WebXRの `immersive-vr` セッションが既に張られている状態で `immersive-ar` セッションをどう共存/切り替えするかという設計判断が必要（同時に2セッションは張れない仕様のため、既存VRセッションの終了 or 専用の入場フローが要る）。(3) 新規UI導入（設定パネル or 専用ボタン）+ 入力配線のセットが必要で、一発修正では終わらない規模。着手する場合はPlanエージェントで事前設計してから。

### C-5. `enableWebPanel` が到達不能だった（優先度: 高、Session 51 で発見・部分修正）
- **対象**: `src/vr/VRApp.js`（`settings.enableWebPanel` の既定値および参照箇所: 229, 546, 1318, 1509, 2476行目付近）
- **発見の経緯**: マルチエージェントの並行監査ワークフローが「BookmarkPanel の scrollOffset 未クランプ」「LayersSystem の XRQuadLayer リーク」「WindowManager の grab 競合」という3件の候補バグを個別に「到達可能」と判定したが、うち1件（WindowManager 競合）を担当した検証エージェントが独自に `enableWebPanel` の既定値・構築経路を追跡した結果、**この設定が day 1 から `false` 固定で、設定パネル・音声コマンド・永続化設定のどの経路からも real user が `true` にする手段が一切存在しない**ことを発見。直接確認した結果、`tabManager`/`webPanel`/`bookmarkPanel`/`windowManager` の構築（546–668行目）および `_attachLayersToPanels()`（2476行目）は全て同じ `if (this.settings.enableWebPanel)` にゲートされており、`docs/SPEC.md` が FR-1.2〜FR-1.7（URL バー・タブ・ブックマーク・Layers・ウィンドウ管理・湾曲パネル）を軒並み「✅ 実装済み」と記載しているにもかかわらず、**25セッション分（Session 25前後〜48）の機能追加・改修が実際のアプリでは一度も real user に到達したことがない**という結論に至った。この事実確認により、上記3件の候補バグのうち BookmarkPanel と LayersSystem の2件は「機能自体は本物のバグだが、現状は enableWebPanel が false のため到達不能」であり、WindowManager 競合の1件は明確に到達不能と判定された。
- **今回の対応（部分修正）**: 設定パネルに `enableWebPanel` のトグルボタンを追加（`vr.settings.webPanel` / 新規メソッド `_onWebPanelToggleChanged()`）。これは他の全トグルと違い、対象サブシステムの構築が `initializeSystems()`（constructor から一度だけ実行）に一度きりなので、トグルしても即座には反映されない — トグル時に `vr.msg.webPanelReloadRequired`（"Reload the page to apply this setting" / ja: "この設定を反映するにはページを再読み込みしてください"）を `showVRToast` で表示し、正直に次回リロードが必要である旨を伝える設計とした。**既定値そのもの（`false`）は意図的に変更していない** — 何が real な VR 体験のデフォルトになるかはプロダクト判断であり、単なるバグ修正の範疇を超えると判断したため、まずは「有効化する手段が皆無」という到達不能性そのものだけを解消した。ユーザーが既定値を `true` に変更してよいと明示的に指示すれば次のセッションで一行変更できる。
- **検証済みだった残課題2件 — 両方 Session 52 で修正完了**（`enableWebPanel: true` にして初めて到達可能になるが、トグルで到達可能になったため対応した）:
  - ~~**BookmarkPanel の scrollOffset 未クランプ**~~ — **完了（Session 52）**。共有ヘルパー `_clampScroll(rowCount)` を追加し、`_draw()`・`_onSelect()`（ヒットテスト前）・`deleteRow` ケースの3経路すべてがこれを通すようにした。チロームバー☆ボタン等パネル外経路でブックマークが減っても、描画・クリック双方でスタックした offset がクランプされ、空白ページ＋全クリック死亡が起きなくなった。3テスト（`tests/bookmark-panel.test.js`、うち2件 pre-fix で fail 確認）。
  - ~~**LayersSystem の XRQuadLayer リーク**~~ — **完了（Session 52）**。`WebPanel.enableLayerMode()` に layer id と detach コールバックを渡すよう拡張し、`disableLayerMode(releaseLayer=true)`（タブ close→dispose 経路）が `VRApp._detachPanelLayer(id)` 経由で `LayersSystem.removeLayer(id, session, baseLayer)` を呼んでネイティブ層をレンダーステートから外すようにした。session-end のバルクテアダウンは `disableLayerMode(false)` を渡す（`dispose()` が層スタックごと破棄するうえ、終了中セッションへの `updateRenderState()` は throw するため）。WebPanel は XRSession を知らないまま（session/baseLayer 解決は VRApp 側）。8テスト（`tests/webpanel-states.test.js` 5件・`tests/vr-app-wiring.test.js` 2件・pre-fix で fail 確認、`removeLayer` 単体は既に `tests/layers-system.test.js` でカバー済み）。
  - どちらも file/line/再現条件/修正方針まで検証済み（本ドキュメント冒頭の監査ワークフロー journal に詳細記録）。次セッションで `enableWebPanel` の既定値方針が固まった後、まとめて着手するのが効率的。

---

## D. 研究由来の改善候補（Session 46 の Web 調査）

最新論文・プラットフォーム動向を調査（W3C XAUR、VR酔い軽減研究 2025、WebXR 2026 動向、VRテキスト入力、VRキャプション研究）。**実装済み機能の多くは研究と整合**しており（例: `FFRSystem` の head-motion ベース適応FFRは arXiv:2502.03419 と同方向、ヘッドロック字幕は arXiv:2210.15072 の82.5%支持と一致）、大きな欠陥は無かった。Session 46 で 2件を実装済み（適応型ビネット、字幕高さ調整）。以下は調査で挙がったが**今回実装しない**候補と根拠。

### D-1. キャプションの lag（遅延追従）オプション（優先度: 低）
- Live Captions in VR (arXiv:2210.15072) は head-locked / lag / appear の3挙動を比較。ただし82.5%が単純なヘッドロック支持であり、現行のヘッドロック実装で研究上の最適解を満たしている。lag はごく一部のユーザー向けの微調整に留まるため優先度低。

### D-2. WebXR-WebGPU Binding 対応（優先度: 中、難易度: 高）
- WebGPU が 2026-01 に全ブラウザ Baseline 化、WebXR-WebGPU Binding が Editor's Draft（2026-06）。Three.js の WebGPURenderer 経由で native-class 性能が得られる。`src/vr/rendering/WebGPURenderer.js` は実験的スタブのまま。レンダリングパイプライン全体に関わる大規模変更のため、Plan エージェントでの事前設計が必須。出典: https://vr.org/articles/webgpu-baseline-2026-three-js-webxr-default

### D-3. Quest Browser 40.4 の Depth API ヒットテスト（優先度: 低、難易度: 中、実機必須）
- Horizon Browser 40.4 で WebXR Hit Testing が Depth API ベースになり、MR での instant placement が可能に。`src/vr/ar/MixedReality.js` に関連。ただし Quest 3/3S 実機がないと検証不能。出典: https://www.uploadvr.com/quest-browser-depth-api-webxr-hit-testing-instant-placement/

### D-4. キーボード候補表示UI — **完了（Session 48）**
- 視線タイピングは 8–10 WPM が限界（Text Entry for XR Trove, arXiv:2503.11357）。予測入力・候補提示で補うのが定石。既存の `BookmarkStore.search()`（frecency ランキング、Session 18 実装済み）を流用。
- **実装内容**: `VRJapaneseKeyboard` に `suggestionProvider` オプションと `showSuggestions()`/`_clearSuggestions()`/`_updateSuggestions()` を追加。2文字以上の入力で毎キーストローク候補を最大4件表示（漢字変換候補行と同じストリップゾーンを共有・相互排他）。候補選択で URL を直接確定（キーボードを閉じてナビゲート）。ホバーで**フルURL**をキャプション読み上げ（WCAG 1.3.3）。provider 例外はタイピングを壊さない。`compositionBuffer` は生のローマ字のまま保持されるため ASCII URL のマッチングに問題なし（変換は表示用の戻り値のみ）。VRApp 側は `suggestionProvider: (q) => this.bookmarks.search(q, 4, Date.now())` の1行配線。15テスト（全て pre-fix で fail 確認済み）。

### D-5. rest frame 研究（実装不要・確認済み）
- A Rest Frame Design to Mitigate Cybersickness (arXiv:2502.15227) は周辺視野に静止フレームを置く手法。本アプリの `enableHomeEnvironment`（床+グリッド+スカイ、既定ON）が事実上の静的 rest frame として機能しており、研究知見を既に満たしている。追加実装不要。

---

## E. 長所短所改善案スナップショット（Session 57 時点）

56セッションの改善で検証済みバグは枯渇。直近4イテレーション（Session 53-56）は「実装済みだが未配線の機能の表面化」（Sound Volume / Haptics / Clear History）に移行した。以下は現時点の正直な棚卸し。実行時のモデル使い分けは `docs/INSTRUCTIONS_OPUS.md` / `docs/INSTRUCTIONS_SONNET.md` を参照。

### 長所（維持すべきもの）
- **検証規律**: 1020テスト/46スイート・lint 0エラー（84件の既存 no-console warning は不変）・build green。新テストは pre-fix で fail 確認済み（`git stash` 方式）。
- **クロスモーダル a11y**: 全ユーザー可視イベントが caption + haptic + toast + semantic DOM を通る（`showVRToast` / `notifyCrossModal`）。
- **i18n**: 全 UI 文字列が en+ja（`src/i18n/i18n.js`、`t()` 経由）。
- **日本語入力の実運用品質**: ん先読み・NFC・サロゲートペア・IDN 対応済み。
- **公開準備完了のソース**: main（tested・release-ready・サブパス対応ビルド）。オーナー手順は `docs/PUBLISHING.md`。

### 短所（未解決）
- **`enableWebPanel` 既定 false**: 中核ブラウジング機能群（WebPanel/TabManager/BookmarkPanel/WindowManager/Layers）が休眠。既定値変更はプロダクト判断（C-5、ユーザー名指し待ち）。
- **設定パネルの飽和**: Session 54-56 で項目が増え、フラット2カラムは発見性の限界（C-2、優先度を「低」→「高」に昇格）。
- **VRApp モノリス（~3300行）**: 分割は AccessibilityCoordinator パターンで継続可能だが未完。
- **視覚/E2E テスト不在**: canvas UI は headless で目視検証不能。Playwright 未導入（この実行環境は Chromium プリインストール済みで導入可能）。
- **効果音アセット欠落**: `assets/sounds/*.mp3` はリポジトリに存在せず graceful 404（音声は無効に degrade）。
- **docs/archive の肥大**: 117ファイル。陳腐化した主張を含むが A-1 凍結の一部として改変禁止。
- **凍結事項**: A-1（死コード削除）・A-2（未使用 devDependencies 削除）はユーザーの明示的名指し待ち。main 上の `cd.yml`/`release.yml` は壊れているが本セッション権限（403）では修正不能。

### 改善案（優先度・推奨モデル付き）
| ID | 改善案 | 優先度 | 推奨 | 受け入れ基準 |
|----|--------|--------|------|-------------|
| E-1 | 設定パネルのグルーピング（=C-2） | 高 | Opus | レイアウトを pure 関数化しテスト・全設定到達可能・告知機能維持 |
| E-2 | ~~実ブラウザ検証~~ — **部分完了（Session 68）**: `npm run verify:layout` が実 Chromium で本番の折り返し×実フォントを検証（依存ゼロ）。**残**: ページ全体のスモーク（build→preview→console error 0→Enter VR/SW）は未着手。死んでいた `test:e2e` は削除済み | 中 | Opus | スモーク側は別途 |
| ~~E-3~~ | ~~効果音のプロシージャル生成フォールバック~~ — **完了（Session 58）**: `synthesizeToneSamples` + `SpatialAudio.registerProceduralBuffer` + VRApp で buffer/source を確保。mp3 未コミットで二重に無音だった問題を解消。 | — | — | — |
| ~~E-4~~ | ~~Clear History の音声コマンド化~~ — **完了（Session 59）**: `clear-history` コマンド（ja/en、confirmationText 付き）を追加し `_clearBrowsingHistory()` に配線。go-to より前に登録。 | — | — | — |
| E-5 | README/CHANGELOG の現状同期（陳腐化した主張の修正） | 低 | Sonnet | 実測に基づく数値・リンクのみ |
| E-6 | Top Sites タイル（=C-3） | 低 | Opus | `hitTest` 全ゾーンをテスト・既存2タブ回帰なし |
| E-7 | MixedReality 配線（=C-4） | 中 | Opus | Plan エージェント必須・実機検証不能の制約明記 |

---

## F. First Principles 監査（Session 60）— 中核原子の欠落と過剰の定量

59セッションはすべて「既存コードの監査」という枠内だった。前提を外し「ブラウザとは何のための道具か → 不可欠な原子は何か」から測り直した結果、枠内では見えなかった構造的問題が出た。**すべて grep で直接検証済み。**

### F-1. 原子②「コンテンツ表示」が構造的に存在しない（最重要）
Web ブラウザの既約な能力: ①URL へ移動 → **②内容を表示** → ③読む → ④操作 → ⑤戻る → ⑥保存。この製品は ①③(部分)⑤⑥ を持ち、**②が無い**。③④も②に依存するため不成立。

検証事実:
- `WebPanel.onDomOverlayStart()`（iframe を可視化する唯一の関数）は**呼び出し元ゼロ**
- `dom-overlay` は VR セッションで**一度も要求されていない**。`setupVR()` は `VRButton.createButton()` 任せで sessionInit は `['local-floor','bounded-floor','hand-tracking','layers']` 固定。`dom-overlay` を要求するのは `MixedReality.js:270`（AR パス、それ自体 `startSession()` 呼び出し元ゼロ）のみ
- コンテンツ canvas は `_build()` のローカル変数で再描画不可能だった（Session 60 で `this.contentCanvas` + `_drawContent()` に修正）
- `contentMesh` は `registerInteractable` 未登録 → VR レイが本文内リンクに当たることは原理的にない

**これは実装バグではなく前提の誤り。** WebXR *ウェブアプリ*は cross-origin ページの画素を 3D テクスチャに合成できない（X-Frame-Options / CSP frame-ancestors が大半のサイトの framing を拒否し、framing できても画素は読み出せない）。Wolvic/Quest Browser が可能なのはネイティブエンジンだから。**dom-overlay を配線しても解決しない**（AR 用機能であり、かつ 2D HUD なので 3D パネルには合成できない）。

**帰結**: `enableWebPanel: false` は**正しい既定値**。有効化すると「中身の出ないブラウザの外枠」を露出することになる。これまで「プロダクト判断待ち」としてきたが、Session 60 の発見により「②が実装されるまで false が正しい」と再評価する。

**Session 61 で一次実装完了（CORS 許可オリジン限定）**: iframe を捨て「取得 → 本文抽出 → canvas テキスト描画」を実装（`readableText.js` / `readerLayout.js` / `textWrap.js`、`WebPanel._loadReaderText()` + `'reader'` 状態 + `scrollContent()`）。これで原子②③が CORS 許可オリジンについては成立する。**残る到達範囲の制約**: 非 CORS オリジンにはサーバ側プロキシが不可欠。`server/` は Session 74 で削除したので、取得プロキシは**新規に最小構成で作る**ことになるが、**SSRF 対策（private/loopback IP 拒否、スキーム allowlist、サイズ上限、timeout）を要する新規ネットワーク面**なので独立セッションで設計すること。

**元の分析（参考）**: iframe を捨て、**取得 → 本文抽出 → canvas テキスト描画（リーダー方式）**へ転換。CORS プロキシが必要だが、**現在100%余剰の `server/`（Stripe課金739行）をコンテンツプロキシに転用すれば過剰を不足に転換できる**。描画側は本リポジトリが最も得意とする領域（字幕・ブックマーク・キーボードは全て canvas テキスト）で、抽出とレイアウトは純関数なので headless テスト可能。可読性・ズーム・リフローも自然に解決する。

### F-2. 過剰の定量 — src+server+api の 23.4% が到達不能または非中核
| 領域 | 行数 | 状態 |
|---|---|---|
| `server/`（Stripe課金） | 739 | 決済UI が `src/` に皆無（grep 0ヒット）。`/subscription/:userId` 等に認証ミドルウェア無し。テスト15件 |
| `api/`（重複決済） | 496 | 自称 SUPERSEDED、importer ゼロ |
| `multiplayer/` | 1,384 | 既定 false + UI トグル無し + signaling URL 未設定 → 第2ピアは永久に不可能。テスト56件 |
| `AIRecommendation` | 638 | `getRecommendations()` 呼び出し元ゼロ、全ソース `url:'#'` |
| `WebGPURenderer` | 600 | レンダーループ未接続 |
| `MixedReality` | 963 | 約940行が到達不能 |
| `ObjectPool` | 404 | `src/` 消費者ゼロ、テストのみ |
| `assets/js/`（死コード） | 119,685 | 参照ゼロ（A-1 で凍結中） |

**リポジトリの JS 全体のうち中核ループに奉仕するのは約12%。** ~25セッションが「穴の周りの内装」を磨いていたことになる。

### F-3. Session 60 で修正した信頼性の欠陥（②の判断とは独立に無条件で正しい修正）
- ~~**URL オリジン偽装**~~ — **完了**: `https://www.google.com@evil.com` が「google.com」と表示されていた（`truncate` は先頭保持なので偽装部分を見せ実ホストを隠す）。長い偽装URLで実ドメインが省略消失する問題も同様。新規純モジュール `src/vr/browser/urlDisplay.js` の `parseDisplayUrl`/`elideUrlForDisplay` で**オリジンは絶対に省略しない**方式に変更（省略するのはパス側）。
- ~~**TLS 表示なし**~~ — **完了**: `securityLevel()` + `securityIndicator()`（🔒/⚠/⌂、グリフで意味を担保しWCAG 1.4.1準拠）を chrome bar に追加。`http://` は警告色かつスキームを明示（`https://` は錠前が担うので省略）。
- ~~**ブロックされたフレームの偽成功**~~ — **完了**: X-Frame-Options で拒否されたページは Chromium では `onerror` ではなく `onload` を発火するため、成功として履歴記録され URL バーも正常色だった。`_contentState` を導入し、ロード完了時は正直に「Page content cannot be shown in VR / navigation recorded」と表示。

### F-5. 字幕の全角幅オーバーフロー — **完了（Session 63）**
- **場所**: `src/vr/accessibility/CaptionSystem.js`
- **問題（Session 62 で発見）**: 字幕もコードポイント数で折り返しており（`WRAP_CHARS = 34`）、全角=1em / 半角≈0.5em の差を無視していた。単一行字幕はフォント 44px を使うため **全角34文字 = 1496px、canvas 1024px を46%超過**。日本語字幕だけが panel の外に流れていた。ろう・難聴ユーザーの主チャネルなので情報欠落そのもの。
- **修正（Session 63）**: 予算を **em** で表す `MEASURE_EM = 20` に移行し、`_wrapChars()` を `_measureEm()` に置換。`wrapTextToWidth`/`truncateToWidth`（Session 62 で追加済み）を使用。
  - **循環の解消**: フォントは行数から決まり（`_fontSizeFor`）、安全な折り返し幅はフォントに依存する、という循環があったが、**em はフォント相対なので循環が消える** — 行幅は常に `measure × fontSize` px。さらに「そのスケールで出うる最大フォント（`MAX_FONT × scale`）」に対して em 予算をクランプするので、行数がいくつになっても収まることが保証される（scale 1 で 20em、scale 1.5 で ≈14.8em）。
  - **研究由来の値**: 日本語放送字幕は1行16文字・最大2行（社内規定で13〜20の幅）、Latin 字幕ガイドは37〜42文字。20em が日本語20字／Latin40字を与え、両方の慣行に収まる。`MAX_ROWS_PER_LINE = 2` は既に放送規格どおりだった。
  - 実測: 旧 1496px OVERFLOW(+46%) → 新 880px fits。5テスト追加（うち4件は pre-fix で失敗を確認。Latin のみのケースは元から収まるため両方で通過）。

### F-4. 未着手（次セッション以降の候補、F-1 の判断と独立）
- **プライベートモード**: `VRApp.navigate` が無条件に `addHistory` + `trackVisit`。記録せず閲覧する手段が皆無（事後消去のみ）。真偽値ゲート1つ+設定トグルで実装可能
- **セッション復元**: タブ集合が永続化されない（`TabManager` に serialize/restore 無し）
- **Stop（読み込み中断）**: `loading=true` を解除できるのは onload/onerror のみ
- **新規タブページ**: `BookmarkStore.getTopSites()` は完全実装済みで描画先ゼロ（= C-3）
- **`scroll-down`/`scroll-up` の二重登録**: `VoiceCommands.js:366` と `:605` で同一キーを登録（`Map.set` なので後者が勝つ）。前者は `window.scrollBy` で没入時には無意味。害は無いが混乱の元

---

## G. 色コントラスト監査（Sessions 69, 72）— 実測済み・WCAG 2 は全通過、APCA は未達

`src/vr/ui/contrast.js`（WCAG 2 比 + APCA Lc、`rgba()` のアルファ合成込み）と
`tests/contrast.test.js`（**実パレット 50 ペア × 通常/高コントラストの両モード**を掃引）を追加した。
以後、canvas UI の色は「目視できないから検証不能」ではなく**テストで固定**される。

### G-1. 修正済み（Session 69）

| 面 | 修正前 | 要求 | 修正後 |
|---|---|---|---|
| chrome 戻る/進む 無効グリフ `#44445a` | **1.66:1** | 3:1※ | `#74788f` 3.61:1 |
| chrome アドレスバーのプレースホルダ `#888899` | **3.94:1** | 4.5:1 | `#9aa0b8` 5.30:1 |
| chrome アドレスバーの境界（塗りのみ） | **1.16:1** | 3:1 | `#7d88bd` の枠線 4.67:1 |
| IME モードバッジ カタカナ 白/`#ff8844` | **2.37:1** | 3:1 | 墨字 `#0b0f1a` 8.07:1 |
| IME モードバッジ 漢字 白/`#44cc88` | **2.05:1** | 3:1 | 墨字 `#0b0f1a` 9.33:1 |
| リーダー 無効スクロール矢印 `#445566` | **2.12:1** | 3:1※ | `#727f96` 4.01:1 |
| ブックマーク 無効スクロール矢印 `#445566` | **2.37:1** | 3:1※ | `#727f96` 4.28:1 |
| 設定トグル OFF ラベル（**ホバー時**） | **2.26:1** | 3:1 | `#ccd6e4` 4.49:1 |
| 設定トグル OFF 枠線（**ホバー時**） | **1.43:1** | 3:1 | `#ccd6e4` 4.49:1 |
| chrome バー全体が `prefers-contrast` を無視 | — | — | `webChromeColors(hc)` で配線 |

※ WCAG 2 は 1.4.3 / 1.4.11 とも **inactive component を明示的に免除**しているので、
無効グリフ3件は形式上は違反ではない。それでも直したのは、1.66:1 は「無効だと分かる」ではなく
**「そこにボタンがあることが分からない」**水準だから（VR パネルには tooltip も focus ring も無く、
減光したグリフが唯一の存在証明）。修正後も有効時（10.8:1）の 1/3 程度に留め、無効状態は読み取れる。

### G-2. 未修正（APCA のみ不足・記録のみ）

APCA（WCAG 3 候補）は「WCAG 2 は黒に近い明暗ペアのコントラストを過大評価する」という
既知の問題に対応するもので、**本アプリは全面が暗背景・明文字かつ自発光 HMD** なので該当しやすい。
下表は**修正後**の実測値。WCAG 2 は全て通過しているが、APCA の目安（本文 Lc75 / 大 60 / 特大 45 / 非文字 30）には届かない。

| 面 | WCAG 2 | APCA Lc | APCA 目安 |
|---|---|---|---|
| reader progress ラベル | 4.78:1 | 36.8 | 75 |
| content state detail | 5.44:1 | 41.7 | 75 |
| content state title | 6.67:1 | 50.3 | 60 |
| chrome ロードエラー文言 | 6.08:1 | 49.4 | 75 |
| chrome アドレスバー プレースホルダ | 5.30:1 | 46.7 | 75 |
| bookmark rowUrl | 5.94:1 | 41.2 | 75 |
| bookmark pageIndicator | 4.78:1 | 36.8 | 75 |
| bookmark tabInactive | 5.69:1 | 44.8 | 60 |
| bookmark emptyText | 6.68:1 | 45.9 | 60 |
| reader 矢印 有効 | 4.58:1 | 53.2 | 60 |
| IME 入力欄プレースホルダ | 3.88:1 | 28.6 | 45 |
| 設定トグル OFF 枠線（非ホバー） | 4.06:1 | 29.1 | 30 |

**着手しない理由**: APCA は規範ではない（WCAG 3 は未勧告）。上表を満たすには
暗背景そのものを明るくするか文字を大幅に明るくする必要があり、**欠陥修正ではなく視覚デザインの変更**になる。
`tests/contrast.test.js` は APCA を計算するが assert しない — 数値は上表に固定して「知らなかった」状態を無くす。

### G-3. 同種の未着手（発見済み・本セッションの scope 外）

- ~~**`JapaneseIME.js` は高コントラストモードを一切参照しない**~~ — **Session 72 で修正**。
  `keyboardLayout.js` に `imeColors(highContrast)` を追加し、キー・候補列・サジェスト列・入力欄・
  背面パネルすべてを配線。あわせて**通常モードの 1.4.11 違反2件**を実測して修正（キー枠線 1.65:1、
  非優先候補の枠線 2.74:1 —— どちらも塗り自体がパネルに対し 1.25:1 なので、枠線が唯一の境界だった）。
  さらに**候補ボタンのホバーが色に依存しない手がかりを破壊していた**バグを修正（下記 G-4）。
- **`TabManager` のタブストリップ本体の色**は未抽出（掃引に含まれていない）。同じ手順で閉じられる。

### G-4. 修正済み（Session 72）: 候補ボタンのホバーが WCAG 1.4.1 の手がかりを消していた

`candidateStyle` は先頭候補に **1始まりの順序番号**と**9px の太い枠線**を与える。docstring にも
「primary stands out by border WEIGHT, not hue alone」と明記されており、両方とも
「緑 vs 青」という**色だけに依存しないための手がかり**として意図的に置かれたもの。

ところが候補行は初期描画・`onHover`・`onHoverEnd` の**3つの独立した描画ブロック**を持ち、
**ホバー系2つは順序番号を描かず `lineWidth = 5` を直書き**していた。つまり:

- 候補にポインタを合わせた瞬間、**番号が消え、先頭候補の 9px 枠線が 5px に落ちる**
- `onHoverEnd` も同じく描かないので、**元に戻らない（恒久的に失われる）**
- 残るのは緑と青の色差だけ = **1.4.1 が禁じる「色のみへの依存」そのもの**

**修正**: Session 48 で私が書いたサジェスト行は既に単一の `draw(hover)` を使っていたので、
候補行を同じ形に統一（`draw(false)` / `draw(true)` の2呼び出しのみ）。
テストは**実際に描画された内容**（`fillText` の文字列と `strokeRect` 時の `lineWidth`）を記録して検証する。

---

## H. ターゲット角サイズ監査（Sessions 70–71）— メートルで書かれた寸法は一度も「度」で検証されていなかった

本アプリの全ターゲットは**メートル**で指定されているが、メートル単体では押せるかどうかを何も語らない
（0.035 m の帯は 0.5 m では快適な取っ手、6 m では見えない筋）。決めるのは**眼に張る角度**。
Session 62 は*文字の可読性*についてこれを arcmin で検証したが、**ターゲットについては未検証**だった。
`src/vr/ui/angularSize.js`（純）+ `tests/target-size.test.js`（39件）を追加。

### 採用した閾値（外部由来・詳細は angularSize.js の docstring）

| 閾値 | 出典 | 本リポジトリでの扱い |
|---|---|---|
| **3°** ヒットターゲット | Meta Horizon OS accessibility（22 mm / 48 dp / 「0.42 m で 3° FOV」。48 dp 未満なら**不可視の hitslop** を足せと明記） | **報告のみ**（満たすにはパネル寸法の再設計が必要） |
| **1.5°** オブジェクト最小 / **1.0°** 間隔 / dwell 500 ms | 視線選択研究のまとめ（CasualGaze, arXiv:2408.12710） | **ハード不変条件**（gaze-dwell は本プロジェクトの主入力路） |

### H-1. 修正済み（Session 70）

- 🐛 **移動バー（grab handle）が既定距離で 1.00°** —— 1.5° の視線フロアを下回る唯一のターゲットだった。
  しかも**ブラウザ全体を動かせる唯一のコントロール**なので、コントローラを使えないユーザーには実質到達不能。
  描画されるバーを3倍に太らせるのは視覚的な劣化なので、**Meta 自身が指定する救済策 = hitslop** を適用:
  メッシュを `sizeForAngleM(3, 2.0)` = 0.1047 m にし、バーは透明テクスチャの中央帯にだけ描く。
  **見た目は完全に不変、レイの当たり判定は3倍。**
- 🐛 **タブの ✕ ボタンが隣のタブに 38 px はみ出していた** —— 描画は `tabW - 38` を左上に `height-20`(=76 px) の
  **正方形**、当たり判定は右端 36 px。タブ8枚（tabW ≈ 117 px）では ✕ の赤箱の右半分が隣のタブに乗り、
  **見えている ✕ の右側を狙うと閉じずに隣のタブへ切り替わる**。`tabCloseZonePx()` を1つの真実として
  描画と当たり判定の両方が通るようにした（`tabWidthPx()` も同様に二重定義を解消）。

### H-2. 修正済み（Session 71）: パネル距離設定がすべてのターゲットを壊していた

`WindowManager` が `target.scale` を**一度も触らなかった**ため、パネルの角サイズは距離に反比例していた。
設定ステッパー `vr.settings.panelDist` の範囲は **0.6〜6.0 m（10倍）**。修正前の実測:

| 距離 | chrome ボタン | 移動バー | タブ本体 | ブックマーク行 | 判定 |
|---|---|---|---|---|---|
| 0.6 m（最小） | 10.1° × 7.6° | 43.6° × 3.3° | 12.0° × 6.7° | 86.3° × 8.0° | **パネル幅が 106°**（快適な中心視野 ~60° の倍） |
| **2.0 m（既定）** | 3.0° × 2.3° | 13.7° × 3.0° | 3.6° × 2.0° | 31.4° × 2.4° | 1.5° は全通過 |
| **6.0 m（最大）** | 1.0° × 0.76° | 4.6° × 1.0° | 1.2° × 0.67° | 10.7° × 0.81° | **全ターゲットが 1.5° 未満 = 視線では操作不能** |

**修正**: `WindowManager._applyAngularScale()` —— 管理対象を `distance / PANEL_DISTANCE_DEFAULT` で
スケールし、**角サイズを距離に対して一定**に保つ。既定 2.0 m では scale がちょうど 1.0 なので
**出荷時の挙動は完全に不変**（`enableWindowFollow` は既定 false で `update()` すら呼ばれない）。
グラブ中は**カメラ**からの距離で測る（角度が張るのは眼であって手ではない）。

**設計根拠**: 距離を変える正当な理由は**輻輳・調節の眼の快適さ**（Session 62 の調査: 0.5 m 未満/20 m 超を避ける、
近視者は 2.5 m が快適）であって見かけの大きさではない。角サイズを保ったまま奥行きだけ変わるのが本来の挙動で、
これにより「ステッパーがユーザーの望むものを制御し、可読性とターゲットサイズは検証済みの値を保つ」が両立する。

#### 前提として解いた依存（それ自体が2つの実バグ）

1. 🐛 **タブストリップがパネルを追随しなかった** —— `TabManager.stripGroup` はパネルの**兄弟**で固定座標
   `this.position` に置かれ、`windowManager` は**アクティブパネルの group だけ**を管理していた。
   grab-to-move や follow でパネルを動かすと**ストリップだけ元の位置に取り残される**。
2. 🐛 **タブ切替で grab-to-move の配置が消えていた** —— `setActive()` が `panel.show(this.position)` を呼び、
   `show()` は transform を**ハードセット**する。つまりパネルを動かしてからタブを切り替えると、
   新しいアクティブタブは**元の固定位置に出る**（移動が黙って破棄される）。

**両方を1つの管理対象で解消**: `TabManager.rootGroup` を導入し、ストリップと全パネルをその子に。
`windowManager` は `rootGroup` を1度 attach するだけになり（アクティブタブごとの再 attach が不要になった）、
切替は `panel.setVisible()`（transform に触らない新メソッド）を使う。

### H-3. 免除・非修正の判断（正直に）

- **タブの ✕ 当たり判定は 1.61° × 2.00°（2 m）で 3° 未満**だが**広げない**。破壊的操作（閉じる）が
  非破壊的操作（切り替え）に隣接している場合、破壊側を広げると誤爆が増える。Fitts 則的にも
  「小さい破壊的ターゲット」は意図的な設計。1.5° フロアは満たしている。
- **chrome ボタン（3.0°×2.3°）・リーダー矢印（4.3°×2.0°)・ブックマーク行（31.4°×2.4°）は 2 m で 3° 未満**。
  高さはパネル/バーの寸法で決まるので、3° に上げるには chrome バーを高くしてコンテンツ領域を削る必要があり、
  レイアウト再設計。1.5° フロアは全通過で、H-2 の角サイズ一定化により**どの距離でもこの値が保たれる**。
- **キーボードは全ターゲット快適**（キー 4.18°、漢字候補 6.07°×4.72°、URL サジェスト 14.8°×4.72°）。
  近い位置（0.849 m）に置かれているため。変更不要。
- **設定パネルも快適**（コンパクトトグル 10.1°×4.0°、ステッパーの ∓ ゾーン 5.3°×4.0°）。変更不要。

---

## I. 縦方向レイアウト監査（Session 73）— 行の高さと下端の重なりは一度も検証されていなかった

Sessions 62〜68 は**横幅**を、70〜71 は**ターゲットの角サイズ**を測った。**縦**（行送り・下端の重なり）は未検証だった。
実 Chromium で本物のフォント垂直メトリクスを実測して確認した。

### 実測値（DejaVu Sans + CJK fallback、`actualBoundingBox` / `fontBoundingBox`）

| 面 | px | Latin ink (em) | fontBox (em) | CJK ink (em) |
|---|---|---|---|---|
| reader title | 30 | 0.933 | 1.10 | 1.033 |
| reader heading | 25 | 0.960 | 1.12 | 1.040 |
| reader body | 20 | 0.950 | 1.10 | 1.050 |
| caption max | 44 | 0.932 | 1.114 | 1.023 |
| caption min | 22 | 0.955 | 1.136 | 1.045 |

### I-1. 修正済み（Session 73）: 本文の最終行がページ送りボタンの下に潜り込んでいた

`visibleLineCount` は**コンテンツ領域の全高**を使って表示行数を決めていたが、その領域の下端には
**▲▼ 矢印（y 854〜926、x 804〜1008）と進捗ラベル（baseline y 912）**が描かれる。実測:

| scale | 表示行数 | 最終行 baseline | 最終行の ink | 矢印帯の開始 | 判定 |
|---|---|---|---|---|---|
| 1.0 | 24 | 864 | 845〜868 | 854 | **重なる** |
| 1.3 | 19 | 888 | 863〜894 | 854 | **重なる（進捗ラベルとも）** |
| 1.5 | 16 | 864 | 836〜871 | 854 | **重なる** |
| 2.0 | 12 | 864 | 826〜873 | 854 | **重なる** |

テキスト段は x 48〜976、矢印は x 804 から —— つまり**最終行が長いと文字がボタンの下を通る**。
しかも**低視力ユーザー向けのテキスト拡大が状況を悪化させる**（1.3 では進捗ラベルにも衝突）。

**修正**: `CONTENT_BOTTOM_RESERVED`（96px）を導入し `visibleLineCount(scale, reserveBottom)` に反映。
矢印は「溢れているときだけ」描かれるので**予約するかどうかが行数に依存する循環**があるが、
`visibleLinesFor(total, scale)` が2段階で解決する（未予約数で収まるなら矢印は出ないのでそれが答え、
収まらないなら予約は縮めるだけなのでスクロール可能性は変わらない —— Session 63 の字幕の
フォント/measure 循環と同じ解き方）。**3箇所の呼び出し元（描画・ヒットテスト・scrollContent）を
すべてこの1関数に通した** —— 描画とヒットテストの不一致は Session 52 で空白ページを生んだ失敗モード。

### I-2. 未修正（記録のみ）: 見出しの行送りが 1.5 未満

`LINE_H = 34` は固定で、フォントは title 30 / h 25 / p 20。行送り比は **1.13 / 1.36 / 1.70**。
WCAG 1.4.12 Text Spacing が基準に使う **1.5** を本文は満たすが、**title と heading は下回る**。

- **形式上の違反ではない**: 1.4.12 は「ユーザーが行送りを 1.5 に上書きしても壊れないこと」を求めるもので、
  canvas には上書き機構が無い。実測でも fontBox 33px < pitch 34px なので**文字同士は重ならない**。
- ただし 1.5 という値はディスレクシア・低視力の読者に効くという根拠で選ばれたもので、
  **日本語タイトルは折り返して複数行になる**（`measureEmForStyle` で clamp 済み）ため、
  2行タイトルの行間が 1px しかないのは実用上窮屈。
- **本セッションで直さない理由**: スタイルごとの行送りにすると行が可変高になり、
  `visibleLineCount`/`readerWindow`/`clampReaderScroll`/`pageJumpLines` が
  「行数」ベースから「積算ピクセル」ベースへ変わる。I-1 と混ぜると検証が濁るので分離。
  LINE_H を一律 45px（title×1.5）に上げる案は本文が 2.25 になり表示行数が 24→19 に落ちるので不採用。

### I-3. 検証済み・問題なし: 字幕の行送り

`captionFontSizeFor` は `max(22, min(44×scale, floor(rowH×0.62)))`。`floor(rowH×0.62)` が効く間は
行送り比 ≈ **1.61** で 1.5 を満たす。下限 22px が効き始めるのは `rowH < 35.5` = **6行以上**だが、
`maxLines = 3` × `MAX_ROWS_PER_LINE = 2` で**最大6行**、そのとき rowH 34.67 / font 22 = **1.576** で
ぎりぎり満たす。`scale` は `min` の内側なので行を重ねる方向には効かない。**変更不要**。
（ただし `maxLines` を 4 以上に上げると 7 行以上になり比が 1.35 まで落ちるので、変更時は要再検証。）

---

## J. 設定パネルのグルーピング（Session 74、step 3「簡素化」）

### J-0. 完了: フラットな 19 行スタックをアコーディオンに

Sessions 46/54/55/56 が1つずつコントロールを足し続けた結果、設定パネルは **24 コントロール / 19 行 /
3.56 m** になっていた。配置は 2.44 m なので **垂直に 72.2°** —— 頭を動かさずに見渡せる **~30〜40°** の
約2倍で、下半分は常に視界の外。レイアウト計算が `VRApp.createSettingsPanel()` にインラインで
埋まっていたため**誰も import できず、コストが一度も測られなかった**（Sessions 68/69/70 と同じ構図）。

- 新規純モジュール `src/vr/ui/settingsLayout.js`（`layoutSettingsPanel`/`worstCaseHeight`）
- セクション: アクセシビリティ / 移動と快適性 / 表示 / ブラウジング / 音声とメディア（+ 取りこぼし用 その他）
- ヘッダは interactable。開閉状態は **▾ / ▸ のグリフ**でも示すので色のみに依存しない（1.4.1）。
  開閉は既存のキャプション経路で告知（4.1.3）。状態は `openSettingsSections` に永続化。

### J-1. 途中で見つけて直した設計ミス（テストが捕捉）

**グルーピングだけでは改善にならなかった。** 全セクションを開けると **5.00 m / 91.4°** となり、
**置き換えたはずのフラットスタック（3.56 m）より悪化**する —— ヘッダの行が全コントロールに*上乗せ*されるため。
自分で書いたテストがこれを落として発覚した。

**アコーディオン（同時に開けるのは1セクションのみ）**で解決。最悪ケースが
`セクション数 + 最大セクション` に**有界**になり、25個目のコントロールを足しても
パネルは自分のセクション分しか伸びない。実測 **2.30 m / 50.4°（フラット比 −35%）**。

### J-2. 未解決（正直に記録）

**開いた状態の 50.4° は依然として ~40° の快適視野を超える。** 完全に収めるには
**スクロール可能なパネル**か**行高の縮小**が必要で、どちらも別の変更。
`tests/settings-layout.test.js` の `HONEST LIMIT` テストがこの値を明示的に固定しているので、
「収まっている」と誤認されることはない。

### J-3. 実測: 一般 Web は CORS 的に到達不能（`enableWebPanel` 既定 false の再確認）

`enableWebPanel` を true にすべきか判断するため、実サイトが HTML ドキュメントに
`Access-Control-Allow-Origin` を返すかを実測した:

| URL | ACAO |
|---|---|
| `en.wikipedia.org/wiki/WebXR` | なし |
| `developer.mozilla.org/...` | なし |
| `example.com` | なし |
| `www.nhk.or.jp` | なし |

**4/4 で無し。** つまり今 `enableWebPanel` を既定 true にすると、ほぼ全ての遷移で
「Page content cannot be shown in VR」を出すブラウザを出荷することになる。**既定 false のままが正しい。**
これを変えられるのは F-1 の取得プロキシ（SSRF 対策必須）だけだが、**既定の配信先が GitHub Pages（静的）**
なので、プロキシは同梱できず「任意・自己ホスト」構成になる。ここは設計判断が必要なので独立セッションに分離。

---

## 使い方（次のセッションへ）

1. **A章**はユーザーの明示的な承認があれば即着手可能。承認の有無を最初に確認すること。
2. **B章**は「バグではあるが今は到達不能」なものなので、単独で1セッション分の作業にはしない方がよい。もし関連する別の作業（例：ProgressiveLoaderを実際に使う新機能を追加するとき）のついでに直すのが自然。
3. **C章**は大規模リファクタなので、Explore/Planエージェントで事前調査してから着手すること。
4. 対応したら、この一覧から削除し、CLAUDE.md の Session Log に通常の形式で記録すること（🐛 fix / 🧹 cleanup / ✨ feat のいずれか、根拠と検証方法込み）。

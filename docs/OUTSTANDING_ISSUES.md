# Qui-Browser: 過不足（excess/deficiency）棚卸しリスト

このドキュメントは、現時点（CLAUDE.md Session 43 時点）で確認済みだが未対応の「過不足」（excess = 動くが無意味なコード／deficiency = 欠落している実装）を一覧化したものです。次のセッション（Opus/Sonnet いずれでも）がこのリストだけを見て単独で判断・着手できるよう、ファイルパス・行・再現条件・判断根拠を明記しています。

各項目には「対応可否」の目安として難易度と優先度を付けています。優先度は「実際にユーザーに影響するか」を基準にしており、コード上の見た目の重大さとは一致しない場合があります。

---

## A. ユーザー承認待ち（このセッションで発見済み、削除系のため未実施）

### A-1. `assets/js/` の削除（優先度: 中、難易度: 低）
- **場所**: `assets/js/`（184ファイル、3.8MB）
- **事実確認**: `src/` の旧・並行実装。現行テストスイート（`tests/*.test.js`、43ファイル）からの参照は **ゼロ**（`grep -rl "assets/js" tests/*.test.js` で確認済み）。参照しているのは `tests/archive/` 内の stale テストのみ。
- **なぜ未実施か**: ディレクトリ一括削除はパーミッションシステムが「ユーザーが個別パスを直接指定していない限り拒否」する設計。過去2回試行してブロックされた。
- **次にやること**: ユーザーが `assets/js/` と `tests/archive/` を明示的に名指しして削除指示を出したら、`git rm -r` で削除し、`npm test`/`lint`/`build` が green のままであることを確認してコミット。

### A-2. 未使用 devDependencies の削除（優先度: 中、難易度: 低）
- **場所**: `package.json` の `devDependencies`
- **対象パッケージ**: `webpack`, `webpack-cli`, `webpack-dev-server`, `webpack-bundle-analyzer`, `clean-webpack-plugin`, `compression-webpack-plugin`, `html-webpack-plugin`, `terser-webpack-plugin`, `babel-loader`, `css-loader`, `style-loader`, `ts-loader`, `typescript`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
- **事実確認**: `package.json` の `scripts` に webpack を呼ぶものは無い（ビルドは `vite build` のみ）。`webpack.config.js` は既に存在しない。`.ts`/`.tsx` ファイルはゼロ。`.eslintrc.json` は `@typescript-eslint` をパーサーとして使っていない。→ 完全に未使用と確認済み。
- **副次効果**: `npm audit` で検出される16件の脆弱性（8 moderate, 8 high）の大半はこれら未使用パッケージ経由（`webpack-dev-server`→`sockjs`→`uuid`、`@typescript-eslint`→`minimatch` 等）。削除すれば脆弱性件数が大幅に減る。
- **なぜ未実施か**: 依存関係の削除はプロジェクトの安全方針上ユーザー確認が必要な操作として扱われている。確認質問を送ろうとしたが、ツールのストリームエラーで届かなかった。
- **次にやること**: ユーザーに再確認してから `package.json` から該当行を削除 → `npm install` → `npm run build`/`npm test`/`npm run lint` が green であることを確認 → コミット。

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

**Session 61 で一次実装完了（CORS 許可オリジン限定）**: iframe を捨て「取得 → 本文抽出 → canvas テキスト描画」を実装（`readableText.js` / `readerLayout.js` / `textWrap.js`、`WebPanel._loadReaderText()` + `'reader'` 状態 + `scrollContent()`）。これで原子②③が CORS 許可オリジンについては成立する。**残る到達範囲の制約**: 非 CORS オリジンにはサーバ側プロキシが不可欠。`server/`（Stripe課金739行の余剰）に `/api/proxy` を置けば過剰を中核に転換できるが、**SSRF 対策（private/loopback IP 拒否、スキーム allowlist、サイズ上限、timeout）を要する新規ネットワーク面**なので独立セッションで設計すること。

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

## G. 色コントラスト監査（Session 69）— 実測済み・WCAG 2 は全通過、APCA は未達

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

- **`JapaneseIME.js` は高コントラストモードを一切参照しない**（`prefersHighContrast()` の呼び出しゼロ）。
  キーボード・候補列・入力欄・バッジのすべてが通常モードの色で固定。`webChromeColors` と同じ形で
  `keyboardLayout.js` にパレット関数を足せば同じ手順で閉じられる。バッジ色だけは本セッションで抽出済み。
- **`TabManager` / `CaptionSystem` のトースト色**は掃引に含めたが、タブストリップ本体の色は未抽出。

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

## 使い方（次のセッションへ）

1. **A章**はユーザーの明示的な承認があれば即着手可能。承認の有無を最初に確認すること。
2. **B章**は「バグではあるが今は到達不能」なものなので、単独で1セッション分の作業にはしない方がよい。もし関連する別の作業（例：ProgressiveLoaderを実際に使う新機能を追加するとき）のついでに直すのが自然。
3. **C章**は大規模リファクタなので、Explore/Planエージェントで事前調査してから着手すること。
4. 対応したら、この一覧から削除し、CLAUDE.md の Session Log に通常の形式で記録すること（🐛 fix / 🧹 cleanup / ✨ feat のいずれか、根拠と検証方法込み）。

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
- **今回見送った、but 検証済みで実装準備が整っている残課題**（`enableWebPanel: true` にして初めて到達可能になる）:
  - **BookmarkPanel の scrollOffset 未クランプ**（`src/vr/browser/BookmarkPanel.js:299` 付近）: `scrollOffset` は `_onSelect()` の `'deleteRow'` ケースと `setMode()` でのみリセットされるが、`WebPanel` のチロームバーのスター☆ボタン経由（`WebPanel.js:319-321` → `onToggleBookmark` → `VRApp.js:569-575`）でブックマーク削除された場合はクランプされない。10件以上ブックマークしてスクロールした状態で、別経路でブックマーク数がscrollOffset以下まで減ると、行エリアが空白化し全クリックが `{type:'none'}` になる。
  - **LayersSystem の XRQuadLayer リーク**（`src/vr/browser/WebPanel.js:507` `disableLayerMode()`）: `LayersSystem.removeLayer()` を呼ぶ経路が `TabManager.closeTab()` から一切配線されておらず、Layers 有効セッション中にタブを閉じるたびにネイティブ `XRQuadLayer`（GPU裏付きの2048×164テクスチャ/フレームバッファ）が `session.updateRenderState({layers})` に残り続け、"ghost chrome bar" として永久に合成され続ける。
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

## 使い方（次のセッションへ）

1. **A章**はユーザーの明示的な承認があれば即着手可能。承認の有無を最初に確認すること。
2. **B章**は「バグではあるが今は到達不能」なものなので、単独で1セッション分の作業にはしない方がよい。もし関連する別の作業（例：ProgressiveLoaderを実際に使う新機能を追加するとき）のついでに直すのが自然。
3. **C章**は大規模リファクタなので、Explore/Planエージェントで事前調査してから着手すること。
4. 対応したら、この一覧から削除し、CLAUDE.md の Session Log に通常の形式で記録すること（🐛 fix / 🧹 cleanup / ✨ feat のいずれか、根拠と検証方法込み）。

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

**→ 実施済み（Session 74）**: `proxy/server.js` + `proxy/ssrfGuard.js`（依存ゼロ）。
**→ 設定経路も実装（Session 74 続き10）**: `readerProxyUrl` は設定キーとして存在するのに
**設定パネルにも音声にも設定手段が無かった**（docs/PROXY.md は「setting に設定せよ」と言うだけ）。
Session 74 の削除基準「real user が到達できない」に、追加したプロキシ自体が該当していた。
設定パネル Browsing セクションの「リーダープロキシ」アクション → VR キーボードで入力
（現在値をプリフィル・空で解除）→ `normalizeProxyUrl` で検証（http/https のみ・認証情報拒否・
正規化）→ 永続化 + **開いている全タブへ即時適用**（リロード不要）→ クロスモーダル確認。
**同梱はしない** —— 既定の配信先 GitHub Pages は静的で動かせないので、バンドルすると
「できる」と嘘をつくことになる。動かせば実 Web を読め、動かさなければ従来どおり。詳細は `docs/PROXY.md`。

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
- **Session 51（部分修正）**: 設定パネルに `enableWebPanel` のトグルを追加。ただし対象サブシステムの構築が `initializeSystems()`（constructor から一度だけ実行）に埋まっていたため、**トグルは「リロードが必要」と告げるだけで何もしなかった**。
- **Session 74（完了）**: 「構築は一度きり」は**要件ではなく配置の事故**だったので、124行の構築ブロックを `_buildBrowsingSystems()` に抽出し、対称な `_teardownBrowsingSystems()` を追加。トグルは**その場で**構築/破棄するようになった。
  - **なぜこれが本質的だったか**: VR で「ページを再読み込みしてください」は**ヘッドセットを外せ**という意味。トグルが存在しても、その代償を払う人はいない。つまり既定値が false かどうか以前に、**機能群は実質的に到達不能なままだった**。
  - `_buildBrowsingSystems()` は冪等（二重トグルでパネルが二重生成されない）。`_teardownBrowsingSystems()` は interactable を確実に解放する（S49 のゴーストハンド・S52 の quad layer と同じ失敗モードを避けるため）。
  - i18n は `vr.msg.webPanelReloadRequired` を廃し、実際に起きたことを言う `vr.msg.webPanelOn` / `webPanelOff` に置換。
- **「表示できません」画面を行き止まりから道標に変えた（Session 74）**: 従来のメッセージは
「in-headset rendering is not supported」だけで、①原因（サイトが CORS を返さない）も
②解決策（取得プロキシ）も伝えていなかった。しかもプロキシ実装後は**事実として誤り**でもあった
（プロキシを動かせば描画できる）。現在はプロキシ設定の有無で文言を出し分ける ——
未設定なら「このサイトは CORS ヘッダを返さない → reader proxy を動かせ（docs/PROXY.md）」、
設定済みなら「プロキシが取得できなかった」。実測した列幅予算にも収まることを確認済み。

**既定値は Session 74 で `true` に変更（決着）**: false を正当化していた実測条件は
①リーダー不在（S61 で実装）②行き止まりのエラー画面（#50 で原因+解決策を明示）
③プロキシ到達不能（#45 実装 + #54 で VR 内から設定可）④トグルがリロード必須（#47 で即時適用）
—— と、すべて自分の手で意図的に解消済みだった。ブラウザと名乗る製品の中核ループが
既定で不可視のままでは「完成」に達しない。初回表示は「URL を入力してください」の空タブで
エラーではなく、明示的にオフにしたユーザーの選択は永続値が勝つ。**戻すのは1行**だが、
戻す者は上記4条件のどれが再発したかを言えること（`tests/vr-app-wiring.test.js` がこの既定を固定）。

~~**既定値そのもの（`false`）は依然として意図的に未変更**~~（旧記録・上記で決着）: 実測どおり一般サイトは CORS を返さないため、プロキシ無しでは大半の遷移が「表示できません」になる（J-3）。ただし**トグルがその場で効くようになったので、ユーザーはヘッドセットを外さずに1タップで有効化できる** —— 到達不能性の問題は解消済み。既定値はプロダクト判断としてユーザーの名指し待ち。
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
- **`enableWebPanel` 既定 false**: ただし Session 74 でトグルが**その場で効く**ようになったため、ヘッドセットを外さず1タップで有効化できる。既定値変更のみプロダクト判断（C-5）。
- ~~**設定パネルの飽和**~~ — **Session 74 で解消**（アコーディオン化、J-0/J-1）。
- ~~**VRApp モノリス（~3300行）**~~ — **第一原理スイープ第35–55パスで解消**。ドメイン別モジュールに抽出（settingsStore/homeEnvironment/settingsPanel/settingsButtons/inputRouting/sessionLifecycle/setupStages/systemsLifecycle/browsingSystems/browserActions/vrToast/perfBudget/frameLoop/canvasMesh/urlDisplay）し VRApp は 3,254→710 行の薄い orchestrator に。残りは constructor（状態スキーマ宣言＝不可分）とテスト/公開APIシームの delegate のみ。
- ~~**E2E テスト不在**~~ — **Session 74 で `npm run verify:app` を追加**（実 Chromium で起動、依存ゼロ、J-4）。canvas の目視検証自体は依然不可だが、`verify:layout`/`contrast`/`target-size` が測定で代替。
- **効果音アセット欠落**: `assets/sounds/*.mp3` はリポジトリに存在せず graceful 404（音声は無効に degrade）。
- **docs/archive の肥大**: 117ファイル。陳腐化した主張を含むが A-1 凍結の一部として改変禁止。
- ~~**凍結事項 A-1/A-2**~~ — **Session 74 で削除完了**。workflow の破損は依然 403 で修正不能（K-1、オーナー作業）。

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
自分で書いたテストがこれを落として発覚。同時に1つだけ開く方式で有界化した。

### J-2. 完了（Session 74）: 積み上げヘッダを1行のタブに畳んだ

アコーディオン化しても **12 行 / 2.30 m / 50.4°** で、快適視野 ~40° を依然超えていた。
原因は明快で、**5 行のうち 4 行はセクション名を表示するだけの chrome** —— 1行あたり1ビットの情報しか運んでいない。

**積み上げヘッダ（5行）→ 1行のタブバー**に置換。ナビゲーションの手数は変わらないまま4行が消え、
最悪ケースは **8 行 / 1.58 m / 35.9°** —— **初めて快適視野に収まった**。

| 形 | 行数 | 高さ | 垂直角 |
|---|---|---|---|
| フラットスタック（〜Session 73） | 19 | 3.56 m | 72.2° |
| 全セクション展開（採用せず） | 26 | 5.00 m | 91.4° |
| 積み上げヘッダ + アコーディオン | 12 | 2.30 m | 50.4° |
| **1行タブ + 1セクション（現行）** | **8** | **1.58 m** | **35.9° ✅** |

- タブは選択状態を **● / ○ のグリフ**でも示すので色のみに依存しない（1.4.1）。選択はキャプションで告知（4.1.3）。
- タブ自体のサイズは 5 個で **5.16° × 3.99°** —— Meta の快適ヒットターゲット 3° を上回る（Session 70 の基準）。
- ラベルは `fillText` の maxWidth バックストップ付き（翻訳で伸びてもタブから出ない）。
- 有界性は維持: 最悪ケース = `1（タブ行）+ 最大セクション`。25個目のコントロールを足しても自分のセクション分しか伸びない。

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

## K. オーナー作業が必要（自動化では触れない）

### K-1. 5つの workflow が削除済みの `assets/js/` を参照している（**CI が壊れている**）

Session 74 の削除により、`.github/workflows/` の5ファイルが存在しないパスを参照している。
`deploy.yml` の `find assets/js ...` は **exit 1 で失敗する**（実測）。

**このリポジトリの自動化は `.github/workflows/**` を push できない**（403 `without workflows permission`。
Session 74 で**改めて実際に push を試行して再確認**）ため、オーナーの手による修正が必要。

**適用可能なパッチを同梱した**: `docs/patches/0001-ci-drop-assets-js-steps.patch`
（`origin/main` に対しクリーンに適用でき、適用後 `.github/workflows/` から `assets/js` 参照が
**ゼロになる**ことを worktree で検証済み）。

```bash
git checkout main && git pull
git am docs/patches/0001-ci-drop-assets-js-steps.patch
git push
```

該当ステップはすべて「今は存在しないレガシーコードを検査するもの」なので、修正ではなく**削除**が正しい。

代替として `npm ci && npm test && npm run lint && npm run ci:verify` を回せば、
このリポジトリが実際に検証している内容がすべて走る。

---

## L. i18n の取り残し（Session 74 で修正）

CLAUDE.md は Session 2 で「Phase 1 Complete（i18n 配線済み）」、Session 27 で
「status-message/toast の呼び出し箇所も修正」と記録していた。しかしどちらも
**トースト・設定ラベル**の話で、**パネルに直接描かれる文字列**は対象外だった。

実測（`src/vr/browser/` の文字列リテラル走査）で判明した未翻訳:

| 面 | 文字列 |
|---|---|
| `urlDisplay.contentStateLines` | `Loading…` / `Failed to load` / `Enter a URL to navigate` / 「表示できません」2種 |
| `BookmarkPanel` | タブ `Bookmarks` / `History`、空状態 `No bookmarks yet` / `No history yet` |
| `TabManager` | `New Tab` |

`contentStateLines` は**コンテンツ領域が表示しうる全メッセージ** —— つまり
日本語 IME を看板機能に掲げるブラウザの**主コンテンツ面が丸ごと英語だった**。
WCAG 3.1.1 / 3.1.2 の観点で、Phase 1 が閉じたと記録していたのは誤りだった。

**続き（同セッション）**: 走査を `src/` 全体に広げたところ、さらに **キャプション・音声エラー・
スクリーンリーダのラベル**が未翻訳と判明。とくに `crossModal.voiceErrorNotification` は
**CLAUDE.md 自身が Session 2 で「Voice error messages only English」と Phase 1 の critical gap に
挙げていたもの**で、そのまま残っていた。ほかに `ComfortSystem` の "Teleported" キャプション、
`SemanticDOM` の aria-label 3種、`VRApp` のキャプション7種、`main.js`/`app.js` のエラー画面7種。
合計 **39 キー**を en/ja に追加（トグルの `ON`/`OFF` キャプションを含む —— これは
**全設定トグルの状態を聴覚チャネルに伝える唯一の文言**なので記号ではなくテキスト）。

**収束の確認**: 同じ走査を再実行し、残る3件はいずれも**ユーザーに見えない**ことを個別に確認した ——
`VRControllerInput.getDeviceName` は `console.debug` にしか流れない（ユーザー向けは
`controllerReconnectMessage`）、`VoiceCommands` の `description` は `getCommands()` API 用の
メタデータで読み上げには `_spokenExample` が使われる、`main.js` の `EN` は
**言語トグル自身のラベル**で対象言語を名乗るものなので翻訳しないのが正しい。

🔍 **なぜ見逃され続けたか（別の欠陥）**: `package.json` の lint は `eslint src/**/*.js` で、
**シェルの glob は `src/*.js` にマッチしない**（globstar 無効時）。つまり
`src/app.js` / `src/main.js` / `src/monitoring.js` —— **エントリポイントを含む3ファイルが
一度も lint されていなかった**。実際この修正中に `app.js` へ import を入れ忘れた際、lint は
0 errors を報告した。`eslint src proxy` に変更したところ即座に検出。

**修正**: 14キーを en/ja 両方に追加し3面を配線。あわせて**日本語版が実測の列幅予算に収まることを
テストで固定**した —— 全角は 1 em なので、英語で収まる翻訳が日本語で溢れるのは
Sessions 62〜68 の欠陥ファミリーそのもの。最長でも 828px / 928px。

---

## G. 第一原理スイープ（Devin セッション — 到達不能コード第2波 + 設定の真実化）

Session 74 の「real user が到達できないコードは削除する」規準を、残っていた層 ——
**ビルドに含まれず誰にも読まれないツリー、本番 `dist/` に混入する並行実装、
嘘をついている設定ファイル** —— に適用した。すべて grep / ビルド実測で検証済み。

### 削除（到達経路ゼロ、または死んだ双子）

| 対象 | 削除理由（実測） |
|---|---|
| `docs/archive/`（117ファイル） | E章が「陳腐化した主張を含む」と記録済み。`docs/` 直下・README・コードからのリンクゼロ |
| `docs/patches/` | 同上。どこからも参照されない |
| `examples/` | ランディング・README・コードからリンクゼロ。中身は削除済み `assets/js/` 実装への参照 |
| `mvp/` | `mvp/index.html` は `../assets/`（削除済み）と `../src/` を直読みするだけ — 本番では絶対に動かない素のモジュール参照 |
| `locales/` | `i18next` 用 JSON。i18next は Session 74 で依存削除済み（`src/i18n/i18n.js` が唯一の i18n）。孤児 |
| `wasm/` | `WebAssembly.instantiateStreaming` 呼び出しゼロ。`wasm-build.yml` も実体の無いパイプラインだったので同時削除 |
| `assets/styles/`・`assets/css/` | link/import ゼロ。全 CSS は `index.html` インライン + `src/styles/` |
| `assets/sounds/` | `.gitkeep` のみ。効果音は Session 58 のプロシージャル生成が担う — 空ディレクトリは「mp3 を置くべき」という嘘の約束 |
| ルート `manifest.json`/`service-worker.js`/`offline.html` | vite `publicDir` が同名を dist にコピーして上書きするため**デッド双子**。`src/main.js` が登録するのは `${base}service-worker.js` = `public/` 版 |
| `public/{vr-browser.html,vr-browser.js,vr-video.html,sw.js,pwa.js,js/,css-*,lazy-*,view-transitions-*}` | 削除済み `assets/js/` 実装の parallel app が publicDir 経由で **dist/ に混入していた** |
| `src/utils/ProgressiveLoader.js` + テスト | Session 74 以降 import ゼロだった残存モジュール |
| workflow `benchmark.yml`/`deploy.yml`/`test.yml`/`wasm-build.yml`/`v5.8.0-planning.yml` | 削除済み対象・重複（`test.yml` は ci.yml に包含）・tools/benchmark.js 不在を呼ぶ |
| `tools/benchmark.js`・`check-performance-regression.js` | 参照元スクリプトが無い／削除済み ci ジョブ専用 |

### 修正（嘘をついていた設定）

| 対象 | 実測された不整合 |
|---|---|
| `Dockerfile` | **dist を一度もビルドせずリポジトリ直下を nginx で配信** — `import 'three'` の素の bare specifier はブラウザで解決不能 → 起動しないイメージ。multi-stage build に修正 |
| `docker-compose.yml` | `./:/usr/share/nginx/html` マウントがイメージの dist を**素のソースで上書き**。`nginx-cache`（設定ゼロ・接続なし）も削除 |
| `netlify.toml`/`vercel.json` | `publish="."`/`outputDirectory="."` + "No build required" — 同上の理由で起動不能。`dist` + `npm run build` に修正 |
| `manifest.json` | `/assets/icons/icon-*.png` を参照するが **dist に存在しなかった**（vite は publicDir しかコピーしない）→ `assets/` を `public/assets/` へ移動し PWA アイコンを復活 |
| `index.html` | Multiplayer・AI Recommendations のカードが Session 74 で削除済みの機能を宣伝していた → カード + i18n キー削除 |
| `.env.example` | 44行中ほぼ全てがコードに存在しない変数（VR_*・ENABLE_*・STRIPE_*）→ 実際に読まれる6変数のみに |
| `.github/workflows/ci.yml` | `test-performance` ジョブが削除済み tools を呼ぶ・node 16 は `engines: >=18` と矛盾 → 削除・matrix 修正 |
| ESLint | eslint 9 + `.eslintrc.json` = **`npm run lint` が設定解決で落ちていた** → `eslint.config.js`（flat config）へ移行 |
| `CODEOWNERS` | `/assets/js/`・`/examples/`・`manifest.json` 等の存在しないパス → 実在パスへ |

### 実測された効果（before → after）

| 指標 | before | after |
|---|---|---|
| リポジトリ総 LOC | 176,934 | **60,507（−66%）** |
| テスト | 47 suites / 1,480 | 46 suites / 1,463（ProgressiveLoader 系のみ消滅） |
| ビルド | 5.2s | **2.4s**、dist 28ファイル・icons 全て 200 |
| verify:docs | — | 100% PASS |
| verify:layout / verify:app / verify:vr-boot | — | 全 PASS（vr-boot: 本番 bundle で VRApp・tabManager・settingsPanel・captionSystem の構築を確認） |

### 第2パス（同一セッション・export 走査 + 設定精査）

import グラフを `index.html` エントリから全走査（モジュール単位の到達不能は
**ゼロ**だった）のうえ、export 単位の未使用シンボルをスキャンした結果と、
残存設定ファイルの真実性チェック:

| 対象 | 実測された不整合 |
|---|---|
| `CHROME_CANVAS_H`（panelGeometry.js） | 宣言自身以外の参照ゼロ — 完全な死に定数 → 削除 |
| 14個の export（monitoring.js ×3, captionLayout ×3, crossModal ×2, readerLayout ×3, keyboardLayout, contrast, textWrap） | 内部では使用中だが**ファイル外から誰にも参照されない** → `export` キーワードを除去して API 表面を実態化 |
| `.env.stripe` | 「SUPERSEDED」と自己申告する廃止課金モデルの記録。参照先 `server/stripe-billing.js`・`npm run start:server` ともに不存在 → 削除 |
| `dependabot.yml` | reviewers/assignees がリテラル `"yourusername"`（Dependabot が実在しないユーザーに割当失敗）+ 無効キー `automerge` → 除去 |
| workflow `release.yml` | `npm run benchmark:all` は**スクリプト未存在**でタグ push ごとに必ず失敗する工程 → 削除。`deploy-pages` ジョブは `peaceiris/actions-gh-pages` で**リポジトリ直下（生ソース）を公開**＝旧 deploy.yml と同じバグ、かつ cd.yml の正式 Pages パイプラインと二重デプロイ → ジョブ削除。echo だけの `notify` ジョブも削除 |
| workflow `deploy.yml` | cd.yml の `deploy-github-pages`（build→dist→deploy-pages）と完全重複し、こちらは削除済み `assets/js/` を検査→生ソース公開する壊れた側 → ファイルごと削除（cd.yml が上位集合） |

workflow 変更は `workflow` OAuth スコープ不足で push 不能のため
`workflow-changes.patch`（リポジトリ外の交付物）としてオーナーに手渡し。
適用後の CI 緑化を想定。

### 第3パス（依存・スクリプト・ドキュメントの嘘）

package.json の各 script / devDependency / ドキュメント記載コマンドを
「実在するか・呼ばれるか」で全件検証:

| 対象 | 実測された不整合 |
|---|---|
| `@vitejs/plugin-legacy` + `core-js` (devDeps) | プラグイン呼び出しは vite.config.js で**コメントアウト** — インポートだけ残った死んだ依存 → 依存・import・コメント塊を除去 |
| `optimizeDeps.exclude: ['@tensorflow/tfjs']` | tfjs は依存に存在しない → 無意味な除外設定を削除 |
| scripts `serve` | `preview` と同一コマンドの重複 → 削除 |
| `test:tier` / `test:integration` | 指すテストファイルが存在しない（tier-system は Session 74 で削除済み）→ 削除 |
| `deploy:gh-pages` | `gh-pages` パッケージ未インストールで即失敗 → 削除 |
| `deploy:netlify` / `deploy:vercel` | CLI 未インストール。真の deployer は cd.yml + プラットフォーム連携 → 削除 |
| `ci:lint` / `ci:all` / `ci:test` | ci:lint は常時赤の `format:check` を内包（設計上必ず失敗）、ci:test は test:coverage の別名 → 削除（`ci:verify` のみ残す） |
| docs（README / PROJECT_STATUS / TESTING / SETUP / CONTRIBUTING / RELEASE_CHECKLIST / BUILD_OPTIMIZATION_GUIDE） | `test:e2e`（Playwright 未導入）・`benchmark:*`（tools 削除済み）・`build:analyze`・`lighthouse` など**存在しないコマンドを推奨**していた → 実態に修正 |
| `release.yml`（パッチ側） | `npm run benchmark:all`（スクリプト未存在 → タグリリースが確実に失敗）・生ソースを Pages に出す `deploy-pages` ジョブ・echo のみの `notify` ジョブ → 削除 |

### 残った「戻す」候補
マスクのアルゴリズムに従い10%戻す検討をしたが、**戻す価値があるものは今のところ無い**。
`public/` 内の並行実装は git 履歴に残る。

### 第4パス（public/・tools/・proxy・CDN ヒント・エイリアス）

public/ アセットの全参照走査、tools/・proxy/ の到達性、index.html/nginx の
CDN ヒントを検証:

| 対象 | 判定 |
|---|---|
| `public/assets/icons/icon-152.png` | manifest・index.html・manifest.webmanifest 全てが参照しない孤児 PNG → 削除 |
| `public/assets/images/.gitkeep` | 空ディレクトリのプレースホルダ → 削除 |
| index.html `<link rel="preconnect" href="https://cdnjs.cloudflare.com">` | cdnjs は全コードで未使用 → 削除（jsdelivr は TextureManager が .ktx2 要求時に basis transcoder を遅延取得するため保持） |
| `docker/nginx.conf` CSP `script-src https://cdnjs.cloudflare.com` | 同上の死んだ origin → CSP から除去（攻撃面も縮小） |
| `vite.config.js` `resolve.alias`（@/@vr/@utils） | 3 エイリアスとも全ソース・テストで使用ゼロ → 削除 |
| 同 `css.preprocessorOptions.scss` | 不存在の `src/styles/variables.scss` を `@import` 注入しようとしていた（sass 未導入で不発）→ 削除 |
| `jest.config.js` `moduleNameMapper` `@/` | 未使用かつ向き先が `<rootDir>/`（vite の `/src` と不一致）→ 削除 |
| `tools/`（verify-*.mjs 系・generate-icons・measure-text-metrics） | 全て package.json スクリプト経由で到達可能 → 保持 |
| `proxy/`（nginx + squid）、`docker/`（nginx.conf + supervisord） | docker-compose.yml → Dockerfile → 両 conf の配線は正常 → 保持 |
| `docs/RESEARCH.md` | docs/SPEC.md からリンク済みの実用資料 → 保持 |
| `index.html` ID 群・`.env.example`（6変数）・`QUICKSTART.md` | 全て実態と一致 → 保持 |
| `TextureManager` jsdelivr 参照 | .ktx2 要求時のみ遅延フェッチ（起動時の無条件 CDN fetch は無い）→ 妥当な遅延依存として保持 |

### 第5パス（フラグで塞がれた機能・架空ドキュメント・テストだけのコード）

フラグ到達性検証で2つの**実質到達不能サブシステム**を発見・削除:

| 対象 | 実測された不整合 |
|---|---|
| `src/vr/input/VoiceCommands.js`（829行）+ 配線 + `voice-commands.test.js` | `enableVoice: false` を true にする経路が**一切存在しない**（トグル無し・`new VRApp(container)` にオプション無し・URLパラメータ無し）。Web Speech API 依存の829行機能が完全に死んでいた → ファイル・配線・`voiceCommandFeedback`/`voiceCommandFailedFeedback`/`voiceErrorNotification`（crossModal）・i18n 音声エラーキー・テスト（voice-commands.test.js, app-smoke.test.js, cross-modal-notify.test.js/i18n.test.js の該当部）を全削除 |
| `src/utils/PerformanceMonitor.js`（694行）+ 配線 | `enablePerfMonitorUI` も同様に永久 false。app.js の `P` キーは簡易オーバーレイにフォールバック済み → リッチ版（694行）+ init/dispose/beginFrame/endFrame を削除、P ハンドラ簡素化 |
| `BookmarkStore.getTopSites` + `urlResolver.searchEngineHosts` | 唯一の本番呼び出し元が音声機能の `onTopSites` — テストだけが参照する「テストのためのコード」→ 本体+テスト+i18n `noTopSites` キー削除 |
| `docs/API.md`（217行） | **全記述が架空**: `UnifiedPerformanceSystem`/`UnifiedSecuritySystem`/`UnifiedErrorHandler`/`moduleLoader` 等はコードベースに0件。verify:docs の必須リストにも残存 → ドキュメント削除＋必須リストと全被リンク（README×2, QUICK_START, RELEASE_CHECKLIST, PROJECT_STATUS×2, FINAL_RELEASE_SUMMARY×2, DEVELOPER_ONBOARDING×2）修復 |
| `docs/DEVELOPER_ONBOARDING.md`（1,192行） | 同様に架空: `VRInputSystem`/`VRMediaSystem`/`VRGestureSystem`/`initWebGPU`/`processVoiceCommand` 全て0件、"Webpack Dev Server"・`core.js/vr.js/enhancements.js` 出力（実態は Vite）→ 削除 |
| `docs/COMPATIBILITY.md` | 架空 `VRSettings.set(...)` API×4箇所・音声コマンド行×6・WebGPU 行・ジェスチャー/パススルーAR 行（削除済機能）・架空 JSON 推奨設定セクション → 全て実態に修正 |
| `README.md` | Voice Commands/WebCodecs 行、"17 features" 系記述、API Docs リンク → 修正 |
| `PROJECT_STATUS.md` | Tier 3 テーブルが削除済6機能を "Complete" と記載、ObjectPoolSystem/OfflineManager/PassthroughManager 等の不存在ファイル名、Three.js r152→r181・Vite 4→5、"34 test suites"→46、"9+9 CI jobs"→3 workflow → 書き換え |
| `docs/ARCHITECTURE.md` | input/ に VoiceCommands、utils/ に不存在4ファイル（ObjectPool/ProgressiveLoader/PerformanceMonitor/DeviceCompatibility誤掲載分）→ 実在名に修正 |
| `docs/SPEC.md` FR-2.4 | ✅ → 🗑削除（理由記載）、FR-13.1 の VoiceCommands 連携記述を除去 |
| `src/main.js` 起動バナー | "17 features"・"Experimental: WebGPU, Multiplayer, AI" と削除済機能を宣伝 → 実態に修正 |
| `src/app.js` P キー | `vrApp.perfMonitorUI` 分岐（永遠に null）を除去、簡易オーバーレイ直結化 |

計測: 44 suites / 1,395 tests（−68テストは削除機能のもの）、build 2.1s、
verify:docs **100%**・verify:layout/app/vr-boot 全 PASS・lint 0 errors。
`VRApp.js` は 3,772 → 3,402 行。

### 第6パス（メソッド単位の死コード・i18n 死キー）

メソッド単位の `.name(` 呼び出し走査（src+tests）で呼び出し元ゼロのもの、および i18n
カタログ 115 キー中 `t()`/`data-i18n*` 参照ゼロのものを実測削除:

| 対象 | 内容 |
|---|---|
| `VRApp.makeToggleButton` | 60行 — 全サイトで `makeCompactToggleButton` に置き換わり呼び出しゼロ |
| `WebPanel.onDomOverlayStart/End` + `domOverlaySupported` | DOM-overlay 連携 — addEventListener に未登録、フィールドは書き込み専用（一度も読まれない） |
| `JapaneseIME.deactivate` / `JapaneseIME.getStats` / `HandTracking.getStats` | 呼び出し元ゼロ |
| `ComfortSystem.getStatus`/`resize`、`FFRSystem.getStatus`/`setThresholds`、`LayersSystem.getLayer` | 同上（dev 用のつもりの診断アクセサ群、誰も呼ばない） |
| `HapticFeedback` ×6 | `simulateForce`/`directionalPulse`/`playRhythm`/`getPatterns`/`resetStats`/`getStats` — 呼び出し元ゼロ |
| `SpatialAudio` ×4 | `setSourceOrientation`/`setSourceVelocity`/`setSourceVolume`/`createReverb` — 呼び出し元ゼロ |
| `SpatialAudio` 音声ブロック | `createVoiceSource`/`removeVoiceSource`/`updateVoicePosition` + `stop()` の `isVoice` 特例 — マルチプレイヤー音声の残骸、**テストのみ**が参照（パス5と同型の「テストだけが生かすコード」） |
| `BookmarkStore.removeHistory` | 同上 — 生産側ゼロ、テストのみ |
| i18n 死キー ×5 | `vr.msg.sectionClosed`、`vr.value.on/off/left/right`（en+ja 計10行 + 残存コメント）— `a11y.enterVR` は `data-i18n-attr` 経由で生存のため保持 |

検出したが**保持**したもの（誤検出防止の記録）: `applyAccessibility`/`initializeApp`/
`disposeMonitoring`/`trackEvent`/`captureError`/`safeMeasureEm`（裸呼び出し or 内部呼び出し）、
`WebPanel.goBack/goForward`（`tab.goBack?.()` の optional-call 構文）、`targetFPS`/
`enableTextureCompression`/`enableHomeEnvironment`/`enableSettingsPanel`（localStorage ホワイトリスト
経由で読まれる設定、書き手不在だが読み手がいるため生存）。

計測: 44 suites / 1,384 tests・lint 0 errors・build 1.9s・ci:verify（layout/app/vr-boot）全 PASS。
本パスは −582 行。

### 第7パス（書き込み専用フィールド・未使用 import・DOM/CSS 走査）

`this.X` の書き込み専用フィールド走査（write 回数 == 全参照回数）+ import 名の
本文使用走査 + index.html の id/class と main.css・JS のクロス照合:

| 対象 | 内容 |
|---|---|
| `VRControllerInput.southpaw` | **保存するだけで一度も読まれない ctor オプション** — `settings.southpaw` 自体は VRApp が手役割（pointerHand/utilityHand）に直読みして生存するが、VRControllerInput への受け渡し + フィールド + 「値が保存されることだけを検査する」テスト2件は全てデッド配管 → 削除 |
| `CaptionSystem._dirty` | 4箇所書き込み・読み取りゼロの dirty フラグ（未実装の redraw 最適化の名残） |
| `VRApp._settingsBg` / `VRApp._settingsSections` | 代入のみ・参照ゼロ |
| `JapaneseIME.candidatePanel` | null 代入×2 のみ・参照ゼロ（候補パネル機能の残骸） |
| 未使用 import ×4 | `textWidthEm`（CaptionSystem）、`truncate`（BookmarkPanel/JapaneseIME）、`STRIP_TAB_MAX_PX`（TabManager） |

全ての index.html id・全ての main.css クラス・全イベントリスナー名（enter-vr 往復確認）
は生存と判定 — DOM/CSS/イベント層はすでにクリーン。

計測: 44 suites / 1,382 tests・lint 0 errors（警告 109→105）・build 2.4s・verify:vr-boot PASS。

### 第8パス（恒真分岐・書き手不在フラグの除去）

| 対象 | 内容 |
|---|---|
| `enableTextureCompression` / `enableHomeEnvironment` / `enableSettingsPanel` | **書き手が git 履史上に一度も存在しない** 常時 true フラグ → persisted false はどのリリースでも生成不能（`saveSettings` は更新経由でしか書かない）→ フラグと `if` ラッパーを削除し無条件 init に単純化。動作は全ユーザーに対して不変 |
| `if (this.bookmarks)` | `new BookmarkStore()` は ctor で必ず代入・null 化経路ゼロ → 恒真ガード除去（「ストア不在で no-op」のテストは**到達不能状態を検査していたため削除**） |
| `if (import.meta.env && import.meta.env.DEV/PROD)` ×2 | Vite ビルド下で `import.meta.env` は常に定義済み → 前半を除去 |

計測: 44 suites / 1,381 tests・lint 0 errors・build 1.9s・verify:vr-boot PASS。

### 第9パス（強制力ゼロのツール設定 = 死んだインフラ）

| 対象 | 内容 |
|---|---|
| **Prettier スタック全体** | `format:check` は実測で **123 ファイル全て未フォーマットで常時赤** — 誰も実行しないフォーマッターは「存在する標準」の偽装 → `prettier` devDep・`format`/`format:check` スクリプト・`.prettierrc.json`・`.prettierignore` を全削除。両バリデータの必須ファイルリストと README/TESTING/CONTRIBUTING の言及も除去 |
| `.lighthouserc.json` | `lighthouse` スクリプト（パス3で削除）の孤児設定 → 削除（Netlify の `@netlify/plugin-lighthouse` は別物で生存） |

workflow-changes.patch を **v3 に再交付**: 加えて `release.yml` の
`npm run format:check || echo`（削除後スクリプトを呼ぶ偽警告）を除去。

計測: 44 suites / 1,381 tests・lint 0 errors・build 1.9s・verify:vr-boot PASS・verify:docs 100%。

### 第10パス（イベント・ストレージ・重複スキャフォールド）

走査結果: DOM/カスタムイベントの発火・受信は全て対称（死リスナーゼロ）、
localStorage キーは全て書き込み/読み込み対称、`tools/measure-text-metrics.mjs`
はベースライン再計測用の文書化済みユーティリティとして生存判断。

唯一の実発見 — **設定パネル 5 ボタン工場の同一スキャフォールド重複**:
`canvas→ctx→tex→push` の導入部と `mesh→registerInteractable→_redraw→return`
の終端部が `makeCompactToggleButton`/`makeSectionTab`/`makeActionButton`/
`makeStepperButton`/`makeCycleButton` に完全コピーされていた。
`_canvasButton(w,h,widthM)` + `_registerCanvasButton(mesh,draw,handlers)`
に抽出して統合（net −32行）。描画ロジック・ハンドラは一切変更なし。

計測: 44 suites / 1,381 tests・lint 0 errors・build 1.7s・verify:vr-boot PASS。

### 第11パス（依存・設定・ドキュメントの層）

監査結果 — devDependencies 全8件が実使用確認（`sharp`=generate-icons、
`@babel/*`=jest transform、`babel.config.js`+`.babelrc` の二重化は
node_modules 越境の仕様上必要と文書化済み）。AccessibilityCoordinator は
Phase-3 抽出ロードマップの途中経過として生存判断。

実発見: **`docs/QUICKSTART.md`** — ゼロ inbound のポインタ・スタブで
内容は QUICK_START.md（canonical、全バリデータ/README が参照）の重複
→ 削除。`CATEGORY_RESEARCH.md` の「既存 `.lighthouserc.json`」の虚偽
記述も修正（実際の予算ゲートは netlify.toml の plugin-lighthouse）。

計測: verify:docs PASS（lint/test/build は前パスから差分なし — ドキュメントのみ）。

### 第12パス（monitoring.js — 書き込み側が全て死んでいた計測層）

manifest フィールド・web-vitals 配線は実在確認。一方 `monitoring.js`
（540行）のカスタム計測層は**フィーダー関数が全てテストのみ参照**と判明:
`trackInteraction`・`trackVRError`・`captureError`・`trackFPS`・
`trackMemory`・`trackVRSession`・`trackPageView` の src/内部呼び出しゼロ
（数え上げた1件は JSDoc 使用例内の架空コードだった）。

カスケード: trackFPS/trackMemory が死ぬと `performanceMetrics` は永遠に空
→ `reportPerformanceSummary` は常時ゼロの要約を60秒間隔で発火する**意味論的
死コード** → フィーダー・集計・定期レポート・`calculateAverage`・
`performance.reportInterval`・消費者ゼロの default export バッグまで除去
（−246行）。残存は実経路のみ: initSentry/initGoogleAnalytics（環境変数で
活性化）・web-vitals（`trackEvent`+閾値超過→`captureMessage`）・セッション
ライフサイクル・dispose。

計測: 44 suites / 1,372 tests・lint 0 errors・build 1.85s・verify:vr-boot PASS。

### 第13パス（書き込み専用フィールドの最終層 — ctor 引数まで遡る）

`this.X` 全走査の残存3件を処理:
- `ComfortSystem.scene` — `render(scene,camera)` は引数で受けるため
  フィールドは一度も読まれない → **ctor 引数自体を削除**（第1引数が
  フィールド専用だった）: `(camera, renderer, opts)` に短縮。
- `HandTracking.renderer` — 同型（`this.scene` は使用済みだが renderer
  は不読）→ `(scene)` に短縮。
- `DevTools.enabled` — 書き込みのみ・トグル経路なし（`visible` が実トグル）
  → フィールド削除。

計測: 44 suites / 1,372 tests・lint 0 errors・build 1.9s・verify:vr-boot PASS。

### 第14パス（メタフィールド・jest globals・デッドパラメータ）

- `jest.config.js` の `globals` ブロック（`NODE_ENV`/`VR_BROWSER_VERSION`）—
  全 tests/src で参照ゼロ → ブロックごと削除。
- `package.json` の `main: 'dist/index.html'` — private アプリで誰も
  エントリ解決しない + JS ではない偽の main → 削除。`engines` を >=18→>=20
  に揃え（QUICK_START.md と整合。`SETUP.md` の「Node 14+」も修正）。
- `WebPanel.setCurved(value, radius)` — 全呼び出し元が第2引数を渡さず、
  `radius` の唯一の書き手は setCurved 自身（常に 2.2 の自己デフォルト）
  → 引数削除して `this.curveRadius` 直読みに。
- export const 全走査・`createQuadLayer` の分割代入デフォルトは生存確認。

計測: 44 suites / 1,372 tests・lint 0 errors・build 4.9s・verify:vr-boot PASS。

### 第15パス（vite.config.js — 死設定と未宣言依存の一掃）

- `define` ブロック全削除 — `__APP_VERSION__`/`__BUILD_TIME__` は参照ゼロ、
  `__PRODUCTION__: true` は dev ビルドでも true になる**嘘の定数**。
- `minify: 'terser'` + `terserOptions` 全削除 — terser は devDeps に
  未宣言の推移的依存で、かつ `esbuild.drop` と console 除去が完全に二重化。
  esbuild minify（既定値）に戻す → **build 5s → 0.73s（約7倍速）**、
  gzip 差 +2kB のみ。
- `worker` ブロック（`new Worker` ゼロ）、`plugins: []`、
  `resolve.extensions` の `.jsx`/`.wasm`（該当ファイルなし）、
  `server.https:false`/`cors:true`/`preview` 同項（全て既定値）、
  `assetsInlineLimit`（既定値）を削除。
- COEP/COOP ヘッダー — SharedArrayBuffer 不使用かつ prod ヘッダー
  （netlify/vercel/nginx）に存在しない不一致の dev-only 設定 → 削除。
  `X-Content-Type-Options`/`X-Frame-Options`/`X-XSS-Protection` は実
  セキュリティとして生存。
- `chunkSizeWarningLimit` は vendor-three の既知サイズ抑制として意図的
  なので保持（コメント付き）。

計測: 44 suites / 1,372 tests・lint 0 errors・build 0.73s・verify:vr-boot PASS。

### 第16パス（デプロイ設定の実在性 — netlify.toml / vercel.json / nginx.conf）

- `netlify.toml [dev]` の `python -m http.server 8888` — 生ソースを
  静的配信するパス1 の Docker 嘘と同型（bare specifier で起動不能）。
  `npm run dev` / port 5173 に修正。
- 全 CSP（netlify / vercel / nginx ×2）から `'unsafe-eval'` と
  `cdnjs.cloudflare.com` を削除 — `new Function` は DevTools 内のみ
  （dev-only コード）なので本番 CSP に不要な権限。cdnjs は参照ゼロ。
- netlify CSP `script-src` に `www.googletagmanager.com` を追加 —
  opt-in GA が Netlify では構造的に発火できなかった不一致を修復
  （vercel.json は済）。
- 未参照環境変数 `VR_BROWSER_VERSION` を netlify + vercel から削除。
- 確認済み生存: manifest icons・og-image/twitter-card（全実在）、
  `/app/*` リライト、`/home`→`/` redirect、`plugin-lighthouse`、
  `.gitignore` エントリ群。

計測: 44 suites / 1,372 tests・lint 0 errors・build 0.66s。

### 第17パス（検証パス — 全層クリア確認）

- `public/service-worker.js`: CRITICAL_ASSETS 全実在・パターン有効
  （以前のパスで '/src/*.js' 嘘リストは既除去済み）。
- package.json scripts ↔ tools/: 全マッピング実在確認。
- docker-compose.yml → Dockerfile → healthcheck.sh / nginx.conf の
  配線は正常。
- `docker:compose` が非推奨 `docker-compose` v1 呼び出しだったため
  `docker compose` v2 に修正 + DEPLOYMENT_GUIDE.md の例も整合。

計測: 44 suites / 1,372 tests・lint 0 errors・build 0.66s・verify:docs PASS。

### 第18パス（.github/ 非 workflow + eslint globals + env 対称）

- `.github/FUNDING.yml` 削除 — 全フィールド空のテンプレート（実際の
  funding 設定ゼロ、GitHub 側の描画も発生しない）。
- `.github/DISCUSSION_TEMPLATES.md` 削除 — DISCUSSION_TEMPLATE/*.yml 型
  の正規機能ではなく、0 inbound refs の孤立ドキュメント。
- `CODEOWNERS` の `@yourusername` プレースホルダ → `@shizukutanaka`
  に修正（dependabot と同型の未設定記述）。
- eslint.config.js の GPU* globals 6件削除（src/ で使用ゼロ）。
- `.env.example` 全項目生存確認: VITE_APP_VERSION/VITE_BUILD_TIME は
  monitoring.js が実読み、PORT/ALLOW_ORIGIN は proxy/server.js が実読み。

計測: 44 suites / 1,372 tests・lint 0 errors・build PASS。

### 第19パス（残留参照監査 + i18n 全キー検証）

- `docs/CI_CD_MONITORING_GUIDE.md`: 不存在の `check-performance-regression.js`
  ツール節、削除済み monitoring API（trackFPS/trackMemory/trackVRSession/
  trackVRError/trackInteraction/captureError/trackPageView）の使用例、
  Prettier 行を切除（783 → 662 行）。生存 API（trackEvent/captureMessage/
  web-vitals threshold 連携）は保持。
- i18n CATALOG 119キー全検証 — 一見 dead に見える18キーは全て
  `t(cond ? 'k1' : 'k2')` 型の動的選択で生存（誤検出を個別確認）。
- tests/setup.js（localStorage/navigator stub）・monitoring.js の
  実消費者（main.js init / VRApp dispose）は生存確認。

計測: 44 suites / 1,372 tests・lint 0 errors・build PASS・verify:docs PASS。

### 第20パス（テスト専用コードの摘出 — 規約「テストだけが参照するコード」）

- `BookmarkStore.isQuotaExceededError` 削除 — JSDoc は「呼び出し側が
  再試行を判断する」と謳うが **モジュール内外で呼び出しゼロ**
  （writeJSON の catch は結果を捨てる）。テスト5件と import も除去。
- `i18n.availableLanguages` 削除 — 実消費者ゼロ（テスト1件のみ参照）。
- `frecencyScore` は内部実使用（BookmarkStore:266/290）+ テスト → 生存。
- 同名関数跨ファイル走査: `render` 重複は別クラスの正当メソッド。
- JSDoc 残留引数（WebPanel `opts.scene` 等）は実在パラメータを指す
  ため生存確認済み。

計測: 44 suites / 1,367 tests・lint 0 errors・build PASS。

### 第21パス（README 機能表の実在性監査）

- メソッド・書き込み専用フィールドの再走査: パス12–20 の削除連鎖で
  新たに孤児化したものは**ゼロ**（全層クリーン維持を確認）。
- README 機能表の嘘3件修正:
  - Tier2「6 Features」→ 実3行（「Offline Support」は Tier1 Service
    Worker と重複行、「MR Passthrough」は MixedReality 削除済みで
    存在しない — DeviceCompatibility の `isSessionSupported` プローブ
    のみ残存、機能ではない）
  - Development Tools「2 Features」→ PerformanceMonitor はパス5 で
    削除済み、VR DevTools のみ残るのでカウント行ごと除去
- Tier3 の "Removed" 注記（パス5追記済み）と矛盾する Tier2 行を
  突き合わせて解消した形。

計測: 44 suites / 1,367 tests・lint 0 errors・verify:docs PASS。

### 第22パス（manifest.json の嘘 + i18n 対称監査）

- manifest `shortcuts` 3件全削除 — `/bookmarks`・`/history`・
  `?action=new-tab` は全て **app が一切読まない URL**（URLSearchParams
  の実読み取りゼロ、SPA ルートも無し）。PWA ショートカットは宣言的に
  見えるが「届かない機能へのリンク」は嘘。
- `related_applications`（空）・`prefer_related_applications`・
  `edge_side_panel`（サイドパネル対応の設計が存在しない宣言）を除去。
- アイコン7件は全実在を再確認。
- i18n en/ja カタログ対称性: 119 vs 119、キー完全一致（非対称ゼロ）。
- docs 内 `npm run` 参照は全て実在スクリプトに一致。

計測: 44 suites / 1,367 tests・lint 0 errors・build PASS。

### 第23パス（削除連鎖による新規孤児 export の再走査）

- export 全再走査で5件の外参照ゼロ定数を検出:
  `COMPOSITION_FONT_PX`/`COMPOSITION_TEXT_W`（keyboardLayout）、
  `ROW_TITLE_FONT`/`ROW_URL_FONT`（bookmarkLayout）、
  `CAPTION_TEXT_W`（captionLayout）— 全て内部で実使用なので
  `export` キーワードのみ除去（パス2規約）。
- これ以降の `export` 残存は全て src 外 or tests から実参照あり。

計測: 44 suites / 1,367 tests・lint 0 errors・build PASS。

### 第24パス（jest カバレッジ閾値 — 機能しない飾りを実ガードへ）

- 実測: lines 60.75 / branches 55.09 / funcs 56.43 / stmts 60.42 に対し
  閾値は 20–25（コメントも「~28%」と古い実測を引用）— 衰退を全く
  防げない飾りだった。
- 実測−5pt に引き上げ: branches 50 / functions 50 / lines 55 /
  statements 55（テストが本当のリグレッションで赤になる閾値）。
- package.json メタデータ・index.html 残タグは実在確認済み。

計測: 44 suites / 1,367 tests・coverage PASS（新閾値）・lint 0 errors・build PASS。

### 第25パス（Sentry 統合の削除 — 「文書化された opt-in」は実は構造的に壊れていた）

- `monitoring.js` の Sentry 経路全削除: `@sentry/browser|tracing|replay`
  は **dependencies に存在しない**上、`@sentry/tracing` は v8 で
  本体にマージ済みの廃止パッケージ — パス12で「env var opt-in = 到達
  可能」と保持した判断は誤り。DSN を設定しても dynamic import が
  必ず throw → catch → console.error で**静かに壊れるだけ**だった。
  （vite.config の external コメントが「使うには自分で npm i して」と
  自白するスタブ実装だった。）
- 連鎖削除: `sentry` config ブロック、`initSentry`、`captureMessage`
  （中身が壊れた import のみ）＋threshold→captureMessage 呼び出し
  （console.warn に置換、GA `trackEvent` 経路は生存）＋ vite external
  ＋ `.env.example` `VITE_SENTRY_DSN`＋ README/main.js/CI_CD_GUIDE/
  PROJECT_STATUS/RELEASE_CHECKLIST の現行状態クレーム。
- 保持: GA4（script タグ注入で依存不要・真の opt-in）、web-vitals
  →trackEvent→threshold 警告（実在パッケージ）。
- tests/monitoring.test.js: 架空 sentry モック・captureMessage テスト
  除去（INP 閾値テストは GA 経路で依然意味を持つため保持・コメント修正）。

計測: 44 suites / 1,366 tests・lint 0 errors（警告 105→103）・build PASS・verify:vr-boot PASS・verify:docs PASS。

### 第26パス（dynamic import / opt-in 経路の実在性 + ARCHITECTURE 同期）

- 残る dynamic import 全生存確認: `web-vitals`（実 dep）、
  `../dev/DevTools.js`（DEV-gated）、`./app.js`、GA script 注入。
- `DeviceCompatibility`・`a11y/accessibility.js` 消費者は実在。
- `docs/ARCHITECTURE.md` モジュールマップを実態に同期:
  `vr/multiplayer`/`vr/ar`/`vr/ai`/`WebGPURenderer` 行と
  `server/index.js` Express+Stripe 節（削除済みの架空サーバー）を
  除去、`proxy/server.js` の実説明に置換。手動 chunk 名も実値に修正。
- `BUILD_OPTIMIZATION_GUIDE.md` の例コードを存在しない
  `WebGPURenderer` から実在 `SpatialAudio` に差し替え。

計測: 44 suites / 1,366 tests・lint 0 errors・build PASS・verify:docs PASS。

### 第27パス（SPEC.md FR 表 + コメント残滓）

- SPEC.md: FR-11.1 の「Sentry opt-in」記述を削除済み実態に修正
  （web-vitals + GA opt-in のみ）。FR-1.2 の「AI 連携」除去。
- VRApp.js コメント残滓2件: `navigate()` JSDoc の「AI recommendation
  engine に feed」（AIRecommendation 削除済）と showVRToast 内「AI」
  言及を除去。
- 生存再確認: `#performance-monitor` DOM overlay（'P' キートグル・
  `getPerformanceStats` 実在）は NFR-1 主張を支持するため保持。

計測: 44 suites / 1,366 tests・lint 0 errors・build PASS・verify:docs PASS。

### 第28パス（test-only モジュールの所在を修正）

- `src/vr/ui/contrast.js` は import 元がテスト3件のみの検証ライブラリ
  （実行時経路ゼロ）→ `tests/helpers/contrast.js` へ移動。src/ が
  「実行時に到達するモジュールだけ」を表す構造に。
- `apcaLc`（APCA/WCAG3 実装 ~45行）+ APCA 定数群は自身のテストだけが
  参照する自己参照 export → テストブロックごと削除。
- `wcagMinimum` はパレットスイープのしきい値オラクルとして生存を
  確認し保持（一度誤削除して赤になったため復元 — 測定が先）。

計測: 44 suites / 1,359 tests・lint 0 errors・build PASS・vr-boot PASS。

### 第29パス（TextureManager — 初期化されるが一度も使われない subsystem 削除）

- `TextureManager`（394行 + KTX2Loader）は production で
  `initializeKTX2()` まで走るが、`loadTexture` の実呼び出し元は
  `VRApp.loadTexture` ラッパーのみで、そのラッパーの呼び出し元は
  **ゼロ**（JSDoc 例のみ）。パス5同型の「初期化だけする死んだ
  サブシステム」→ モジュール + 専用テスト + VRApp 配線一式削除。
- 連鎖孤児も除去: index.html の jsdelivr preconnect（KTX2
  トランスコーダ CDN 先が唯一の用途）、SW の `/.ktx2$/` キャッシュ
  ルール、vite manualChunks の tier1 エントリ。
- `stats.textureMemory`/`textureCompression` フィールドは P-key
  overlay が `? :` ガード付きで参照していたため安全に消滅。

計測: 43 suites / 1,343 tests・lint 0 errors・build 0.7s・
verify:docs・vr-boot 全 PASS。

### 第30パス（同名メソッド重複走査 + 未使用変数の残滓）

- 全サブシステムの read/assign 分布を測定: `immersiveVideo`（play/
  pause/visibility 連動）・`devTools`（F12 自前リスナー）・
  `deviceCompat`・`windowManager`/`tabManager` は全て生存を確認。
- `BookmarkStore.hostOf` — 定義されて一度も呼ばれないヘルパー
  （JSDoc 付き）を削除。`TabManager` の未使用ローカル `tabsAreaW`、
  `catch (e)` の未使用 `e` 4件を `catch {` に整理。
- JapaneseIME の dispose 二重定義は別クラス（IME 本体 vs キーボード
  統合）で誤検出と確認。

計測: 43 suites / 1,343 tests・lint warnings 103→95・
build 0.64s・vr-boot PASS。

### 第31パス（削除連鎖後のメソッド再走査）

- `JapaneseIME.getState` — 呼び出しゼロの診断アクセサを削除。
- `SpatialAudio.simulateDoppler` — ドップラー効果メソッド、
  呼び出しゼロ（どこからも velocity を持つ source が来ない）を削除。

計測: 43 suites / 1,343 tests・lint 95 warnings（0 errors）・
build 0.7s・vr-boot PASS。

### 第32パス（ランディングページの嘘を修正）

- index.html + i18n: 「KTX2 textures」記述を3箇所から除去
  （パス29で TextureManager 削除済み — 見えない所を先に掃いて
  見える所が嘘のまま残る典型例）。
- ジェスチャ「12種」は誇大 — HandTracking.detectGesture の実装は
  pinch/point/open/fist/thumbsup の5種 → en/ja 共に 5 に修正。
- hero.subtitle の「Tier 3 features are experimental」除去
  （Tier3 = 音声/パフォーマンス監視はパス5で削除済み）。
- proxy/server.js は文書化済み opt-in のため生存確認。

計測: 43 suites / 1,343 tests・lint 95 warnings（0 errors）・
build 0.6s・verify:docs・vr-boot 全 PASS。

### 第33パス（KTX2 削除の docs 連鎖 — 7ファイルで残存主張を摘出）

パス29の TextureManager 削除後に docs/operational 系を再走査:
- ARCHITECTURE.md: utils 行・パイプライン記述から TextureManager 除去
- SPEC.md: FR-4.3 を 🗑 削除ステータスに（FR-2.4 と同形式）
- README.md: KTX2 機能行削除 + テスト数を実測に更新（46→43 suites）
- PROJECT_STATUS.md / RELEASE_CHECKLIST.md / DEPLOYMENT_GUIDE.md:
  Tier1・モジュール表・チェックリストの KTX2 項目を除去
- IMPLEMENTATION.md: 「### 4. KTX2 Texture Compression」節全体
  （78行・コード例含む）を削除し節番号を繰り上げ
- crossModal/a11y/chromeColors の export 全点検 → 全て実使用生存

計測: 43 suites / 1,343 tests・lint 95 warnings（0 errors）・
build 0.7s・verify:docs PASS。

### 第34パス（クリーンスキャン — 削除ゼロ＝「何もしない」）

走査したが全て生存を確認し変更なし:
- tests/setup.js — localStorage shim + navigator.xr stub のみ・実使用
- jest.config.js — マッパー/デッド設定なし・閾値は実測連動
- AccessibilityCoordinator — captionSystem/hapticFeedback/
  gazeInteraction の delegate は VRApp が全使用
- .github/ — CODEOWNERS・dependabot・workflows のみ残存
- webPanel フィールド — tabManager 不在時の fallback 経路で生存
- offline.html — SW 登録削除済み・アイコン実在

**ソクラテス式結論**: モジュール/メソッド/フィールド/設定/イベント/
docs/ランディング/テストインフラの全層で「目的を説明できないもの」は
尽きた。残るは VRApp 3,300行の分離リファクタ（台帳 C-1）のみで、
それは削除系スイープではなく設計変更 — 価値密度の比較では
「何もしない」が正当化される地点に到達。

### 第35パス（C-1 最初の安全スライス: canvas-mesh ヘルパー抽出）

- `src/vr/ui/canvasMesh.js` を新設し3ヘルパーを移動:
  `planeGeometry`（shared geometry cache、旧 _sharedPlaneGeometry）、
  `canvasButton`（canvas+texture+mesh scaffold、旧 _canvasButton）、
  `controllerRay`（共有 Raycaster、旧 raycasterFromController —
  状態を VRApp インスタンスから module singleton へ移動）。
- VRApp は薄い delegate 1行に置換（5+3 呼び出しサイトは不変）—
  挙動不変の純粋移動で、設定ボタン工場の将来の抽出への縫い目を作る。

計測: 43 suites / 1,343 tests・lint 95 warnings（0 errors）・
build 0.7s・vr-boot PASS。

### 第36パス（C-1 スライス2: 設定ボタン工場を settingsButtons.js へ抽出）

- `src/vr/ui/settingsButtons.js` 新設: `compactToggleButton`・
  `sectionTab`・`actionButton`・`stepperButton`・`cycleButton` の
  5工場（~350行）を移動。VRApp 状態は `b` コンテキスト
  （geoCache/texPool/register/settings/updateSetting/announce/
  toggleSection）経由に置き換え、モジュール純粋化。
- VRApp メソッドは delegate に（呼び出し側全点不変）— 3,254→3,023行。
- 連鎖孤児除去: VRApp の buttonStyle/settingsStepper 部分 import、
  BookmarkStore.stripWww（hostOf 削除の残滓）、crossModal の
  未使用 `t` import。

計測: 43 suites / 1,343 tests・lint 93 warnings（0 errors）・
build 0.68s・vr-boot PASS。

### 第47パス（C-1 追加スライス: teleport/layers/updateHover 抽出）

- `_attachLayersToPanels` + `_detachPanelLayer` を sessionLifecycle.js へ
  （呼び出し元が onVRSessionStart のみ — detach はタブ閉鎖コールバック）。
- teleport クラスタ（onTeleportStart/End/_resetTeleportAim/
  _cancelTeleportIfAimedBy）+ updateHover を inputRouting.js へ
  （入力→teleport・hover は入力ドメインの責務）。
- 検出・復旧した回帰: `_detachPanelLayer` はテストが prototype 直叩きする
  公開シーム → delegate 保持で復旧。
- VRApp 1,313 → 1,227 行（−86行）。C-1 累計 −2,027行（3,254→1,227）。

計測: 43 suites / 1,343 tests・lint 98 warnings（0 errors）・
build 0.70s・vr-boot PASS。

### 第37パス（C-1 スライス3: settingsStore + homeEnvironment 抽出）

- `src/utils/settingsStore.js` 新設: loadPersistedSettings/saveSettings/
  updateSetting の永続化トリオ（~50行）を移動。VRApp は delegate 保持
  （app.js と tests が公開 API として使用）。
- `src/vr/homeEnvironment.js` 新設: sky dome/floor/grid/welcome panel
  ビルダー（~95行）を移動。captionSystem は構築時点では未代入のため
  getCaptionSystem 遅延 getter に変更（キャプチャだと常に null になる
  回帰を実測で検出）。
- VRApp 3,023 → 2,912 行。

計測: 43 suites / 1,343 tests・lint 93 warnings（0 errors）・
build 0.73s・vr-boot PASS。

### 第38パス（C-1 スライス4: createSettingsPanel 抽出 — C-1 核心）

- `src/vr/ui/settingsPanel.js` 新設: createSettingsPanel（298行・依存20本）
  を `createSettingsPanel(app)` として移動。全 apply クロージャが apply 時に
  `app.X` を評価するため構築順序の遅延性を保持。セクション構成表（SECTIONS）
  ・layoutSettingsPanel・ファクトリ呼び出しを全て同梱。
- VRApp は delegate 保持（`_rebuildSettingsPanel` が再利用）。5つの
  makeXxx delegate が死んだので削除し `_btnCtx()` 経由で直接ファクトリ
  呼び出しに統一。
- 連鎖孤児除去: VRApp 側の `setPref`/`smoothMoveWarning`/`layoutSettingsPanel`/
  `SETTINGS_PANEL_W`/`settingsButtons` 各 import が未使用化。
- VRApp 2,912 → 2,538 行（−374行）。C-1 累計 −716行（3,254→2,538）。

計測: 43 suites / 1,343 tests・lint 93 warnings（0 errors）・
build 0.63s・vr-boot PASS。

### 第39パス（C-1 スライス5: 入力ルーティング抽出 — C-1 完結）

- `src/vr/interaction/inputRouting.js` 新設: updateLocomotion/
  updateButtonInput/snapTurn/updateTeleport/onControllerSelect（計~284行）
  を `fn(app, …)` 関数群として移動。スクラッチ Vector は module-scope
  遅延 init（smoothMove 無効時ゼロコストを維持）。
- `isWorldVisible` を同モジュールへ移動し export（updateHover が参照）。
- `raycasterFromController` は delegate 経由を維持 — テストがモックする
  公開シームのため直接 controllerRay 化は回帰（実測で5件失敗→復旧）。
- VRApp は delegate 5本 + 残メソッドは orchestrator のみ。
- VRApp 2,538 → 2,287 行（−251行）。C-1 累計 −967行（3,254→2,287）。

計測: 43 suites / 1,343 tests・lint 93 warnings（0 errors）・
build 0.74s・vr-boot PASS。

### 第45パス（C-1 追加スライス: setupStages 抽出）

- `src/vr/setupStages.js` 新設: setupRenderer/setupScene/setupCamera/
  setupControllers/setupVR（~280行・初期化5段）を `fn(app)` として移動。
  イベントハンドラは `app._onX` に保存し dispose() の削除経路を維持。
- 連鎖孤児: VRApp 側 XRControllerModelFactory/VRButton/VRControllerInput/
  debounce/crossModal 各 import 除去（crossModal は vrToast・setupStages
  に完全移行）。
- VRApp 1,918 → 1,660 行（−258行）。C-1 累計 −1,594行（3,254→1,660）。
- 検出した回帰: delegate 未作成で `this.setupRenderer is not a function`
  （vr-boot が即検出）→ delegate 5本追加で復旧。

計測: 43 suites / 1,343 tests・lint 96 warnings（0 errors）・
build 0.72s・vr-boot PASS。

### 第46パス（C-1 最大スライス: systemsLifecycle 抽出）

- `src/vr/systemsLifecycle.js` 新設: initializeSystems（179行・全
  サブシステム構築 orchestrator）と dispose（164行・対称 teardown）を
  `fn(app)` として移動。サブシステム import 12本も同時に VRApp から流出。
- 連鎖孤児: FFRSystem/ComfortSystem/JapaneseIME/HandTracking/
  HapticFeedback/GazeInteraction/CaptionSystem/SemanticDOM/SpatialAudio/
  WindowManager/ImmersiveVideo/disposeMonitoring import 除去
  （resolveComfortPreset/fireTeleportFeedback は生存のため絞り込み復元）。
- VRApp 1,660 → 1,313 行（−347行）。C-1 累計 −1,941行（3,254→1,313）。
- VRApp はここで真の薄い orchestrator になった: 残るは constructor・
  initialize・render/updateSystems・navigate・interactable registry・
  settings delegates のみ。

計測: 43 suites / 1,343 tests・lint 97 warnings（0 errors）・
build 0.68s・vr-boot PASS。

### 第47パス（C-1 追加スライス: teleport/layers/updateHover 抽出）

- `_attachLayersToPanels` + `_detachPanelLayer` を sessionLifecycle.js へ
  （呼び出し元が onVRSessionStart のみ — detach はタブ閉鎖コールバック）。
- teleport クラスタ（onTeleportStart/End/_resetTeleportAim/
  _cancelTeleportIfAimedBy）+ updateHover を inputRouting.js へ
  （入力→teleport・hover は入力ドメインの責務）。
- 検出・復旧した回帰: `_detachPanelLayer` はテストが prototype 直叩きする
  公開シーム → delegate 保持で復旧。
- VRApp 1,313 → 1,227 行（−86行）。C-1 累計 −2,027行（3,254→1,227）。

計測: 43 suites / 1,343 tests・lint 98 warnings（0 errors）・
build 0.70s・vr-boot PASS。

### 第40パス（抽出後の孤児再走査 + init⇄dispose 非対称走査）

- ライフサイクル非対称: 全 this.X 代入フィールド × dispose() 参照を交差
  → 実リークゼロ（scene.traverse が全 mesh の geometry/material を網羅、
  _panelTextures/_homePanelTexture/_sharedGeometries/タイマー個別破棄済み、
  a11y/controllerInput はリスナー非保持の純粋集約/読み取り器）。
- 抽出で生まれた死 delegate を摘出: `_canvasButton` と
  `_registerCanvasButton`（工場群が settingsButtons 内で直接
  canvasButton/register を呼ぶため呼び出しゼロ）+ 孤立 JSDoc。
- VRApp 2,287 → 2,269 行。

計測: 43 suites / 1,343 tests・lint 93 warnings（0 errors）・
build 0.7s・vr-boot PASS。

### 第41パス（抽出モジュールの export 全生存 + manualChunks 整合）

- 新規4モジュールの全 export を実参照で確認（inputRouting 6・
  settingsPanel 1・settingsButtons 5・canvasMesh 3・homeEnvironment 1・
  settingsStore 3 — 全生存、孤児ゼロ）。
- vite.config.js の manualChunks「Tier 2 features (lazy loaded)」コメントは
  嘘だった: JapaneseIME/HandTracking/SpatialAudio は VRApp から静的
  import（真の lazy 境界は main.js→app.js のみ）。コメントを実態に修正。

計測: build 0.66s（chunks 正常）。

### 第42パス（設定キー実効性走査 + C-1 追加スライス: browsingSystems）

- 新走査軸「設定キー実効性」: settings デフォルト全27キー × 実行時
  読み取り経路を交差 → 全キーに実コンシューマあり（嘘の設定ゼロ）。
- `src/vr/browser/browsingSystems.js` 新設: _buildBrowsingSystems（126行・
  TabManager+BookmarkPanel 組み立てと15コールバック）を
  `buildBrowsingSystems(app)` として browser/ ドメインに移動 — ブラウジング
  サブシステムの組み立ては browser/ の責務。
- `hostnameCaption` を `browser/urlDisplay.js`（既存 URL ヘルパー群）へ
  移動・export。
- 連鎖孤児: VRApp 側 TabManager/BookmarkPanel import 除去。
- VRApp 2,268 → 2,128 行（−140行）。C-1 累計 −1,126行（3,254→2,128）。

計測: 43 suites / 1,343 tests・lint 92 warnings（0 errors）・
build 4.5s（再起動後コールドキャッシュ）・vr-boot PASS。

### 第43パス（C-1 追加スライス: vrToast 抽出）

- `src/vr/ui/vrToast.js` 新設: showVRToast（71行）を `showVRToast(app, …)`
  として移動 — トーストは dispatch ではなく自己完結した通知機能
  （canvas 描画 + ARIA alert ミラー + haptic/caption 3ch 送出）。
  _toastTimers は app フィールドのまま（dispose() が pending 解除を継続）。
- 連鎖孤児: VRApp 側 configureUITexture/toastColors/toastFontPx/
  withSeverity import 除去。
- VRApp 2,128 → 2,059 行（−69行）。C-1 累計 −1,195行（3,254→2,059）。

計測: 43 suites / 1,343 tests・lint 92 warnings（0 errors）・
build 0.84s・vr-boot PASS。

### 第44パス（C-1 追加スライス: sessionLifecycle 抽出）

- `src/vr/sessionLifecycle.js` 新設: onVRSessionStart/onVRSessionEnd
  （~147行・FFR/Layers/handTracking/immersiveVideo の per-session 遷移）を
  `fn(app)` として移動。
- 連鎖孤児: VRApp 側 LayersSystem import 除去。
- brace-style 違反を修正（delegate を複数行化 — パス39分も統一）。
- VRApp 2,059 → 1,918 行（−141行）。C-1 累計 −1,336行（3,254→1,918）。

計測: 43 suites / 1,343 tests・lint 92 warnings（0 errors）・
build 0.74s・vr-boot PASS。

### 第45パス（C-1 追加スライス: setupStages 抽出）

- `src/vr/setupStages.js` 新設: setupRenderer/setupScene/setupCamera/
  setupControllers/setupVR（~280行・初期化5段）を `fn(app)` として移動。
  イベントハンドラは `app._onX` に保存し dispose() の削除経路を維持。
- 連鎖孤児: VRApp 側 XRControllerModelFactory/VRButton/VRControllerInput/
  debounce/crossModal 各 import 除去（crossModal は vrToast・setupStages
  に完全移行）。
- VRApp 1,918 → 1,660 行（−258行）。C-1 累計 −1,594行（3,254→1,660）。
- 検出した回帰: delegate 未作成で `this.setupRenderer is not a function`
  （vr-boot が即検出）→ delegate 5本追加で復旧。

計測: 43 suites / 1,343 tests・lint 96 warnings（0 errors）・
build 0.72s・vr-boot PASS。

### 第46パス（C-1 最大スライス: systemsLifecycle 抽出）

- `src/vr/systemsLifecycle.js` 新設: initializeSystems（179行・全
  サブシステム構築 orchestrator）と dispose（164行・対称 teardown）を
  `fn(app)` として移動。サブシステム import 12本も同時に VRApp から流出。
- 連鎖孤児: FFRSystem/ComfortSystem/JapaneseIME/HandTracking/
  HapticFeedback/GazeInteraction/CaptionSystem/SemanticDOM/SpatialAudio/
  WindowManager/ImmersiveVideo/disposeMonitoring import 除去
  （resolveComfortPreset/fireTeleportFeedback は生存のため絞り込み復元）。
- VRApp 1,660 → 1,313 行（−347行）。C-1 累計 −1,941行（3,254→1,313）。
- VRApp はここで真の薄い orchestrator になった: 残るは constructor・
  initialize・render/updateSystems・navigate・interactable registry・
  settings delegates のみ。

計測: 43 suites / 1,343 tests・lint 97 warnings（0 errors）・
build 0.68s・vr-boot PASS。

### 第47パス（C-1 追加スライス: teleport/layers/updateHover 抽出）

- `_attachLayersToPanels` + `_detachPanelLayer` を sessionLifecycle.js へ
  （呼び出し元が onVRSessionStart のみ — detach はタブ閉鎖コールバック）。
- teleport クラスタ（onTeleportStart/End/_resetTeleportAim/
  _cancelTeleportIfAimedBy）+ updateHover を inputRouting.js へ
  （入力→teleport・hover は入力ドメインの責務）。
- 検出・復旧した回帰: `_detachPanelLayer` はテストが prototype 直叩きする
  公開シーム → delegate 保持で復旧。
- VRApp 1,313 → 1,227 行（−86行）。C-1 累計 −2,027行（3,254→1,227）。

計測: 43 suites / 1,343 tests・lint 98 warnings（0 errors）・
build 0.70s・vr-boot PASS。

---

## 使い方（次のセッションへ）

1. **A章**はユーザーの明示的な承認があれば即着手可能。承認の有無を最初に確認すること。
2. **B章**は「バグではあるが今は到達不能」なものなので、単独で1セッション分の作業にはしない方がよい。もし関連する別の作業（例：ProgressiveLoaderを実際に使う新機能を追加するとき）のついでに直すのが自然。
3. **C章**は大規模リファクタなので、Explore/Planエージェントで事前調査してから着手すること。
4. 対応したら、この一覧から削除し、CLAUDE.md の Session Log に通常の形式で記録すること（🐛 fix / 🧹 cleanup / ✨ feat のいずれか、根拠と検証方法込み）。

### 第48パス（継続中 — C-1 VRApp 分離、スライス12）
perf 統計5点（updatePerformanceMonitor/getPerformanceStats/adjustQuality/reduceQuality/increaseQuality）を `vr/perfBudget.js`、browsing 接着剤3本（_attachManagedWindow/_onPanelGrabRequested/_teardownBrowsingSystems）を `browser/browsingSystems.js` に移動。テストが `prototype.X` を直接呼ぶシームは delegate 保持。VRApp 1,227→**1,143** 行（C-1 累計 −2,111）。lint 0 errors・1,343 tests・build・vr-boot 全 PASS。

### 第49パス（継続中 — C-1 VRApp 分離、スライス13 + バグ修正）
設定パネルライフサイクル（btnCtx/toggleSection/rebuild/redraw/dispose/announce/webPanelToggle）を `ui/settingsPanel.js`、ブラウザ操作（requestReaderProxyInput/clearBrowsingHistory/launchImmersiveVideo/navigate）を `browser/browserActions.js`、VR キーボード入力要求を `interaction/inputRouting.js`、OS a11y listeners・loadAudioAssets を `systemsLifecycle.js` に移動。**パス38 の抽出で `_disposeSettingsPanel` 本体が誤って削除され呼び出しのみ残存していた実バグ（_toggleSettingsSection→rebuild で TypeError）を発見・復元。** テストシーム（prototype.X 呼び出し4本）は delegate 保持。VRApp 1,143→**962** 行（C-1 累計 −2,292）。1,343 tests・lint 0 errors・build・vr-boot 全 PASS。

### 第50パス（継続中 — C-1 VRApp 分離、スライス14）
フレームループ trio（initialize 段階起動 / render / updateSystems 毎フレーム dispatch、計 ~150行）を `frameLoop.js` に抽出。`bind(this)` → `bind(app)` の捕捉と THREE import 追加を実施。VRApp 962→**826** 行（C-1 累計 −2,428 / 開始時 3,254 の 75% 削減）。残りは constructor(192・フィールド宣言)＋小メソッド群＋delegate 層のみ。1,343 tests・lint 0 errors・build 0.73s・vr-boot 全 PASS。

### 第51パス（継続中 — delegate 必要性監査）
40本の delegate 全走査: `dispose`/`render`/`getPerformanceStats` 等は app.js・frameLoop バインド・テストの実呼び出しありで生存。唯一の発見: setup×5＋initializeSystems の6 delegate は frameLoop 経由のみ → モジュール直接呼び出しに切替えて6本削除（setupControllers は setupStages 内部呼び出しも直接化 — vr-boot が `app.setupControllers is not a function` で捕捉、修正済）。VRApp 826→**801** 行（C-1 累計 −2,453）。1,343 tests・lint 0 errors・build・vr-boot 全 PASS。

### 第52パス（継続中 — テスト専用 delegate の削除）
「テストだけが参照する delegate」を摘出: `updateSystems`・`_setupOSAccessibilityListeners`・`_detachPanelLayer` は src 呼び出しゼロ → 規約に従いテストをモジュール直接呼び出し（frameLoop/systemsLifecycle/sessionLifecycle から import）に書き換えて delegate 3本削除。`render` は frameLoop が `bind` するため生存。VRApp 801→**789** 行（C-1 累計 −2,465）。1,343 tests・lint 0 errors・build・vr-boot 全 PASS。

### 第53パス（継続中 — 単一呼出 delegate の直接呼出化）
src 呼び出しが1箇所のみの delegate 9本（perf 4・snapTurn・onTeleportStart・onVRSessionStart・createSettingsPanel・navigate）を削除し、呼び出し側はモジュール関数を直接 import。`updateLocomotion`/`updateButtonInput`/`updateTeleport`/`updateHover`・`getPerformanceStats` はテストモック/公開APIのため保持（updateSystems 内の updateTeleport 直接化で7件失敗 → app.X 経由に復旧 = シーム確認）。VRApp 789→**756** 行（C-1 累計 −2,498）。1,343 tests・lint 0 errors・build・vr-boot 全 PASS。

### 第54パス（継続中 — 抽出残渣の清掃）
抽出で残った孤児 JSDoc 塊（削除メソッドのコメントのみ残存した断片群、~46行）を除去。新モジュール内で外部参照ゼロの `export` 9件を通常関数化（perfBudget×2・systemsLifecycle・sessionLifecycle・settingsPanel×5 — 規約: 内部のみ使用なら export 不要）。constructor(192行)は状態スキーマ宣言そのもので不可分＝C-1 の床に到達確認。VRApp 756→**710** 行（C-1 累計 −2,544 / 78% 削減）。1,343 tests・lint 0 errors・build・vr-boot 全 PASS。

### 第55パス（継続中 — 抽出後 import グラフの全再走査）
全 src モジュールの export × 実参照を再走査: 外部参照ゼロは `planeGeometry`（canvasMesh 内のみで使用）のみ → 通常関数化。それ以外の全 export は実参照あり。抽出シリーズ完了後のグラフは健全。

### 第57パス（継続中 — テスト死コード＋重複ブロック走査）
tests/ 走査で未使用 `makeScene` ヘルパー削除。src 重複ブロック走査で `isWorldVisible`（可視性親遡り）が GazeInteraction と inputRouting に同一実装で重複 → inputRouting 側に集約。残りの重複（canvas 生成・dispose 巡回パターン等）は3行未満の定型で統合価値なし。

### 第57–58パス（テスト死コード・重複ブロック・イディオム統合）
- 未使用 `makeScene` テストヘルパー削除
- `isWorldVisible` の同一実装を inputRouting に集約（GazeInteraction 側除去）
- `showCaption(app, text)` seam を新設（src/vr/caption.js）: `if (captionSystem && captionSystem.enabled) { captionSystem.show(...) }` の ~25箇所ガード定型を統一 — アナウンスの意図が統一され、将来のガード変更は1箇所で済む。複合ガード（`&& enableGazeDwell` 等）や複文ブロックは構造保持

### 第59パス
hapticFeedback ガード定型を `haptic(app, hand, pattern)` / `hapticBothHands(app, pattern)` seam（src/vr/haptics.js）に統一（6箇所）。`update()`/`setEnabled`/複文ブロック（hand 解決付き）は構造保持。残る `if (app.hapticFeedback)` は dispose 系のみで正しい。

### 第60パス（クリーンスキャン）
`if (app.X) { app.X.method() }` ガード定型を全走査: 残存は dispose 系（異種メソッドの teardown ループ — seam 化不可）と単発呼出のみ。`showVRToast` は既に delegate seam で統一済み、cross-modal 3系統（caption/haptic/toast）の呼出形は正規化完了。変更なし。

### 第61パス（単一ソース化違反の摘出 — 最重要発見）
「テストだけが参照する export」走査で11件検出、うち6件は**死んだ spec 定数と実コード内リテラルの二重定義**だった:
- WebPanel の `1024` リテラル×4 → `CHROME_CANVAS_W`、`PANEL_H*CHROME_H`/`PANEL_H*(1-CHROME_H)` 式複写×5 → `CHROME_M_H`/`CONTENT_M_H`
- settingsPanel の stepper `min:0.6,max:6.0` → `PANEL_DISTANCE_MIN/MAX`
- BookmarkPanel の `const PANEL_W = 1.2` → `BOOKMARK_PANEL_W` 単一ソース化
- 残り5件（canvasRegionToMetres/classifyTarget/worstCaseHeight/maxMeasureEmForFont/isSearchQuery）は spec テスト用の純粋ヘルパーで、テストへのインライン再実装は実行時幾何とのドリフトを招くため API として保持

### 第62パス（クリーンスキャン — マジックナンバー二重定義）
同一リテラルの跨ファイル複写を全走査（~50値）: 実違反はパス61で摘出済み（残存は全て無関係な同値 — 別面 palette の同色、defensive デフォルト（GazeInteraction dwellTime=1500 は settings 値とは別の defensive fallback、テストが裸 ctor で実使用）、JSDoc ミラー）。色 hex の跨 palette 一致は別 UI 面の偶然一致で統合価値なし。変更なし。

### 第63パス（canvas/texture 生成定型の統一）
`createElement('canvas')`+`CanvasTexture`+`configureUITexture`+`colorSpace` 定型が12箇所に散在 → `makeUICanvas(w, h, {srgb})` seam（canvasTexture.js）に統一（−35行）。忘れられがちな srgb 指定が明示オプション化され、将来の追加サイトは1行で済む。孤児 import（configureUITexture×6・THREE・WindowManager・ImmersiveVideo・onVRSessionStart・createHomeEnvironment）も連鎖除去し lint warnings を 97→94 に削減。

### 第64パス（クリーンスキャン — 構造定型・テストモック重複）
Mesh(PlaneGeometry+Material) 3連は material オプションが各サイトで異質（統合すると条件分岐化で価値密度負）。dispose 定型はリスナー解除/タイマー/破棄が各ブロック別物。テストの同名モック（makeCamera×4/makePanel×3 等）は各 SUT 向けの別形状で共有化不能。変更なし — コード面の構造定型走査は収束。

### 第65パス（計測軸 → 潜在バグ摘出）
bundle 計測中に発見: `initializeSystems` 抽出残滓 `new DevTools(this)` — ESM モジュール関数内の `this` は undefined のため dev 環境でのみ DevTools が壊れていた（`import.meta.env.DEV` ゲートのため vr-boot/unit テストのカバレッジ外）。`new DevTools(app)` に修正。抽出モジュール全体の `this` 残滓走査は他ゼロを確認。

### 第66パス（検証圏外経路の走査）
DEV/PROD ゲート経路を全走査: DEV 経路は DevTools のみ（パス65修正済み）、DevTools が参照する app API は `app.scene` のみで実在確認。PROD 経路（monitoring・SW 登録）は vr-boot がカバー済み。検証圏外コードは残存ゼロ。変更なし。

### 第67パス（クリーンスキャン — 依存グラフ構造）
全 import グラフの循環検出: **0 cycles — 完全な DAG**。ドメイン分離後も双方向依存なし（抽出モジュールは app を引数で受け取り逆参照しない設計が維持されている）。変更なし。

### 第67パス追記
`no-unreachable` eslint ルールが未設定だった検出ギャップを閉塞（error で有効化、違反0件）。今後 return/throw 後の死コードは lint で自動検出。

### 第68パス（lint ガードレール拡充）
死コード検出系ルール8種を評価 → 全て違反ゼロ。`no-useless-catch`/`no-useless-return`/`no-unused-private-class-members`/`prefer-const` を error で恒久有効化（将来の死コード混入を lint 時点で自動防止）。

### 第69パス（パブリックメソッド到達性 — −208行）
全クラスメソッドの呼出再走査で**ランタイム呼出ゼロの public API 11件**を摘出削除:
- `FFRSystem.setDynamicFFR`・`HandTracking.getPointingRay`・`SpatialAudio.loadAudio`（定義＋JSDoc例のみ、テスト参照すらゼロ）
- `HapticFeedback` の `createCustomPattern`/`simulateTexture`/`simulateImpact`/`proximityFeedback`（同上 — 実 API は playPattern 系のみ消費）
- テストのみ参照: `ComfortSystem.handleSnapTurn`（snap turn の実経路は inputRouting の `snapTurn()`）、`WindowManager.setBillboard`/`nudgeDistance`
- `VRApp.saveSettings` デッド delegate
- 連鎖: `setBillboard` 削除で `this.billboard` が恒偽化 → billboard ブランチ+フィールド除去

### 第70パス（delegate 再走査）
VRApp 残存 delegate を全監査 — 全てに実呼出ありを確認（テスト seam・公開 API・外部コールバック）。唯一の内部専用 `loadPersistedSettings` delegate を直接呼出化して削除 + `onVRSessionStart` 孤児 import 除去。

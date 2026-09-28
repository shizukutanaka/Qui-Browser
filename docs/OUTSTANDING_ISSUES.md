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

### C-3. Top Sites の視覚的スピードダイヤルタイル（**Session 75 で解決** — 描画先は BookmarkPanel 第3タブではなく新規タブページ）
- **対象**: `src/vr/browser/BookmarkPanel.js`
- **理由**: Session 16/17 でフレセンシーランキング機能自体（データ層・音声コマンド）は実装済みだが、視覚的な「よく使うサイト」タイル表示は未実装のまま。
- **解決（Session 75）**: BookmarkPanel にタブを足すのではなく、**新規タブの 'empty' 状態に Top Sites を描く**形で実現（Firefox/Chrome の新規タブページと同じ置き方。`topSitesLayout.js` の4列×最大8タイル + `hitTestTopSites` で dwell 選択 → navigate）。これにより元の「タブ追加でスクロール矢印ゾーンと衝突」という保留理由自体が不要になった。

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

- ~~voice '閉じてくれんですか'/'閉じてくれたまえ'/'閉じてもらってもいいですかね'/'閉じなさいって'/'閉じなってば'/'閉じるものね'/'閉じるわけです' が NO-MATCH~~ — **Session 199 で実装**（TAIL_TE XVII + 命令残置 + FR IX）
- ~~voice 'why dontcha close it'/"whyn't you"/'i command/order you to'/'i hereby request/ask that you'/'the move is to'/'best move is'/'be an angel and' が NO-MATCH~~ — **Session 199 で実装**（ENPRE VIII）
- ~~voice 'close it if you could possibly'/'please sir'/"if it's not too much trouble"/"if it isn't too much to ask"/'closing it is the way to go'/'closing it would be the move' が NO-MATCH~~ — **Session 199 で実装**（EN語尾）
- ~~voice 'デカくして'/'小さめにして'/'読み上げ止めて'/'どこ読んでる' が NO-MATCH~~ — **Session 199 で実装**（リテラル）
- ~~voice '閉じるところを見たい' が describe 誤ルート — 観察依頼を除外修正~~
- ~~voice 'bet/wager you cant close it' が trouble 誤ルート — 挑発枠を除外修正~~
- ~~voice '閉じていくべきだ/くるべき' のていく・てくる方向尾が NO-MATCH~~
- ~~voice 'turn out the lights on it' が brightness 誤ルート — 終了メタファを除外修正~~
- ~~voice '閉じてごらんなさい/ご覧になって' のてごらん受益命令尾が NO-MATCH~~
- ~~voice '閉じるのが理に適ってる/理屈だ' の妥当性名詞尾が NO-MATCH~~
- ~~voice '閉じてばかりではだめ' の限定反復禁止報告が NO-MATCH → negate 追加~~
- ~~voice '閉じてならない/さえすればいい' の促動・譲歩尾が NO-MATCH~~
- ~~voice '閉じておいたので/おきましたから' のておいた報告・理由尾が NO-MATCH~~
- ~~voice '閉じてゆくべき/ゆけばいい' のてゆく方言尾が NO-MATCH~~
- ~~voice '閉じてしまったようです/ところです' の完了報告尾が NO-MATCH~~
- ~~voice '閉じるのがワークフローだ/標準だ' の手順名詞尾が NO-MATCH~~
- ~~voice '閉じるのが進め方だ' の navigate 誤ルート~~
- ~~voice '閉じてもいいかしらね' のもいいか残置が NO-MATCH~~
- ~~voice '閉じるのが流儀だ/進め方だ' の流儀名詞尾が NO-MATCH~~
- ~~voice '閉じてくださいよお' の長音残置が NO-MATCH~~
- ~~voice '閉じてしまおうぞ/ね' のしまおう残置が NO-MATCH~~
- ~~voice '閉じるのが任意だ/裁量だ/お任せだ' の裁量名詞尾が NO-MATCH~~
- ~~voice '閉じておくのを忘れた' の忘れ報告が NO-MATCH（実行化）~~
- ~~voice '閉じておくと良かった' のおくと良かった尾が NO-MATCH~~
- ~~voice '閉じるのが礼式だ/義理だ' の礼式名詞尾が NO-MATCH~~
- ~~voice '閉じてくれませんかねえ' のくれません残置が NO-MATCH~~
- ~~voice '閉じておくのが吉だ/上策だ' のおく+名詞複合尾が NO-MATCH~~
- ~~voice '閉じるのが気遣いだ/親切だ' の配慮名詞尾が NO-MATCH~~
- ~~voice '閉じてみるのがいいかも' のみる判断尾が NO-MATCH~~
- ~~voice '閉じるのが信念だ/譲れない線だ' の信念名詞尾が NO-MATCH~~
- ~~voice '閉じてしまうのが最善/得策' のしまう判断尾が NO-MATCH~~
- ~~voice '閉じるのが恒例だ/しきたりだ' の慣習名詞尾が NO-MATCH~~
- ~~voice '閉じておくに限ります' のおく限り尾が NO-MATCH~~
- ~~voice '閉じるのが本道だ/真っ当だ' の正道名詞尾が NO-MATCH~~
- ~~voice '閉じておけば大丈夫です/正解だ' のおけば安心尾が NO-MATCH~~
- ~~voice '閉じるのが体面だ/面目だ' の体面名詞尾が NO-MATCH~~
- ~~voice '閉じてほしいものかな' の negate 誤ルート~~
- ~~voice '閉じてくるべきだ' のくる方向尾が NO-MATCH~~
- ~~voice '閉じるのが好機だ/旬だ' の好機名詞尾が NO-MATCH~~
- ~~voice '閉じておくわけです' のおく断定尾が NO-MATCH~~
- ~~voice '閉じるのが矜持だ/誇りだ' の矜持名詞尾が NO-MATCH~~
- ~~voice '閉じてもらいますね' のもらいます残置が NO-MATCH~~
- ~~voice '閉じてくるしかない' のくる残置が NO-MATCH~~
- ~~voice '閉じるのが極意だ/骨子だ' の極意名詞尾が NO-MATCH~~
- ~~voice '閉じるのが勘所だ/狙い目だ' の勘所名詞尾が NO-MATCH~~
- ~~voice '閉じてくれませんだろうか' のくれません残置が NO-MATCH~~
- ~~voice '閉じるのが要旨だ/旨趣だ' の要旨名詞尾が NO-MATCH~~
- ~~voice '閉じておこうかと/おいてもらえますか' のておき残置が NO-MATCH~~
- ~~voice '閉じるのが心髄だ/奥義だ' の心髄名詞尾が NO-MATCH~~
- ~~voice '閉じてみるとするか/くれませんかしら' のみる/くれません残置が NO-MATCH~~
- ~~voice '閉じるのが骨髄だ/精髄だ' の骨髄名詞尾が NO-MATCH~~
- ~~voice 'i would ask of you|urge you to' の懇願枠が NO-MATCH~~
- ~~voice 'id be eternally|deeply indebted if youd' の indebted 変体が NO-MATCH~~
- ~~voice 'id be most|ever so obliged if youd' の obliged 変体が NO-MATCH~~
- ~~voice 'would you do me the courtesy|honor of' の名誉枠が NO-MATCH~~
- ~~voice 'i would be most grateful if youd' の長形感謝枠が NO-MATCH~~
- ~~voice 'id be indebted|eternally grateful if youd' の重感謝枠が NO-MATCH~~
- ~~voice 'wed be grateful if youd' の複数感謝枠が NO-MATCH~~
- ~~voice 'id really appreciate it if youd' の感謝依頼枠が NO-MATCH~~
- ~~voice 'how say you|what do ya say we' の提案枠が NO-MATCH~~
- ~~voice 'id be grateful|thankful if youd' の感謝条件枠が NO-MATCH~~
- ~~voice 'could i trouble you for a close' の依頼枠が NO-MATCH~~
- ~~voice 'would you be sweet enough to' の形容詞依頼枠が NO-MATCH~~
- ~~voice '閉じるのが利益だ/好都合だ' の利益名詞尾が NO-MATCH~~
- ~~voice 'id be honored|thrilled if youd' の形容詞条件枠が NO-MATCH~~
- ~~voice 'if you could bring yourself to' の自己条件枠が NO-MATCH~~
- ~~voice 'if youd be a dear/pal and' の条件呼びかけ枠が NO-MATCH~~
- ~~voice '閉じておくのも手かも/ありかと' のおくのも残置が NO-MATCH~~
- ~~voice '閉じるのが必須だ/不可欠だ' の必須名詞尾が NO-MATCH~~
- ~~voice 'thank you kindly for closing it' の先感謝スワップが NO-MATCH~~
- ~~voice '閉じてくれればと思う/願う' のくれればと残置が NO-MATCH~~
- ~~voice '閉じるのが手際だ/手っ取り早い' の手際名詞尾が NO-MATCH~~
- ~~voice 'im begging you,/im down on my knees' の懇願裸形が NO-MATCH~~
- ~~voice '閉じておくしかないんだ/あげるのが筋だ' のおくしか・あげる残置が NO-MATCH~~
- ~~voice '閉じるのが選択肢だ/分岐点だ' の選択名詞尾が NO-MATCH~~
- ~~voice 'the sooner the better/no time to lose' の急迫枠が NO-MATCH~~
- ~~voice '閉じちゃってね/じゃって' のちゃって・じゃって残置が NO-MATCH~~
- ~~voice '閉じてくれぞ/くれわ' のくれ方言残置が NO-MATCH~~
- ~~voice '閉じるのが心がけだ/覚悟です' の心がけ名詞尾が NO-MATCH~~
- ~~voice 'while youre in there' のついで枠残置が NO-MATCH~~
- ~~voice '閉じておくんや/おくんですから' の関西おくんや残置が NO-MATCH~~
- ~~voice '閉じるのが手筈だ/決まりだ' の手筈名詞尾が NO-MATCH~~
- ~~voice 'when you get a free moment/second' の時間余裕枠残置が NO-MATCH~~
- ~~voice '閉じてみるわよ/もろうてええか' のみるわ・もろうて残置が NO-MATCH~~
- ~~voice '閉じるのが件だ/話です' の件名詞尾が NO-MATCH~~
- ~~voice 'id be much obliged if youd' の感謝条件枠が NO-MATCH~~
- ~~voice '閉じてくださいませね/ほしくてな' のくださいゃ・ほしくて残置が NO-MATCH~~
- ~~voice '閉じるのが理だ/判明だ' の理名詞尾が NO-MATCH~~
- ~~voice 'herewith/i bid you' の正式指令枠が NO-MATCH~~
- ~~voice '閉じておいてね/てやってよ' のおいたら・やって残置が NO-MATCH~~
- ~~voice '閉じるのが手段だ/手立てだ' の手段名詞尾が NO-MATCH~~
- ~~voice 'out of deference to me' の敬意枠残置が NO-MATCH~~
- ~~voice '閉じてしまえばいいよ/てまえよ' のしまえば・まえ残置が NO-MATCH~~
- ~~voice '閉じるのが仕事だ/頼みだ' の仕事名詞尾が NO-MATCH~~
- ~~voice 'do us both a favor and' が裸 'do' に先食いされていた~~
- ~~voice '閉じておくんだよ/くれるんじゃないか' のおくのだ・くれるんじゃ残置が NO-MATCH~~
- ~~voice '閉じるのが処置だ/処方だ' の処置名詞尾が NO-MATCH~~
- ~~voice 'be a peach/sport and' の呼びかけ懇願残置が NO-MATCH~~
- ~~voice '閉じておけば安心/てあるはずです' のおけば・てある残置が NO-MATCH~~
- ~~voice '閉じるのが結論だ/真髄だ' の解名詞尾が NO-MATCH~~
- ~~voice 'for pitys sake/for christs sake' の嘆願枠残置が NO-MATCH~~
- ~~voice '閉じておくよう進める' の navigate 誤ルート・'はいかがなものか' の negate 誤ルート~~
- ~~voice '閉じるのが初手だ/取っ掛かりだ' の初手名詞尾が NO-MATCH~~
- ~~voice 'do us the service of/bless me by' の恩恵枠が NO-MATCH~~
- ~~voice '閉じておくが吉/みろう' のおく確定・みろ方言残置が NO-MATCH~~
- ~~voice '閉じるのが秘策だ/隠し玉だ' の秘策名詞尾が NO-MATCH~~
- ~~voice 'final answer/case closed' の評決枠が NO-MATCH~~
- ~~voice '閉じてみるべし/くれんよ' のてみる・くれん残置が NO-MATCH~~
- ~~voice '閉じるのが本命だ/最有力だ' の本命名詞尾が NO-MATCH~~
- ~~voice '閉じてなって/とくべき' のてな・てとく残置が NO-MATCH~~
- ~~voice '閉じるのが王道だ/基本だ' の常套名詞尾が NO-MATCH~~
- ~~voice 'carpe diem/strike while the iron is hot' の今こそ枠が NO-MATCH~~
- ~~voice '閉じてくれの/くれど/かいの' のくれ・かい方言残置が NO-MATCH~~
- ~~voice '閉じるのが決意だ/核心だ' の決意名詞尾が NO-MATCH~~
- ~~voice 'on my honor/as god is my witness' の名誉誓い枠が NO-MATCH~~
- ~~voice '閉じてもらいなさい/もらうがよい' のもらい敬語残置が NO-MATCH~~
- ~~voice '閉じるのが始末だ/仕納めだ' の始末名詞尾が NO-MATCH~~
- ~~voice 'i implore you/i beseech thee' の懇願枠が NO-MATCH~~
- ~~voice '閉じてよろしいです/ねばならん' のよろしい・ねば残置が NO-MATCH~~
- ~~voice '閉じるのが急務だ/火急だ' の急務名詞尾が NO-MATCH~~
- ~~voice 'trust me/believe you me' の信頼誓い枠が NO-MATCH~~
- ~~voice '閉じてあるといい/もらうもん' のてある・てもらう残置が NO-MATCH~~
- ~~voice '閉じるのが合図だ/区切りだ' の契機名詞尾が NO-MATCH~~
- ~~voice 'pretend i said/indulge me' の仮定・迎合枠が NO-MATCH~~
- ~~voice '閉じておこうね/おこうかな' のおこう口語尾が NO-MATCH~~
- ~~voice '閉じるのが成り行きだ/締めだ' の結果名詞尾が NO-MATCH~~
- ~~voice 'be done with it/that settles it' の決着枠が NO-MATCH~~
- ~~voice '閉じてやるわい/かまわないよ' のやる・かまわない尾が NO-MATCH/negate誤ルート~~
- ~~voice '閉じるのが任務だ/役目だ' の任務名詞尾が NO-MATCH~~
- ~~voice 'say when/have at it' の承諾枠が NO-MATCH~~
- ~~voice '閉じてねって/てくれよう' のてね・てくれ長形尾が NO-MATCH~~
- ~~voice '閉じるのが助言だ/指針だ' の助言名詞尾が NO-MATCH~~
- ~~voice 'give it a rest/pull the plug' の打ち切り比喩枠が NO-MATCH~~
- ~~voice 'im ready for you to/id welcome you' の歓迎枠が NO-MATCH~~
- ~~voice 'as a matter of housekeeping/speak the word' の整理枠が NO-MATCH~~
- ~~voice 'lets have it closed/id have it shut' の have-it-done 目的格枠が NO-MATCH~~
- ~~voice 'lets be done with it/write it off' の片付け枠が NO-MATCH~~
- ~~voice '閉じてあるべきだ/おいたほうがいい' のてある・ておいた尾が NO-MATCH~~
- ~~voice 'lets wrap this up and/put it to bed' の巻き締め枠が NO-MATCH~~
- ~~voice '閉じてしまえって/てみろよ' のしまえ・みろ命令尾が NO-MATCH~~
- ~~voice '閉じるのが鉄則だ/我が家の方針' の方針名詞尾が NO-MATCH~~
- ~~voice 'it is overdue to/closing is past due' の遅延報告枠が NO-MATCH~~
- ~~voice '閉じておくべきかと思います/おくしかないかも' のておく報告・決断尾が NO-MATCH~~
- ~~voice '閉じる目的です/ための指示です' の目的・理由名詞尾が NO-MATCH~~
- ~~voice 'id be ever so grateful/id owe you big time' の感謝・恩義条件枠が NO-MATCH~~
- ~~voice '閉じてくださいませませ/くださいなさい' のください命令句残置が NO-MATCH~~
- ~~voice '閉じるのが効率的だ/賢いやり方' の効率・利得名詞尾が NO-MATCH~~
- ~~voice 'do me the service of/oblige me with a closing' の厚意・恩恵前置枠が NO-MATCH~~
- ~~voice '閉じておけ/おけよ' のておけ命令が裸 おけ 否定パターンで negate 誤ルート~~
- ~~voice 'お閉じいたします/お閉じお願いします' のお+ます語幹謙譲命令が NO-MATCH~~
- ~~voice 'at the earliest opportunity/next chance you get' の機会時前置枠が NO-MATCH~~
- ~~voice '閉じてきてくれ/きなさい' のてきて方向命令が NO-MATCH~~
- ~~voice '閉じる意向です/つもりで進める' の意図・方針名詞尾が NO-MATCH（進めるは navigate 誤ルート）~~
- ~~voice 'if it is within your power/if that works for you' の能力・都合前置枠が NO-MATCH~~
- ~~voice '閉じる段取りで/手はずで' の手配・段取尾が NO-MATCH~~
- ~~voice 'if you see fit/should you feel so inclined' の適意・意向前置枠が NO-MATCH~~
- ~~voice '閉じてしまうことを勧める/しまうことにしようか' のてしまう判定尾が NO-MATCH~~
- ~~voice '閉じるのが当然だ/お作法だ' の慣習名詞尾が NO-MATCH~~
- ~~voice 'it is your job to/it is high time you' の義務・時宜名詞枠が NO-MATCH~~
- ~~voice '閉じていただけぬものか' が拒否修辞として negate 誤ルート~~
- ~~voice '閉じてもらっております/もらうことになります' のてもらう謙譲残置が NO-MATCH~~
- ~~voice 'out of the kindness of your heart/indulge me by' の厚意前置枠が NO-MATCH~~
- ~~voice '閉じてくれるかなあ/くれればそれで足りる' のくれ推量・仮定尾が NO-MATCH~~
- ~~voice '閉じておいてもらえば/おかせてくれ' のておく受益・許可残置が NO-MATCH~~
- ~~voice 'im assuming you can/god willing, close it' の推量・希求前置枠が NO-MATCH~~
- ~~voice '閉じてくれと頼みたい/くれそうですか' のくれ引用・期待尾が NO-MATCH~~
- ~~voice '閉じるように頼んでる' のよう言ってる進行依頼が NO-MATCH~~
- ~~voice 'any way you could/in case you can close it' の可能性前置枠が NO-MATCH~~
- ~~voice '閉じておくのもありだ/おきなよ' のておく残置が NO-MATCH~~
- ~~voice 'it needs to get closed/a closure is required' の義務+get受動が NO-MATCH~~
- ~~voice 'remind me to close it' が defer でなく即実行~~
- ~~voice '閉じまい' が lookbehind 拡張でルート消失~~
- ~~voice '閉じなさってください/なさいって言って' のなさい系拡張命令が NO-MATCH~~
- ~~voice '閉じちまいな' が negate 'まい' に誤ルート~~
- ~~voice 'note to self/remind me to/someone close it' が NO-MATCH~~
- ~~voice '閉じてくれないんだけど' が trouble に誤ルート~~
- ~~voice '閉じるものと考えられます' が help に誤ルート~~
- ~~voice 'i think it needs to be closed' の評価報告依頼が NO-MATCH~~
- ~~voice '閉じてあげるわよ/てやるんで' のあげる/やる受益尾が NO-MATCH~~
- ~~voice '閉じるならよろしい/のであれば幸いです' の条件尾が NO-MATCH~~
- ~~voice 'if you could see your way to/you would do well to' が裸前置に先食いされて NO-MATCH~~
- ~~voice 'close it, for my benefit/as a gesture of goodwill' の語尾残置が NO-MATCH~~
- ~~voice '閉じてちょうだいなさい/くださいまして' の受益命令残置が NO-MATCH~~
- ~~voice '閉じておきたいところです/おけばよかった' のておき残置が NO-MATCH~~
- ~~voice '閉じるという次第です/のが目的です' の理由・目的尾が NO-MATCH~~
- ~~voice 'would you be so kind as to/may i ask a favor of you' が裸前置に先食いされて NO-MATCH~~
- ~~voice 'close it, for my sake/thank you in advance' の語尾残置が NO-MATCH~~
- ~~voice '閉じてはどうかと思います/は如何かと' のては提案尾が NO-MATCH~~
- ~~voice '閉じてもらいたく存じ上げます/くれませんことでしょうか' の受益深敬語が NO-MATCH~~
- ~~voice '閉じるようにしておいて' のdict+おく複合が NO-MATCH~~
- ~~voice 'i am writing to request that you/per my request' の書面調前置が NO-MATCH~~
- ~~voice 'close it, thank you in advance' の前倒し感謝語尾が NO-MATCH~~
- ~~voice '閉じられとく/閉じられると嬉しい/閉じられたい' の受け身依頼残置が NO-MATCH~~
- ~~voice '閉じてもろたら/もらうんです' の受益方言残置が NO-MATCH~~
- ~~voice '閉じたまいよ/たまえか' の命令形が negate/NO-MATCH~~
- ~~voice 'the ask is that you X/all i want is for you to' の前置残置が NO-MATCH~~
- ~~voice 'close it, that would be swell/if humanly possible' の語尾残置が NO-MATCH~~
- ~~voice '閉じるべきであります/べきと心得ております' の正式宣言尾が NO-MATCH~~
- ~~voice '閉じることを要請いたします/ことを期待しております' の koto-demand が NO-MATCH~~
- ~~voice '閉じてなさいませ/くれはりますか/もらえると' の受益残置が NO-MATCH~~
- ~~voice 'i want it gone/shut' の目的格置換が NO-MATCH~~
- ~~voice 'close it, i owe ya/youll be doing me a favor' の語尾残置が NO-MATCH~~
- ~~voice '閉じしてくれ/閉じしといて' の す語幹 irregular 受益が NO-MATCH~~
- ~~voice '閉じますれば/まする/ませうか' の masu 条件・残置尾が NO-MATCH~~
- ~~voice '閉じようと思うので/ようかと思っています' の意向報告複合尾が NO-MATCH~~
- ~~voice 'lemme get you to/whatcha gonna do is' の口語前置が NO-MATCH~~
- ~~voice 'close it, if ya dont mind/whenever you get a sec' の語尾残置が NO-MATCH~~
- ~~voice '閉じちまって/じまって' の しまう縮約+受益が NO-MATCH~~
- ~~voice '閉じるべきである/べきだと思います' の義務宣言尾が NO-MATCH~~
- ~~voice '要するに閉じて/つまるところ閉じて' の要約前置詞が NO-MATCH~~
- ~~voice 'why havent you closed it yet' の haven't-you 叱責依頼が NO-MATCH~~
- ~~voice 'it remains open/its yet to be closed' の開放報告が NO-MATCH~~
- ~~voice '閉じちゃってくれ/閉じちゃうのが吉' の ちゃ受益・判定尾が NO-MATCH~~
- ~~voice '閉じとくべきかな' が help 誤ルート（とくべき 依頼尾）~~
- ~~voice '閉じることになっている/ことにしていた' の dict aspect-report 尾が NO-MATCH~~
- ~~voice 'i dont suppose you could/i take it youll' の EN hedge-question が negate/NO-MATCH~~
- ~~voice 'close it, i would be obliged' の EN 語尾報告が NO-MATCH~~
- ~~voice '閉じてもらわないと困る/閉じるべくお願いする' の義務・目的尾が NO-MATCH~~ — **Session 214 で実装**
- ~~voice 'i should be grateful if you'/'i solicit your closing of it' のEN感謝枠・gerund swap が NO-MATCH~~ — **Session 214 で実装**
- ~~voice '閉じてもらうよう頼む/閉じるんですって' の伝達依頼・ん-particle 残置が NO-MATCH~~ — **Session 213 で実装**
- ~~voice 'i beseech you please'/'would you do the honors and'/'make me happy' のEN依頼枠・語尾が NO-MATCH~~ — **Session 213 で実装**
- ~~voice '閉じてくれんまいか/いただけますものか' の受益・強願望形が誤ルート/NO-MATCH~~ — **Session 212 で実装**
- ~~voice '閉じるんぞ/んけ/んやぞ' の関西ん-particle 尾が NO-MATCH~~ — **Session 212 で実装**
- ~~voice 'i humbly request that you'/'i enjoin you to'/'you know you want to' のEN厳格依頼・語尾が NO-MATCH~~ — **Session 212 で実装**
- ~~voice '閉じられないかな/閉じられてもいい' の受け身依頼形が NO-MATCH~~ — **Session 211 で実装**
- ~~voice '閉じなきゃいけませんね/ねばならぬ' の義務残置が NO-MATCH~~ — **Session 211 で実装**
- ~~voice 'i must ask that you close it'/'do you care to close it' のEN依頼前置が NO-MATCH~~ — **Session 211 で実装**
- ~~voice '閉じるほうが筋/がベター/ことは必須' の評価名詞系が NO-MATCH~~ — **Session 210 で実装**（FR XX ほうが/こと評価）
- ~~voice 'i insist/urge/petition you to'・'may/could i have you' が NO-MATCH/help 誤ルート~~ — **Session 210 で実装**（ENPRE XIX + help lookahead `have you`）
- ~~voice 'close it pretty please with a cherry on top'/'on your own time' が NO-MATCH~~ — **Session 210 で実装**（EN接尾 XIX）
- ~~voice '閉じてくれようか/くれるさ'/'もらうべく/のみ'/'おいていただきます' の受益残置が NO-MATCH~~ — **Session 209 で実装**（TAIL_TE XXVII）
- ~~voice '閉じなさんし/なさいまし'/'閉じぃ' の命令残置が NO-MATCH~~ — **Session 209 で実装**（なさい方言 + 母音伸ばしリテラル）
- ~~voice '閉じると言ったはず' が trouble 誤ルート・'i call upon you to' が device-apps 誤ルート~~ — **Session 209 で解消**（`(?<!言っ)` + `call upon` 除外）
- ~~voice '閉じてくれちゃったら/ちゃおう'/'もらうに限る/べきかな/しかない'/'いただくに限る'/'もいいかと(存じます)' の受益残置が NO-MATCH~~ — **Session 208 で実装**（TAIL_TE XXVI）
- ~~voice '閉じるままにして/ついでに/がてら/際に/時点で/ようにしといて' の dict 残置が NO-MATCH~~ — **Session 208 で実装**（FR XVIII）
- ~~voice 'i demand/require you to'/'provided/providing/assuming'/'on the condition that'/'in exchange for' が NO-MATCH~~ — **Session 208 で実装**（ENPRE XVII）
- ~~voice '閉じてもらうべきかな' が help 誤ルート・'if you would be so good' が `if you would` 先食い~~ — **Session 208 で解消**（help lookbehind + 最長一致）
- ~~voice '閉じてもらう方向で/ことで'/'閉じていただければ幸甚です'/'もらえますでしょうかね' の受益残置が NO-MATCH~~ — **Session 207 で実装**（TAIL_TE XXV）
- ~~voice '閉じることで/ことにより/こととします/ことになります'/'のですがね'/'のもありな気がする'/'んでしょうか/んだろう' の dict 残置が NO-MATCH~~ — **Session 207 で実装**（FR XVII）
- ~~voice 'do you think you can/we could'/'say we'/'hows about we'/'why do we not'/'lets go for'/'supposing you could' が NO-MATCH~~ — **Session 207 で実装**（ENPRE XVI）
- ~~voice '閉じてみぃ/みい/みようや/みるわい'/'てしまいな/しまうがよい'/'ておくがよい/んじゃ/のがいい'/'おけばいい' の残置が NO-MATCH~~ — **Session 206 で実装**（TM/TAIL_TE XXIV）
- ~~voice '閉じときな/ときんしゃい/とけば(いい)'/'閉じちゃいな/ちゃうといい/べき/がよろしい' が NO-MATCH~~ — **Session 206 で実装**
- ~~voice '閉じるものだな/ですが'/'んすよ/ね/けど/が'/'がいいのでは'/'わけね/さ'（ack誤ルート）の dict 残置が NO-MATCH/誤ルート~~ — **Session 206 で実装**（FR XVI）
- ~~voice 'here's a thought/what you do'/'picture|envision it closed'/'the goal|aim|objective is to'/'mission|goal|task close it'/'step one|first step'/'the ask is' が NO-MATCH~~ — **Session 206 で実装**（ENPRE XV）
- ~~voice '閉じてくれよな/よわ'/'くれんかい/くれんけ/くれんね'/'もらおうかな/かね'/'くださいませんかい/かなあ' の受益残置が NO-MATCH~~ — **Session 205 で実装**（TAIL_TE XXIII）
- ~~voice '閉じるってさ/とかさあ/んではないか/んじゃないかなあ/んですかね/のでよろしいか/のもいいかもね/べきと思います' の dict 残置が NO-MATCH~~ — **Session 205 で実装**（FR XV）
- ~~voice 'i think/believe/feel (like) you should|could X'/'it seems like'/'figure/reckon/guessing/bet/suspect/trust/clearly you can'/'you probably should'/'might/may as well' が NO-MATCH~~ — **Session 205 で実装**（ENPRE XIV）
- ~~voice '閉じてくださいましょう/ませんこと/ませか'/'くれませんかなあ'/'いただきたく存じます'/'いただけますと幸いでございます' 等の敬語受益残置が NO-MATCH~~ — **Session 204 で実装**（TAIL_TE XXII）
- ~~voice '閉じるんだよねえ/のだよ/のですが'/'閉じるものですわ/かしら/と思う'/'閉じるべきところです' の dict 残置が NO-MATCH~~ — **Session 204 で実装**（FR XIV）
- ~~voice '閉じようか/かね/かなと'/'閉じましょうよ/ねえ/ましょ' の意向残置が NO-MATCH~~ — **Session 204 で実装**（VOL尾 + FR）
- ~~voice 'i would appreciate (it) if you could'/'i beg/beseech/entreat/implore you to'/'pray tell'/'as a favor/courtesy/kindness'/'do us a favor' が NO-MATCH~~ — **Session 204 で実装**（ENPRE XIII）
- ~~voice '閉じてくれませんな/よ'/'閉じてもらうわよ/の/がな'/'閉じてくださいねえ/よね/なあ'/'閉じていいんだよ/いいわけ/いいんよ/いいのさ'/'閉じてよかったかな'/'閉じてくれるの/が' の受益・許可残置が NO-MATCH~~ — **Session 203 で実装**（TAIL_TE XXI）
- ~~voice '閉じるもん/もんだ/もんね'/'閉じるんだからさ/んだわ/んですよね'/'閉じるしかないわ'/'閉じるとかさ' の dict 残置が NO-MATCH~~ — **Session 203 で実装**（FR XIII）
- ~~voice '閉じよって'/'閉じい' の命令残置が NO-MATCH~~ — **Session 203 で実装**
- ~~voice 'mind closing it real quick'/'we should/could close it'/'i suggest (you) close it'/'closing it works (for me)'/'close it for me plz' が NO-MATCH~~ — **Session 203 で実装**（ENPRE XII + 語尾）
- ~~voice '閉じてくれんけん'/'くれんさい'/'もらおか'/'もらいましょ'/'おくんなまし'/'閉じては' の受益・方言残置が NO-MATCH~~ — **Session 202 で実装**（TAIL_TE XX）
- ~~voice '閉じるのが常道'/'閉じるが吉'/'閉じるんだから'/'閉じるので'/'閉じるんす'/'閉じるがいいさ'/'閉じることを所望'/'閉じることを希望' が NO-MATCH~~ — **Session 202 で実装**（FR XII）
- ~~voice '閉じようよ'/'閉じようぞ'/'閉じようかい'/'閉じてみよ'/'閉じてみようよ'/'閉じちゃってよ' が NO-MATCH~~ — **Session 202 で実装**（VOL尾/TM/ちゃ残置）
- ~~voice 'can ya close it'/'be a pal and close it'/'pop it closed'/'close it when you get a sec'/'it needs a closing'/'the tab requires closing'/'the tab is still open close it' が NO-MATCH~~ — **Session 202 で実装**（ENPRE XI + swap + 語尾）
- ~~voice '閉じてくれるのかな'/'くれませんこと'/'くれるはず'/'もらおうかね'/'もらうけん'/'もらうばい'/'くれたる'/'くださいますように'/'くださるまいか' の受益残置が NO-MATCH~~ — **Session 201 で実装**（TAIL_TE XIX）
- ~~voice '閉じるのが順当'/'ほうが無難だ'/'しかないじゃん'/'ことに限る'/'に決まってる'/'一択'/'閉じましょうね'/'閉じるしかあるまい' が NO-MATCH~~ — **Session 201 で実装**（FR XI）
- ~~voice '閉じておしまい'/'閉じてしまえと'/'閉じーや'/'閉じたらどうかね'/'閉じさせていただきたいんです'/'閉じさせてくれんか' が NO-MATCH~~ — **Session 201 で実装**（TAIL_TE/たら/SE_TAIL）
- ~~voice 'can you just close it'/'do yourself a favor and close it'（help奪取）/'get on it close it'/"i'm asking you to close it"/'needs to be closed'/'the tab wants closing'/'close it for petes sake' が NO-MATCH~~ — **Session 201 で実装**（ENPRE X + `do \b` lookahead + 語尾）
- ~~voice '閉じてくれんのか'/'閉じてもらうよ'/'閉じてもらっときたい'/'閉じてくださいなよ'/'閉じてくだされよ'/'閉じてやってもらおうか'/'閉じてこそ'/'閉じていいんちゃう'/'閉じてええんとちゃう' の受益・関西残置が NO-MATCH~~ — **Session 200 で実装**（TAIL_TE XVIII）
- ~~voice '閉じるのも一手だ'/'のも選択肢の一つだ'/'べきところだ'/'ほうが楽'/'閉じたほうが早くない' が NO-MATCH~~ — **Session 200 で実装**（FR X + た→て規則）
- ~~voice '閉じさせてもらうよ'/'閉じさせてくれますように'/'お閉じなさいませ'/'さえ閉じればいい'/'なあ閉じて' が NO-MATCH~~ — **Session 200 で実装**（SE_TAIL/敬語尾/prefix）
- ~~voice 'am i asking too much to close it'/'too much to ask you to'/'would it be asking too much'（help誤ルート）/'just this once close it'/'see to closing it'/'make sure you close it'/'youre gonna close it'/'you shall close it'/'the tab needs closing'/'it should get closed'/'this wants closing' が NO-MATCH~~ — **Session 200 で実装**（ENPRE IX + lookahead 除外 + swap 拡張）
- ~~voice '閉じてばかり'/'まだ開いてる'/'なあ聞いて' が NO-MATCH~~ — **Session 200 で実装**（リテラル：trouble/describe-tab/say-again）
- ~~voice '閉じてくれないかしら'/'閉じてもらいましょうよ'/'閉じてくれればそれでいい'/'閉じてやるぞ'/'閉じてくれうるか' の受益残置が NO-MATCH~~ — **Session 198 で実装**（TAIL_TE XVI）
- ~~voice '閉じちゃいなさいよ'/'閉じちゃうのも悪くない'/'閉じちゃってもかまわない'/'閉じとくといい'/'閉じとかないと' のちゃ/とく残置が NO-MATCH~~ — **Session 198 で実装**
- ~~voice '閉じるのが一番だよ'/'閉じるのが得策だ'/'閉じることでいい'/'閉じるならOK'/'閉じたらよろしいでしょうか'/'閉じたらいいですよ' が NO-MATCH~~ — **Session 198 で実装**（FR VIII + たら残置）
- ~~voice "if you don't mind closing it"/'would you terribly mind'/"i'd be much obliged if you"/'i would hate to ask but'/'not to impose but'/'sorry to bother but'/'pardon me but'/'forgive me for asking but'/"i'll thank you to"/'it would do no harm to'/"there's no harm in"/'one option is to'/'closing it is an option'/'close it thank you kindly'/'close it would you mind awfully' が NO-MATCH~~ — **Session 198 で実装**（ENPRE VII + 語尾）
- ~~voice 'タブ畳んで'/'声をもっと小さく'/'最高ですね' が NO-MATCH~~ — **Session 198 で実装**（リテラル）
- ~~voice '閉じてくれますの'/'閉じてほしいんだよね'/'閉じてもらえると助かる'/'閉じてくれてもいいんです'/'閉じてもらっちゃおう'/'閉じておきたいところ'/'閉じておきましょうかね' の受益残置尾が NO-MATCH~~ — **Session 197 で実装**（TAIL_TE XV）
- ~~voice '閉じるのもいいんじゃない'/'閉じるのが無難だ'/'閉じるのがセオリーだ'/'閉じるという選択もある'/'閉じるとしておく'/'閉じるでよろしいか'/'閉じる方向でいこう'/'閉じる案で'/'閉じる作戦で' のdict提案・方針残置が NO-MATCH~~ — **Session 197 で実装**（FR VII）
- ~~voice '閉じちゃうのもありか'/'閉じちゃえば済む話'/'閉じちゃって結構です'/'閉じとくのがいい'/'閉じときなさいよ'/'閉じとこうかなと思って' のちゃ/とく残置が NO-MATCH~~ — **Session 197 で実装**（ちゃ/とく push 拡張）
- ~~voice 'i was hoping/kinda hoping/had hoped/would have thought you could'、'supposedly/apparently/presumably/obviously you can'、'do the honors and'、'have the courtesy to'、'extend/grant/afford me the courtesy/favor of'、'oblige me by'、'humor me and' が NO-MATCH~~ — **Session 197 で実装**（ENPRE VI）
- ~~voice 'closing it would be great'/'having it closed would help'/'the tab closing would be ideal'/'i need it closed'/'i want that closed' の gerund/受動残置が NO-MATCH~~ — **Session 197 で実装**（gerund主語スワップ + having/getting 拡張）
- ~~voice 'まだ読んでる途中'/'読み途中'/'ここ読んでる'/'読みかけ'/'このページ見せて'/'ページの内容教えて'/'閉じる寸前' が NO-MATCH~~ — **Session 197 で実装**（reader-progress/describe-tab リテラル）
- ~~voice '閉じてくれるんだけど'/'閉じてくれたっていい'/'閉じてもらうんだ'/'閉じてもらうことになって'/'閉じてやるから'/'閉じてくださったなら'/'閉じてくれさえすればいい'/'閉じてくれりゃいい'/'閉じてくれたなら'/'閉じてくれればいいのに' の受益残置尾が NO-MATCH~~ — **Session 196 で実装**（TAIL_TE XIV）
- ~~voice '閉じるといいですよ'/'閉じるがよかろう'/'閉じるんじゃないかな'/'閉じるのも悪くない'/'閉じる以外ない'/'閉じるのが一番だ'/'閉じるに越したことはない'/'閉じるべきだろうね'/'閉じちゃうのも手だ'/'閉じちゃうしかないか'/'閉じちゃったほうが早い' のdict提案・判断残置が NO-MATCH~~ — **Session 196 で実装**（FR VI + ちゃう残置push）
- ~~voice 'i was thinking/figured/reckoned you could X'、'imagine/pretend you closed it'、'close it kind sir'、'close it would you be so kind'、'close it at your earliest' が NO-MATCH~~ — **Session 196 で実装**（ENPRE V + 語尾後置strip）
- ~~voice 'あと少し大きく'/'音量もう少し上げて'/'もうちょい読んで'/'ゆっくり読み直して'/'画面を元に戻して'/'全てのタブを畳んで'/'このタブ残して'/'このタブ以外閉じて'/'残りは閉じて'/'残り全部閉じて' が NO-MATCH~~ — **Session 196 で実装**（リテラル補充）
- ~~voice '閉じてもいいんですけど'/'閉じても結構ですよ'/'閉じても差し支えないです'/'閉じても問題ないです'/'閉じてもいいんではないか'/'閉じてもいいと思うんだけどね'/'閉じちゃっていいかもしれない'/'閉じたっていいですよ' の許可・断定残置尾が NO-MATCH~~ — **Session 195 で実装**（TAIL_TE XIII + CHA拡張 + たっていい先行push）
- ~~voice '閉じようと思うのですが'/'閉じようと思ってる'/'戻ろうと思ってる'/'閉じたいと思っています'/'閉じたい感じがする'/'閉じたい場面です' の意向・たい報告尾が NO-MATCH/describe-tab 誤ルート~~ — **Session 195 で実装**（FR V + OM再帰 'と思って(る|いる)?'）
- ~~voice '閉じてみようかな'/'閉じてみたらどうかな'/'閉じてみてほしい'/'閉じてちょっと'/'閉じてるべき'/'閉じとくべき'/'閉じとこうぜ'/'読んどこうか' の てみる・とく残置が NO-MATCH~~ — **Session 195 で実装**
- ~~voice 'i guess/suppose you could X'/'i could use you to X'/'close it please and thanks'/'thanks a bunch'/'much obliged' が NO-MATCH~~ — **Session 195 で実装**（ENPRE V + 感謝語尾チェーン）
- ~~voice '閉じると決めた'/'閉じることに決めた'/'閉じるつもりですが'/'閉じる予定なんです'/'閉じるはずなんです'/'閉じるようにしました' の決意・予定報告尾が NO-MATCH~~ — **Session 194 で実装**（FR IV）
- ~~voice '閉じてほしくないの'/'閉じずにおいて'/'閉じないままにして'/'閉じるつもりはありません' の不要宣言が NO-MATCH~~ — **Session 194 で実装**（negate II）
- ~~voice '閉じてみせる'/'閉じてみましょうか'/'閉じてもらいたく存じます'/'閉じておくれる'/'閉じてくださいませんかね' の受益・意向残置が NO-MATCH~~ — **Session 194 で実装**（TAIL_TE XII）
- ~~voice '閉じたと思ったのに'/'閉じてもまだ閉じない'/'閉じるどころか'/'閉じてばっかり' の苦情枠が NO-MATCH~~ — **Session 194 で実装**（trouble II）
- ~~voice 'it needs closing'/'it needs to be closed'/'this tab needs to go'/'i want you closing it'/'may/might i suggest'/'could you be so kind to'/'go for it'/'i dare you to'/'close it whenever possible'/'at your discretion' が NO-MATCH〜誤ルート~~ — **Session 194 で実装**（ENPRE IV + 受動needs枠 + 尾剥がし）
- ~~voice 'dont be shy, close it' が negate 誤奪取~~ — **Session 194 で修正**（`^don'?t` lookahead に ` be\b` 除外）
- ~~voice '閉じてお願いね'/'閉じてお願い申し上げたく'/'閉じてくれたら助かる'/'閉じてもらいたいんですが'/'閉じていただければ幸いでございます' の受益・へりくだり深残置が NO-MATCH~~ — **Session 193 で実装**（TAIL_TE XI）
- ~~voice '閉じるとありがたい'/'閉じれば幸いです'/'閉じることは可能でしょうか'/'閉じるという選択肢もあります'/'閉じる必要あるかな' のdict確信・感謝尾が NO-MATCH~~ — **Session 193 で実装**（FR III）
- ~~voice '閉じたいなあ'/'閉じたい気がする'/'閉じたい時は'/'閉じた方がいい気がする'/'閉じたほうがよさそう' のたい気持ち残置が NO-MATCH~~ — **Session 193 で実装**（FR たい尾一括）
- ~~voice 'would you consider/amenable to X'・'might/may i ask that you X'・'can/could/may i trouble you to X'・'i was wondering whether/if you could possibly X'・'is it within your power to X'・'how would you feel about/what do you think about X' が NO-MATCH〜help 誤ルート~~ — **Session 193 で実装**（ENPRE 位置最長一致 + help lookahead 拡張 + `en` パイプラインの possibly 残基剥がし）
- ~~voice '開発者モードにして'/'キャッシュクリアして'/'拡張機能を管理して'/'ピクチャーインピクチャーにして'/'アップデートして'/'画面を最大化して'/'this tab sucks' が NO-MATCH~~ — **Session 193 で実装**（devtools/privacy-clean/device-apps/window-state/trouble リテラル拡充）
- ~~voice '閉じるよう伝えて'/'閉じるって言ってるでしょ'/'閉じてくれるよう言って' の伝達命令残置が NO-MATCH~~ — **Session 192 で実装**（FR 伝達尾）
- ~~voice '閉じなきゃダメだっけ'/'閉じなきゃなんないわ'/'閉じなきゃいかんのか'/'閉じなくてはいかんか'/'閉じなきゃならんかった' の方言義務尾が NO-MATCH~~ — **Session 192 で実装**（IKE 拡張）
- ~~voice '閉じましょうか'/'戻りましょうか'/'読んであげましょうか'（shall-we 意向質問）が NO-MATCH~~ — **Session 192 で実装**（FR `ましょうか`+TAIL_TE `あげましょうか`）
- ~~voice '閉じる方がいいかな'/'戻った方がいいんじゃないか'/'読むとしよう'/'閉じるべきかと存じます'/'閉じるだけで結構です' 等のdict提案・確信尾が NO-MATCH~~ — **Session 192 で実装**（FR II）
- ~~voice '閉じてくれませんかな'/'くれますかい'/'もらえますかね'/'ほしいです'/'ちょ'/'閉じといてくださいね'/'閉じとこかな'/'タブ閉じちゃってもいいかい' が NO-MATCH~~ — **Session 192 で実装**（TAIL_TE X + とく残置 + タブ前置剥がし）
- ~~voice '速度を落として'/'もっとスローで'/'もうちょいゆっくりお願い'/'早めに読んで'/'ピン外して'/'もう少しだけ大きくしてもらえますかね' が NO-MATCH~~ — **Session 192 で実装**（speech-slower/faster・volume-up・unpin-active リテラル拡充）
- ~~voice 'you have my permission/blessing to X'・'i would ask that you X' が NO-MATCH~~ — **Session 192 で実装**（ENPRE chain1）
- ~~voice '閉じてよろしくお願いします'/'閉じておねがいします'/'閉じて頼む'/'閉じてもらえないものか'(negate誤ルート) のて受益・依頼残置が NO-MATCH~~ — **Session 191 で実装**（TAIL_TE IX + negate ものか に `もらえない` lookbehind）
- ~~voice '閉じるのもあり'/'閉じるってのもあり'/'閉じるという手もある'/'閉じるといいんじゃない'/'閉じるとよいでしょう'/'閉じるとよろしい' のdict提案残置が NO-MATCH~~ — **Session 191 で実装**（FR 拡張）
- ~~voice '閉じるしかないな'/'閉じるっきゃないな'/'閉じるよりほかない'/'閉じるほかないだろう'/'閉じるほかあるまい'(後2件は negate 誤ルート) の義務残置が NO-MATCH~~ — **Session 191 で実装**（NEC/FR 拡張 + negate まい に `ほかある|ください|くれ|もらえ` lookbehind）
- ~~voice '閉じるようにする'/'閉じるようにしてください'/'閉じたらいかがでしょうか'/'閉じたらどうでしょうか'/'閉じてもええんちゃう'/'閉じてもいいんじゃないか' が NO-MATCH~~ — **Session 191 で実装**（FR + TAIL_TE + ら提案尾）
- ~~voice '閉じるかどうか'/'閉じるか迷ってる'/'閉じるべきかどうか迷って'/'閉じた方がいいのかな'/'閉じるのが正解かな' の判断質問が NO-MATCH／'戻るかどうか迷ってる' が back 誤実行~~ — **Session 191 で実装**（help かどうか・ contemplation regex + 戻る に か lookahead）
- ~~voice 'go on and X'/'by all means X'/'you're welcome to X'/'i give you permission to'/'what say you/we'/'whaddya say we' が NO-MATCH、'is it true you can'/'can it be closed'/'is it closable'/'any idea how to' が NO-MATCH~~ — **Session 191 で実装**（ENPRE chain1 + help capability regex）
- ~~voice '閉じてくれんかね'/'閉じてくれますかねえ'/'閉じてもらってよろしいか'/'閉じてもらいますか'/'閉じてはくれませんか'/'閉じておきませんか'/'閉じてしまおうかな'/'閉じてくれないものか'/'閉じて結構ですか'/'閉じて構いませんか' のて受益・依頼残置が NO-MATCH~~ — **Session 190 で実装**（TAIL_TE VIII 拡張）
- ~~voice '閉じちゃうかな'/'閉じちゃってもよろしいですか'/'閉じてもろてええか' のちゃ・関西もろて残置が NO-MATCH~~ — **Session 190 で実装**（ちゃうかな系 push + よろしい追加 + TAIL_TE もろて）
- ~~voice '閉じることか'/'閉じるってことで'/'閉じるということでよろしいですか'/'閉じるものなら'/'閉じるのならば'/'閉じるのであったら'/'閉じるんだったらね' のdict条件・引用残置が NO-MATCH~~ — **Session 190 で実装**（FR 拡張）
- ~~voice '閉じることにしようかな'/'閉じることにします'/'閉じるものとする'/'閉じるものと思います'/'閉じるがよい'/'閉じるのが筋ではないだろうか'/'閉じるというわけにはいかない' の意図・判定残置が NO-MATCH~~ — **Session 190 で実装**（FR 拡張）
- ~~voice '戻るものかな' が back 誤実行・'閉じていいものか' が negate 誤奪取~~ — **Session 190 で実装**（`戻る(?!ものか)` + negate `/ものか$/` に `くれない|いい` lookbehind）
- ~~voice 'what about we X'/'would it hurt to'/'would it kill you to'/'is there a chance you could'/'can you be bothered to'/'can you manage to'/'can you even/actually'/'i take it you can'/'i assume you can'/'are you able to'/'are you capable of'/'is it possible you could'/'might it be possible to' が NO-MATCH~~ — **Session 190 で実装**（ENPRE chain1 拡張）
- ~~voice '閉じてくださいますかな'/'閉じてくださいますね'/'閉じてくださいまいか'/'閉じてもらおう'/'閉じてもらいましょう'/'閉じてもらうか' のて敬語・受益残置が NO-MATCH／'くださいまいか' が negate 誤ルート~~ — **Session 189 で実装**（TAIL_TE 拡張）
- ~~voice '閉じてもいいっすか'/'閉じてもええですか'/'閉じちゃってもいいですか'/'閉じちゃってもよいですか'/'閉じちゃってもいいっすか' のても許可・ちゃっても残置が NO-MATCH~~ — **Session 189 で実装**（TAIL_TE + ちゃっても/じゃっても→て/で push）
- ~~voice '閉じられませんか(ね|な)'/'戻られませんか'/'読めませんか' の不能依頼質問が NO-MATCH~~ — **Session 189 で実装**（られませんか→て / godan られ融合→stem+'り'→stemTe / え段ませんか→E_TE）
- ~~voice '閉じるなら今'/'閉じるならここ'/'閉じるんなら'/'閉じるんであれば'/'閉じるのであれば早めに'/'閉じたほうがいいかもしれない' の条件・判定残置が NO-MATCH~~ — **Session 189 で実装**（FR 拡張）
- ~~voice '閉じるべきかな'/'閉じるべきですかね'/'閉じるべきでしょうか' が NO-MATCH、'戻るべきですかね' が back 誤実行~~ — **Session 189 で実装**（help `/べき(かな|ですかね|でしょうか|かね)$/` + 戻る regex に べ lookahead）
- ~~voice 'should we X'/'ought we'/'might we'/'would we'/'would you possibly'/'might you possibly'/'i wonder if you could'/'wondering if you could'/'theres gotta be a way to'/'is it possible for you to'/'is there any way to' が NO-MATCH／一部 misroute~~ — **Session 189 で実装**（ENPRE chain1 拡張 + 'is there any way to'→help）
- ~~voice '閉じてはどうでしょう'/'閉じてはいかがですか'/'閉じてはもらえませんか'/'閉じてはいただけませんか' の ては依頼枠が NO-MATCH~~ — **Session 188 で実装**（TAIL_TE 拡張）
- ~~voice '閉じてやってください'/'閉じてもらっていいですか'/'閉じてもらうわけにはいかないでしょうか'/'閉じてしまおうではないか'/'閉じちゃおうではないか' の受益・意向残置が NO-MATCH~~ — **Session 188 で実装**（TAIL_TE + CHA 拡張）
- ~~voice '閉じるように言った'/'閉じなさいってば'/'閉じなって'/'戻りなって' の引用・関西命令残置が NO-MATCH~~ — **Session 188 で実装**（FR + なさい尾 + なって stemTe 規則）
- ~~voice '閉じようではないか'/'戻ろうではないか'/'閉じようじゃないか'/'読もうではないか' の意向提案枠が NO-MATCH~~ — **Session 188 で実装**（VOL/KAI 尾拡張: 一段 `よう…` + 五段 `[お-row]う…`）
- ~~voice '閉じればいいじゃん'/'閉じりゃいいじゃん'/'閉じちゃえばいいじゃん'/'戻りゃいいじゃん'/'閉じればいいのでは'/'戻ればよいのでは' のば+じゃん/のでは尾が NO-MATCH~~ — **Session 188 で実装**（E_TE/りゃ/ちゃえば 尾拡張 + 五段りゃ→って push）
- ~~voice '閉じるのが筋'/'閉じるほうが賢明'/'閉じるのが妥当'/'閉じるのが適切'/'閉じることを推奨'/'閉じることを望みます'/'閉じることにしよう'/'閉じることにしたい' の判定枠IIIが NO-MATCH~~ — **Session 188 で実装**（FR 拡張）
- ~~voice 'would you be so good as to close it'/'do me the kindness of'/'beseech'/'entreat'/'if it please you'/'pray close it'/'prithee'/'any way you could'/'is there any way'/'any chance you might'/'how about you'/'what about you'/'you wanna'/'have the decency to'/'do the decent thing and'/'have the courtesy to'/'close it if you would be so kind'/'close it once and for all'/'close it for good'/'close it permanently'/'close it and be done with it' の EN 深礼儀III・完了語尾が NO-MATCH~~ — **Session 188 で実装**（chain1 + EN 語尾拡張）
- ~~voice 'could i get you to close it'/'can i ask you to close it'/'any way you can close it' が help 誤ルート~~ — **Session 188 で実装**（`/^can i/`・`/^(could|…)i/` lookahead 除外 + 'any way you can' help リテラル除去）
- ~~voice '閉じてから次へ'/'戻ってから閉じて'/'読んでから続けて' の てから順序接続が NO-MATCH~~ — **Session 187 で実装**（TAIL_TE `から[^。！？!?]*` ブランチ — `|` 欠落による分岐癒合を捕捉・修正）
- ~~voice '閉じておきますね'/'閉じておきましょう'/'閉じておきたい'/'閉じておくつもり'/'閉じておくことにします'/'閉じておいてほしい'/'閉じておこうと思います'/'閉じてしまってよい' の ておく残置群が NO-MATCH~~ — **Session 187 で実装**（TAIL_TE 拡張）
- ~~voice '閉じてお願い申し上げます'/'閉じてお願いいたします'/'閉じてくださいますと'/'閉じていただけましたら'/'閉じてくださいな'/'閉じてくださいましね'/'閉じてちょうだいね'/'閉じてくれますよう' の受益・敬語残置が NO-MATCH~~ — **Session 187 で実装**（TAIL_TE 拡張）
- ~~voice '閉じたほうがよろしいと存じます'/'閉じられればいい' の判定・残基尾が NO-MATCH~~ — **Session 187 で実装**（FR 追加 + `れ$`→stemTe 残基行）
- ~~voice '閉じとこう'/'閉じといて'/'閉じちゃいなさい'/'閉じちゃってください'/'閉じちゃってもいい'/'閉じじまえ'/'読んじゃえ' の とく/ちゃ残置が NO-MATCH~~ — **Session 187 で実装**（双push て+で / ちゃ尾拡張）
- ~~voice 'i would be grateful if you closed it'/"i'd be obliged if you"/'i would appreciate it if you'/'extend the courtesy of closing it'/'afford me the courtesy'/'suppose you closed it'/'say you could close it'/'if you could just possibly close it'/'if you could just go ahead and close it' の EN 礼儀深掘りII が NO-MATCH~~ — **Session 187 で実装**（chain1 grateful-if-you・courtesy・suppose/say 枠 + `if you could` 前置配置で最長一致解消）
- ~~voice '閉じるようお願いします'/'閉じるよう頼みます'/'閉じる要請'/'閉じるお願い'/'閉じる希望'/'閉じる依頼' の よう依頼・名詞型依頼が NO-MATCH~~ — **Session 185 で実装**（FR 尾 よう+依頼名詞枠 + bare名詞尾）
- ~~voice '閉じてくださいまし'/'閉じてくださいますよう'/'閉じてくれますかね'/'閉じてくれりゃ'/'閉じてくれないかなあ'/'閉じてくれるのでしょうか'/'閉じてくれるかどうか'/'閉じてくださったら'/'閉じてもらったら'/'閉じてもらうよう'/'閉じて頂戴いたします'/'閉じてお願い申し上げます'/'閉じてお願いいたします' のて受益残置IIIが NO-MATCH~~ — **Session 185 で実装**（TAIL_TE 拡張）
- ~~voice '閉じることはできますか'/'閉じるべきではある'/'閉じるべきもの'/'閉じるべきかもしれない'/'閉じるのが良い'/'閉じるのが望ましい'/'閉じるほうがよろしい'/'閉じる必要があろう'/'閉じる必要性がある'/'閉じる必要ありそう' の判断枠が NO-MATCH~~ — **Session 185 で実装**（FR 尾拡張。'べきではないか'→negate 維持）
- ~~voice 'it would help a lot if you could close it'/'it would mean a lot if'/'how would you like to'/'what would you say to closing it'/'do you suppose you could'/'do you reckon you could'/'do you figure you could'/'how do you feel about closing it'/'any chance of closing it'/'is there any chance of closing it'/'would it be too much trouble to close it'/'may i ask you to close it'/'i beg you to close it'/'humbly request you close it'/'think you could close it'/'perhaps you could close it'/'you might as well close it'/'might as well close it' の深礼儀・可能性・推量枠が NO-MATCH/help・scoped-help 誤ルート~~ — **Session 185 で実装**（chain1 拡張 + help/scoped-help 先行ルール窄め + 'is there any chance' の 'of' 最長一致化）
- ~~voice 'close it at your earliest convenience'/'close it at once'/'close it forthwith'/'close it double quick'/'close it in a jiffy'/'close it when you can'/'close it if convenient'/'close it momentarily' の即時・便宜語尾が NO-MATCH~~ — **Session 185 で実装**（EN 語尾拡張 + 'double quick' 先行配置）

- ~~voice '閉じていただけないものでしょうか'/'戻ってくれませんかね'/'閉じていただければ幸いに存じます'/'閉じてもいいのであれば' の複合受益尾が NO-MATCH~~ — **Session 184 で実装**（TAIL_TE メガ拡張 + くださるでしょうか）
- ~~voice '閉じたいと思います'/'閉じたいんですが'/'閉じようと考えて'/'閉じようかと思って'/'閉じるというわけです'/'閉じる次第です'/'閉じるんですが'/'閉じればよろしい'/'閉じざるを得ないです'/'閉じなければいけない' の意向・義務報告尾が NO-MATCH/describe-tab 誤ルート~~ — **Session 184 で実装**（FR 拡張 + たい先行剥がし + よう残存→て + ばよろしい規則 + negob ざるを得ない）
- ~~voice '閉鎖してください'/'タブを閉鎖して'/'削除をお願いします'/'消去してください'/'リセットしてください'/'クリアしてください' の名詞型依頼が NO-MATCH~~ — **Session 184 で実装**（close-tab/settings-reset/clear-history リテラル）
- ~~voice 'i was hoping youd close it'/'it would be great if you could close it'/'would you do me a favor and close it'/'do me the favor of closing it'/'you might want to close it'/'if you could close it that would be great' の深い礼儀ネストが NO-MATCH~~ — **Session 184 で実装**（ENPRE chain1 最長一致修正 + post-would-you 再剥がし + 'that would be great' 語尾）
- ~~voice '後戻りして'/'逆戻りして'/'ひとつ前に戻って'/'来た道を戻って'/'さかのぼって'・'スクロールをお願い'/'ページを下げて'/'もうちょっと下に'・'朗読して'/'声で読んで'/'冒頭から読んで'/'get on with it'/'carry on reading'/'wrap up reading'/'今何ページ目'/'全体の何割' が NO-MATCH~~ — **Session 184 で実装**（back/scroll-down/read-aloud/resume-reading/reader-progress リテラル）

- ~~voice '閉じると思い'/'閉じるんだよね'/'閉じることにする'/'閉じたほうがいいね'/'閉じる必要がある'/'閉じるべきです'/'閉じちゃっていい'/'閉じてみるか'/'閉じるでしょ'/'閉じるより'/'閉じますので' の複合・残置フレーム尾が NO-MATCH~~ — **Session 183 で実装**（FR 複合尾拡張 + た形幹の先行て形 push + CHA/TM/SE_TAIL 補強）
- ~~voice '閉じないわけにはいかない'/'閉じなくちゃいけない'/'閉じないとダメ'/'読まないわけにはいかない' の一段・五段否定義務が NO-MATCH/negate 誤ルート~~ — **Session 183 で実装**（negob 最優先て形 push + インラインあ段→てマップ）
- ~~voice 'close it for me thanks'/'close it soon|slowly|carefully|gently|quietly'/'do go and close it'/'cant you close it'/'could you close it'/'very well close it' の EN 語尾副詞・前置詞が NO-MATCH/go-to 誤ルート~~ — **Session 183 で実装**（EN tail/ENPRE 拡張）
- ~~voice 'the fifth tab'/'fifth tab'/'tab number five'/'third tab'/'go back three'/'back twice'/'forward once'/'残りを閉じて'/'他を閉じて'/'音量さげて'/'音おとして'/'音なしにして'/'はやくして'/'ゆっくりして'/'速度を上げて'/'字を小さく'/'中ほどへ'/'半分へ'/'ポーズして'/'続きを'/'止めておけ'/'やめておけ'/'続き読んで'/'一番下に行って'/'全部閉じてほしい'/'閉まって'/'shut down this tab'/'it reopened' が NO-MATCH~~ — **Session 183 で実装**（bare序数/nav-steps EN/量指定子/副詞音量・速度/事故報告・消失タブ質問/bulk名詞）

- ~~voice '閉じたいのに'/'閉じたいんだ'/'戻りたいので'/'閉じると思います'/'閉じると考えて'/'閉じるはず'/'閉じるのでは'/'閉じるのだ'/'閉じるのである' の たい/意向/期待尾が NO-MATCH~~ — **Session 182 で実装**（たい汎用尾 + QC_TAIL 意向報告 + dict+はず規則；過去 たはず→trouble 分離）
- ~~voice '閉じといてほしい(な)'/'閉じといてくれ'/'閉じといてもらう'/'閉じさせてもらいます'/'閉じさせてもらうね'/'読ませてもらいます' の残置依頼尾が NO-MATCH~~ — **Session 182 で実装**（といて依頼尾 + SE_TAIL もらいます系）
- ~~voice '閉じていいよね'/'閉じても大丈夫'/'閉じていいっす'/'閉じてええん(か)?'/'閉じてくださいますと幸いです'/'閉じてくだされば幸いです'/'閉じてくれますと'/'閉じてもいいでしょうか'/'閉じて問題ありませんか'/'閉じて構いません' の許可・敬語尾が NO-MATCH~~ — **Session 182 で実装**（TAIL_TE 許可/敬語群）
- ~~voice '閉じるべきか(どうか)?'/'閉じられますか'/'閉じられる(か)?'/'閉じれますか' が NO-MATCH~~ — **Session 182 で実装**（help 能力・協議質問；'閉じてくれますか' 奪取を `(?<!く)` で解消）
- ~~voice 'shut this/that/the tab'/'drop this/the tab'/'lose this'/'remove/delete this/the tab'/'kill this'/'kill it dead'/'nuke this/the tab'/'scrap it'/'get rid of the tab'/'close it away'/'make it closed'/'i need it closed'/'id like it closed'/'i want it shut'/'merely/no/nah/wait close it'/'so yeah close it' が NO-MATCH~~ — **Session 182 で実装**（EN 削除動詞 + make/like/it 受動スワップ + ENPRE V）
- ~~voice 'is it closing'/'has it closed'/'was it closed|open'/'is it gone'/'its back'/'it came back'/'it closed on me|itself'/'it disappeared'/'it went away'/'its gone now'/'消えたよ'/'閉じちゃいました'/'閉じちゃったから'/'閉じられたんだ'/'閉じちゃうんだ'/'it crashed on me'/'勝手に閉じる'/'自動で閉じた'/'急に閉じた'/'いきなり閉じた'/'勝手に消えた'/'閉じたはず(なのに)?'/'閉じるべきでは'/'閉じる気ない'/'閉じるつもりない'/'閉じたくない' が NO-MATCH~~ — **Session 182 で実装**（describe-tab 状態質問 + reopen-tab 事故報告 + trouble 不随意報告 + negate 否定意向群）

- ~~voice '閉じますよ'/'閉じまっか'/'読みますね'/'戻りますよ'/'止めますよ' の ます+終助詞尾が NO-MATCH~~ — **Session 181 で実装**（汎用ます+助詞規則）
- ~~voice '読めって'/'閉じろと'/'探せって'/'閉じるのか'/'閉じること'/'閉じるように'/'閉じるんだよ'/'閉じるんやで'/'閉じとけよ'/'閉じとこな'/'閉じてやー'/'閉じてやよ'/'あのさ閉じて' が NO-MATCH~~ — **Session 181 で実装**（引用命令拡張 + QC_TAIL 目的/説明尾 + とけ/とこ助詞 + て長音尾 + あのさ開放詞）
- ~~voice 'i want this closed'/'get this closed'/'have this closed'/'get this pinned'/'id like this muted' の受動目的語構文が NO-MATCH~~ — **Session 181 で実装**（pronoun-past スワップ拡張 it|this|that + bare this/that X-ed）
- ~~voice 'you can close it'/'yo close it'/'quickly close it'/'hurry up and close it'/'be kind and close it' が NO-MATCH~~ — **Session 181 で実装**（ENPRE IV 主語+副詞+呼称）
- ~~voice 'how might/may/would i X'/'im good thanks'/'thats enough reading'/'still going'/'you alive'/'誰の声'/'ここどこ'/'タブ教えて'/'読み切った'/'もう読まない'/'what am i on' が欠落~~ — **Session 181 で実装**（help 能力疑問 + ack 充足句 + 各種リテラル補充）
- ~~voice '閉じるべきだった'/'閉じるんだった'/'読むの忘れてた'/'閉じようかい(な)?'/'閉じとけば'/'閉じときなさい'/'閉じよか(な|ろう)?' の残置・願望・方言意向尾が NO-MATCH~~ — **Session 180 で実装**（べきだった/んだった/忘れてた 層 + KAI 関西意向 + よか尾 + ときなさい）
- ~~voice 'i meant to close it'/'i was gonna X'/'lemme have the url'/'it would help if you X'/'be so good as to X'/'i never got around to X' の謝辞・仮定前置詞が NO-MATCH~~ — **Session 180 で実装**（ENPRE III + PAST_VERB 層 + ENPRE 第一連鎖の lemme/let-me/i-meant-to 長形優先）
- ~~voice 'show me how to X'/'walk me through X'/'how do i use this'/'whats the trick' の指南要求が欠落~~ — **Session 180 で実装**（help 指南枠 + scoped-help (?!if|it)）
- ~~voice 'ざっと読んで'/'流し読みして'/'斜め読み'/'拾い読み'/'黙読する'/'自分で読む'/'ちらっと見て'/'見損ねた'/'聞き損ねた' の読書・失敗報告句が欠落~~ — **Session 180 で実装**（read-aloud 速読 + stop-reading 黙読 + describe-tab + say-again/trouble 損ね系）
- ~~voice 'ほなら閉じて'/'さて閉じて'/'おつかれさま'/'ほなね'/'じゃあの'/'またな'/'また明日' が NO-MATCH または wrong-atom~~ — **Session 180 で実装**（HP openers II + vr-exit 別れ句IV）
- ~~voice 'make it so'/'put me in vr'/'beam me in'/'zoom to 50'/'reset the zoom'/'one line down'/'next block'/'say it faster'/'確かめて'/'もうええわ'/'おおきに'/'i would appreciate it' が欠落~~ — **Session 180 で実装**（repeat/vr-enter/percent-jump/scale-reset/scroll/paragraph/speech/web-search/negate/ack 補充）
- ~~voice '閉じといたほうが(いい)?'/'閉じといてね'/'閉じる予定'/'閉じるつもり' の残余依頼尾が NO-MATCH~~ — **Session 179 で実装**（といた/どいた・予定/つもり・裸ほうが）
- ~~voice 'close it for me will ya'/'close it wontcha'/'be a good bot and X'/'u can X'/'ya better X'/'plz/pwease close it'/'close it ttyl/rn/thx'/'close it if u could'/'close it whenever you want'/'close it bud/fam/boss' が NO-MATCH または trouble 誤ルート~~ — **Session 179 で実装**（ENPRE II + vocative/contraction/immediacy尾 + 二度目 for-me）
- ~~voice 'open calculator/notepad/terminal/app store/photoshop/word/excel/paint'/'empty the recycle bin' が go-to literal ナビゲート誤ルート~~ — **Session 179 で実装**（device-apps OSアプリ語彙 + goToEn 除外）
- ~~voice 'still loading'/'is it done loading'/'how long left'/'how many more pages'/'what percent'/'do you have the time'/'close that one' が原子欠落~~ — **Session 179 で実装**（loading/remaining/reader-progress/time/close-tab 補充）
- ~~voice 'maybe later'/'hold off'/'i changed my mind'/'もうやだ'/'なくてもいい' が NO-MATCH 余地~~ — **Session 179 で実装**（negate II + JA 嫌悪・不要句）
- ~~voice 'roger wilco'/'affirmative'/'はいはい'/'かしこまりました'/'ありがてー'/'万歳'/'ええやん' 等の受容句が欠落~~ — **Session 179 で実装**（ack III）
- ~~voice 'stuck again'/'i give up'/'bloody hell'/'うんざり'/'ふざけんな'/'お手上げ'/'限界'/'無理だ' 系の故障・断念句が欠落~~ — **Session 179 で実装**（trouble II）
- ~~voice 'i quit'/'im outta here'/'signing off'/'どうすりゃいい'/'わからなくなった'/'意味がわからない' が欠落~~ — **Session 179 で実装**（vr-exit 別れ句III + help 混乱句II）
- ~~voice '閉じそう'/'閉じるところ'/'消えそうなところ' の相報告が欠落~~ — **Session 179 で実装**（describe-tab 閉じ系相報告・限定語彙化）
- ~~voice '閉じてくれよお'/'閉じてくださると助かります'/'閉じてもらえますでしょうか'/'閉じていただくことはできますか'/'閉じてさえくれれば'/'閉じたらいかがですか' 複合受益尾が NO-MATCH~~ — **Session 178 で実装**（TAIL_TE II + たら提案尾）
- ~~voice '閉じないとまずい'/'閉じなきゃ困る'/'閉じないとだめだ' 義務・必要尾が NO-MATCH~~ — **Session 178 で実装**（IKE II 層）
- ~~voice 'do us all a favor and X'/'god just X'/'may i please X' の積層前置詞が単一パスで残滓~~ — **Session 178 で実装**（ENPRE 二重適用 + favor 句の先置き）
- ~~voice 'did it reload' が refresh 実行・'ffs close it' が trouble 奪取・'明日は何日' が defer 奪取・'閉じたろ' が describe-tab 誤ルート~~ — **Session 178 で修正**（refresh lookahead / ffs 裸化 / 明日は除外 / ろ意志形のたろ除外）
- ~~voice '画面を録画して'/'配信して'/'画面共有して'/'record my screen' が NO-MATCH~~ — **Session 178 で実装**（screen-record 誠実アトム新設）
- ~~voice 'i told you to X'/'i asked nicely'/'didn't i say'/'for the last time'/'i'm gonna'/'for goodness sake'/'jesus'/'ffs'/'c'mon'/'like'/'you know'/'i mean'/'sorta'/'kinda'/'basically'/'literally'/'seriously'/'honestly'/'frankly'/'really'/'be a doll and' 前置詞欠落~~ — **Session 178 で実装**（EN 前置連鎖II）
- ~~voice 'X would you'/'X shall we'/'X might you' タグ質問尾・'immediately/right away/this instant/at once' 即時尾が残滓~~ — **Session 178 で実装**（EN 尾剥がしII）
- ~~voice 'クリップボードを消して'/'open finder/task manager/trash/spotlight'/'half screen'/'tile the windows'/'did it open'/'is it still open'/'保存できた'/'まだ読んでるの'/'read the text'/'もういいのか' 等の原子欠落~~ — **Session 178 で実装**（privacy-clean/device-apps/window-state/describe-tab/bookmark-status/speaking-status/read-aloud/negate 拡張）
- - - ~~voice '閉じても構いません/もよろしい/差し支え'・dict+'のがいい/のはどう'・'んか' 西部依頼・義務否定尾（なきゃいけない等）が NO-MATCH/無回答~~ — **Session 177 で実装**（TAIL_TE+QC_TAIL+IKE 層、テスト186件）
- ~~voice 'could/should/shall/would i X'・'is it ok to X' が実行系へ誤ルート余地~~ — **Session 177 で実装**（help 透過、R97 'can i' 系と整合）
- ~~voice 'open devtools'/'view source'/'inspect element'/'open my downloads'/'go on then' が go-to リテラルナビゲート or NO-MATCH~~ — **Session 177 で実装**（devtools 誠実アトム + goToEn 除外 + download 原子拡張）
- ~~voice 'アンインストール'/'ホーム画面に追加'/'sign me out'/'Cookie消して'/'emergency stop'/'nuke it' 等の honest/literal 欠落~~ — **Session 177 で実装**（device-apps/account/privacy-clean/stop-everything/close-tab 拡張）
- ~~voice 挨拶・反応句（おはよう/こんにちは/good morning/howdy/thanks a million/my dude 等）が NO-MATCH~~ — **Session 177 で実装**（ack/negate 拡張）
- ~~voice 'read it to me'/'where was i'/'その続き'/'あと半分'/'bigger please'/'do over'/'bookmark it'/'capture this' 等のリーダー・ブラウザ形欠落~~ — **Session 177 で実装**（read-aloud/resume-reading/read-here/reader-progress/reader-size/repeat/bookmark/screenshot 拡張）
- ~~voice 'なんで閉じないの'/'why wont it'/'screw this'/'grr'/'dammit' 等の故障・不満質問が NO-MATCH~~ — **Session 177 で実装**（trouble 拡張）

~~Session 186 (ラウンド112): 条件・許可原子層 — JA て受益残置IV・て許可質問（いいか/よろしいか系）・dict条件枠（ならば/のであれば/ことなら）・緩接続（とか/なんか/くらい/だけ/さえ/でも）・EN 譲歩前置詞（unless/barring/by your leave）・want-me-to 枠・just-have-to・名誉/try 枠・語尾 'for you'/'for once'/'a shot' — find-in-page/go-to/help 3件の誤ルート修正（ENPRE 末尾スペース必須化の破壊を学習）~~

~~Voice: ておきます/なさいますか/ろと言った/てはよ 敬語・引用・方言命令尾~~ — **Session 176 で実装**
~~Voice: 閉じられない/cant close it/wont load 不能報告が NO-MATCH~~ — **Session 176 で実装**
~~Voice: なくても/ちゃダメ/のやめて/no need to 拒否形が NO-MATCH~~ — **Session 176 で実装**
~~Voice: 失礼します/お先に/close session 別れ句II・EN 褒め句残り~~ — **Session 176 で実装**
~~Bug: '進められない' が navigate を実行（可能/否定形の lookahead 欠落）~~ — **Session 176 で修正**
~~JA 過去て尾（てきた/てきます/ていった/ておいた）~~ — **Session 175 で実装**
- ~~JA 状態報告（たまま/たばかり）・傾向報告（がち）・障害報告語彙（バグった/詰まった/お手上げ/最悪）~~ — **Session 175 で実装**
- ~~JA 二重否定・義務の実行化（なくはない/わけにはいかない/ざるを得ない）~~ — **Session 175 で実装**
- ~~JA 婉曲不能（かねる/かねます）→help・困ってる系~~ — **Session 175 で実装**
- ~~JA 前置へッジ（すみません/悪いんだけど/お手数ですが/ぜひ/どうぞ/とにかく/とっとと/急いで）~~ — **Session 175 で実装**
- ~~EN courtesy frames（anyway/btw/see if you can/might i trouble you）+ immediacy tails（right now/asap/if you dont mind）~~ — **Session 175 で実装**

~~JA 副詞/へッジ開放子（さあ/ほら/やっぱり/できれば/可能なら/よかったら/もしよければ/よろしければ/良ければ）~~ — **Session 174 で実装**
- ~~提案疑問枠（てはどう/いかが、たらどうかな/いいか）+ てみて 尾~~ — **Session 174 で実装**
- ~~意向報告（Xようと思って/と思う）の動詞化~~ — **Session 174 で実装**
- ~~方言依頼尾（ておくれ、ちゃおうかな/じゃおうかな、たりして/だり）~~ — **Session 174 で実装**
- ~~EN 動名詞枠（how about/what about/why not X-ing）、句動詞 down、whenever/if-you-would 尾~~ — **Session 174 で実装**
- ~~reader-progress 残り枚数（あと何枚/how many pages left）・navigate 先に進んで系~~ — **Session 174 で実装**

~~'save it for later' が defer に奪われブックマーク喪失 → literal除去 + '... later' tail を do/leave/finish 限定（Devin Review #384）~~ — **Session 173 で実装**
~~'この次のタブを閉じて'/'その隣のタブを閉じて' が tab-relative で選択実行 → (?!を) lookahead で実行系を除外（Devin Review #384）~~ — **Session 173 で実装**
~~'この次のタブ'/'一個右のタブ' がストリップ端で無回答 → 一歩隣接は modulo ラップ（nextTab/prevTab と一致）、数え指定（N tabs to the right/二個後）は厳密維持（Devin Review #384）~~ — **Session 173 で実装**
~~JA 進行尾（てきて/てくる/ていって/てもよい/てちょうだい/なさいませ/まして）・EN鎖尾III（while you're at it/when you get a sec/at your convenience/no rush but）~~ — **Session 173 で実装**
~~記事めくり/前ページ慣用句（次の記事/記事をめくって/next article/flip the page/turn the page・前の記事/記事を戻して/めくり戻して/previous article/flip back）~~ — **Session 173 で実装**
~~量指定子（いくつかのタブ/a couple of tabs→tab-status、every tab/all of my tabs→tabs-list）・close-others 例外形（except this one/all but this one/このタブ以外/これだけ残して）・分数ジャンプ（the midpoint/three quarters down/a third of the way/ページの中間/四分の三/三分の一/三分の二）・bare数字序数（tab number N/Nth tab）・say-again エコー（何って/say it again/what was that）・共読（一緒に読んで/follow along/read with me）・待機句（hold on/give me a moment/一旦やめて）・継続（keep on reading/keep it moving/このまま読んで）・音量訴え（whisper/deafening/静かすぎる/speak up）・読了質問（読み終えた/done reading→reader-progress）・文字数（文字数は/あと何文字/単語数/how many words→char-count）・退出句（before i go/gotta go/im heading out→vr-exit）・negate（without/on second thought/つもりはない/そのままにして）~~ — **Session 173 で実装**
~~'閉じんといい(かも)' 否定願望がタブを閉じる実害 → negate（Devin Review #383）~~ — **Session 172 で実装**
~~'pin the second tab' がピン済みタブを解除する双方向ガード・数字語除外は '\s+tab' 後置必須化（'close the one piece tab'→by-name）~~ — **Session 172 で実装**
~~相対/序数タブ指定（この次/この前/一個右/その隣/tab to the left/N tabs to the right/next to this・十番目/ふたつめ/みっつめ）~~ — **Session 172 で実装**
~~'defer' 誠実不在原子（あとで/後で/N分後/do it later/remind me later → 実行しない旨返答）~~ — **Session 172 で実装**
~~EN鎖尾（care to/fancy/might you/wont you/please and thank you/if you'd be so kind/uh/um、'X would ya'/'X would you kindly' タグ質問、'and thank you' 連結）・JA尾II（しかない/ほかない/っきゃない/んしゃ/やい/がよ/だす/んだってば/ておこか/んどこか/ますねえ/ねえ/なあ）・副詞音量/速度（too quiet/way too loud/pretty loud/too slow/too fast/super fast/really slow）・how-to/help 形（how do we/you、what do i do、閉じ方は/戻り方って X方かた系）・echo 補完（閉じたっけ/読んでたっけ/意味がわからない/what did it say）・input-methods キー名（press escape/space bar/hit the enter key/press the tab key）・mic-status toggle 形・halfway/partway 分数ジャンプ（a third of the way/半分くらい）~~ — **Session 172 で実装**
~~EN序数タブ操作（'pin the second tab'/'close the last tab'/'mute the first tab'/'move the tab to position three'/'switch to the fourth tab' の序数語形）~~ — **Session 171 で実装**
~~pin/tab-by-name の `(?:the )?` skip-hole（'pin the second tab' が 'the second' 名検索・'switch to the last tab' が 'the last' 名検索）~~ — **Session 171 で実装**
~~window 名詞系（'open a window'/'guest window'/'another window'/'private window'）・'do i/do we' 疑問句の誤実行→help・'unpin tab N' の未ピン誤トグル~~ — **Session 171 で実装**
~~JA補遺（ぞい/ぞ/ぜ/ねん、まへん/んぞ/んねん/きぎしじち+へん negations、ませう/ますんで/だわ、ちゃいな、させて依頼尾、くれはる/もらっといて、あげる系、どいて/んと…かも、tab-audio per-tab mute、'count my tabs'、'cant reach it'/'あかん'）~~ — **Session 171 で実装**
~~縮約・方言尾（ちゃい/ておる/させろ/なされ/たれ/てみろ/たげて/てちょ/はって/ろや/よか/くれい/おくれ）~~ — **Session 170 で実装**
~~義務・条件残り（なあかん/んとあかん/ときゃええ/ればええ/たらあ/たらどう/といい）・複合動詞尾（終わって/切って/まくって）~~ — **Session 170 で実装**
~~て形残尾（どいて/とけ/のう/たろ/ください+助詞/くれんか）~~ — **Session 170 で実装**
~~EN ought to/do-強調/expletive infix・quit-it/stop 語彙・ASR 修復句（not it/you misheard）・read-aloud/残量補完~~ — **Session 170 で実装**
~~dict形+終助詞第2弾（よな/べ/のう/やろ/がいい/に限る/んちゃう）~~ — **Session 169 で実装**
~~語幹命令（なはれ/やれ/がてら/や）・命令引用（ろって）~~ — **Session 169 で実装**
~~ておく残り（とけば/ときゃ/とき）・りゃ・ばいいのに・ちゃえば・ずには・ねば・んと~~ — **Session 169 で実装**
~~EN 前置/後置層（why not/do us a favor/i need you to/タグ質問/quick/for us）~~ — **Session 169 で実装**
~~EN 俗語 kill/cut it out・不可能形（られへん/んね）→negate・as you were→resume~~ — **Session 169 で実装**
~~dict形+終助詞（わ/かしら/のよ/んだって/ってば/さ/って）~~ — **Session 168 で実装**
~~語幹命令形（たまえ/給え/やがれ/やす/なよ）~~ — **Session 168 で実装**
~~ちま/じま 短縮・とく・方言進行（とる/ちょる/ちゅう）~~ — **Session 168 で実装**
~~EN suppletive 動詞（shoulda/coulda/needa/tryna/finna）+ g-drop（closin/goin）~~ — **Session 168 で実装**
~~'was it ~' 過去形質問・不確実句（dunno/かも/だっけ）~~ — **Session 168 で実装**
~~zoom way in/out・unzoom・brightness EN 形~~ — **Session 168 で実装**
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
- **VRApp モノリス（~3300行）**: 分割は AccessibilityCoordinator パターンで継続可能だが未完。
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
| ~~E-6~~ | ~~Top Sites タイル（=C-3）~~ — **完了（Session 75）**: 新規タブ 'empty' 状態に描画 + `hitTestTopSites` で選択。タイル幾何・ヒットテスト・選択→navigate をテストで固定。 | — | — | — |
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

### F-4. **Session 76 で完全解決**（5/5 + 音声タブ操作面を追加）
- ~~**プライベートモード**~~ — **Session 75 で実装**: `settings.privateMode`（既定 off）。オン中に開いたタブは `panel.isPrivate`（生成時固定の incognito ウィンドウ意味論）、`navigate(url,title,panel)` が `isPrivate` を見て `addHistory` をスキップ、直列化からも除外（**private タブの URL はディスクに到達しない**）。ストリップは「PRIVATE」チップ+タブごとのドットで色以外の手がかり付き（WCAG 1.4.1）。Quest Browser private window 準拠。
- ~~**セッション復元**~~ — **Session 75 で実装**: `tabSession.js`（`qui-browser:tabSession`）。http/https のみ・8枚上限・active クランプの検証付き。`restoreTabs` 設定（既定 on）。Wolvic 1.9 の session restore 準拠。
- ~~**Stop（読み込み中断）**~~ — **Session 75 で実装**: `WebPanel.stop()`（reader fetch abort + iframe ハンドラ detach + 'stopped' 状態）。loading 中はリロードボタンが `✕` を描き同ゾーンで stop —— デスクトップ3ブラウザ共通の reload↔stop ペア。あわせて `iframe.onload` が描画済み 'reader' を 'unavailable' で上書きしていたレースを修正。
- ~~**新規タブページ**~~ — **Session 75 で実装**: 'empty' 状態に `getTopSites` のタイルを描画・選択で navigate（= C-3 解決）
- ~~**`scroll-down`/`scroll-up` の二重登録**~~ — **確認済み（Session 76）**: 実は既に解決されていた。`:365` の NOTE が記録する通り `window.scrollBy` 版は除去済みで `connectBrowser()` 側のみが残る — この一覧項目が stale だっただけ（実害ゼロ）。
- ~~**閉じたタブの再オープン**~~ — **Session 76 で実装**: `TabManager.reopenClosedTab()`（LIFO・10件上限・private/空タブは不記録・MAX_TABS 拒否時はスタックを保持）。デスクトップの Ctrl+Shift+T 準拠。voice コマンド 'reopen-tab' からも到達。
- ~~**タブ操作の音声面**~~ — **Session 76 で実装**: `new-tab`/`close-tab`/`next-tab`/`prev-tab`/`reopen-tab`/`stop-loading`/`private-mode` を connectBrowser に登録（go-to の貪欲 `を開く` キャプチャより前）。voice ファースト UI でキーボードショートカットが存在しないタブ操作を音声に開放 —— Wolvic が MRU 順タブリストを置くのと同じ設計判断（到達経路をモードに合わせる）。`nextTab`/`prevTab` は Ctrl+Tab 準拠の wrap-around。
- ~~**音量コマンドがスタブ**~~ — **Session 77 で配線**: `volume-up`/`volume-down` は登録済みだが action が `// Would adjust volume` の no-op だった。`onVolume(±0.1)` フックを追加し `masterVolume` 設定（0–100, クランプ+永続化+キャプション）へ接続 —— 音声で音量が変えられるのは没入中に設定パネルを開かせない重要な経路。
- ~~**リーダー内 Home/End ジャンプ**~~ — **Session 77 で実装**: `scrollContentTo(line)`/`scrollToTop()`/`scrollToBottom()`（`scrollContent` と同じ clamp+再描画）。voice `scroll-top`/`scroll-bottom`（'先頭へ'/'末尾へ' 等）。
- ~~**タブの複製**~~ — **Session 77 で実装**: `duplicateTab()`（Chrome "Duplicate tab"）。**コピーは navigate 前に isPrivate を継承** — private タブを複製しても URL が履歴に漏れない。voice 'タブを複製'。
- ~~**ページ単位ブックマークの音声経路**~~ — **Session 77 で実装**: `bookmark-page`（'このページをブックマーク' 等、Ctrl+D 原子）→ `onBookmarkPage` → 抽出済み `_toggleBookmark`（chrome スターボタンと同一の toggle+caption 経路）。
- ~~**リーダーの文字サイズが不可変**~~ — **Session 78 で実装**: `settings.readerTextScale`（0.5–2.0×、ブラウジング節のステッパー）→ `TabManager.setReaderScale` → 各 `WebPanel.setReaderScale` が保持ブロックを再レイアウト+スクロールをクランプ+再描画。新規タブにも継承。WCAG 1.4.4 Resize Text（支援技術なしで 200% まで拡大できること）—— これまでリーダーの文字は一切変えられなかった。
- ~~**Page Up/Down 原子の音声経路**~~ — **Session 78 で実装**: `scrollContentPage(±1)`（リーダー矢印と同じ `pageJumpLines` ジャンプ）→ voice `next-page`/'次のページ'・`prev-page`/'前のページ'。canvas ヒットテストに届かない入力系にも同じ原子を開放。
- ~~**記事の読み上げ**~~ — **Session 78 で実装**: Edge "Read Aloud"／Safari "Listen to Page" 準拠。`readerNarration.js`（段落→文境界→サロゲート安全なハードスプリットの純粋チャンカー）、`WebPanel.getReaderNarration()`、`VoiceCommands.readAloud`（開始/なし告知はキャプション経路、本文チャンクは `speak({caption:false})` でキャプション洪水を防止）、voice `read-aloud`/'読み上げて' + `stop-reading`/'読み上げ停止' → `stopSpeaking()`（synthesis.cancel のみ、認識は止めない）。弱視・失明ユーザーが「読む」の代替として使える旗艦アクセシビリティ面。
- ~~**ページ内検索が不在**~~ — **Session 79 で実装**: Ctrl+F 相当をリーダービューポート（VR 内で唯一検索可能なテキスト面）に限定して実装。`WebPanel.findInReader(query)` がマッチ行インデックスを記録して最初のヒットへジャンプ、`findNextMatch(±1)`/`findPrevMatch()` が Ctrl+G/Shift+Ctrl+G 式に循環（`{index,total}` を 1-based で返して告知用）。voice `find-in-page`（'find X'/'Xを探して'/'ページ内検索'→語を促すプロンプト）、`find-next`/`find-prev`（'次を探して'/'前を探して'→'N/M件目'）。循環系を先に登録（'次を探して'がクエリ `/(.+?)を探して/` に吸収される衝突を回避）。
- ~~**360°動画に音声制御なし**~~ — **Session 79 で実装**: HUD の再生/一時停止/停止に相当する voice `video-toggle`（'一時停止'/'再生を再開'/pause・resume・play video）と `video-stop`（'動画を止めて'/stop video）。`onVideoToggle`/`onVideoStop` ホストフックが `immersiveVideo.active` ゲートで誠実に報告 — 動画が無い時は「再生中の動画がありません」（confirmationText を付けない誠実設計は read-aloud と同じ）。
- ~~**他タブ一括クローズ不可**~~ — **Session 79 で実装**: Chrome タブストリップメニュー準拠の `closeOtherTabs()`/`closeTabsToRight()`。各 close は `closeTab` 経由なので private/空タブ非記録ルールが単体クローズと完全一致。逆順ループで splice 中のインデックスを安定化。voice `close-other-tabs`（'他のタブを閉じて'）/`close-tabs-right`（'右のタブを閉じて'）。close-tab の `/close\s+tab\b/` を単語境界に強化（'close tabs' が先に吸収される衝突を修正）。
- ~~**見出しナビゲーションが不在**~~ — **Session 80 で実装**: スクリーンリーダーの H/Shift+H（NVDA/JAWS、VoiceOver ローター）準拠。`nextHeading(±1)`/`prevHeading()` が `style==='h'|'title'` の行を走査（タイトル=見出し0、prev で先頭へ戻れる）し両端で循環、`{index,total}` を告知用に返す。voice `next-heading`（'次の見出し'/'見出しへ'）/`prev-heading`（'前の見出し'）→ 'N番目の見出し（全M）'/'見出しがありません'。
- ~~**URL コピー原子なし**~~ — **Session 80 で実装**: 共有シート準拠の voice `copy-url`（'URLをコピー'/'リンクをコピー'/'アドレスをコピー'+EN）→ `onCopyUrl` ホストフック（`navigator.clipboard.writeText`、権限・非セキュアコンテキストでの reject は握り潰す）。コピー対象が無い時は「コピーするURLがありません」と誠実報告。
- ~~**履歴を直接開けない**~~ — **Session 80 で実装**: bare '履歴' は従来通りパネルトグルのまま、voice `history`（'履歴を開いて'/'履歴を見て'/'履歴を表示'+EN）が `setMode('history')` + `show()`（既に開いていれば hide しない — open≠toggle の誠実設計）。
- ~~**発話の聞き直し不可**~~ — **Session 81 で実装**: スクリーンリーダーの "say again"（NVDA Insert+T）準拠。`speak()` が `_lastSpoken` を記録（synthesis 不在でも動く発話ログ）→ voice `say-again`（'もう一度'/'もう一回'/'聞き直し'+EN）が再生、未発話時は「直前の発話がありません」。
- ~~**現在地の告知なし**~~ — **Session 81 で実装**: `WebPanel.describeLocation()` — タイトル + reader 中は `readerProgressLabel` の行レンジ（'現在 N–M/全体 行目'、収まる時は '全文表示中'、空タブは '何も開いていません'）→ voice `where-am-i`（'どこ'/'どこにいる'/'現在地'+EN）。
- ~~**タブ一覧の読み上げなし**~~ — **Session 81 で実装**: voice `tabs-list`（'タブ一覧'/'タブを読み上げ'/'タブはいくつ'+EN）→ 'N個のタブ。A、B（表示中）、C'（active に印、タイトル無しは URL→'タブN' フォールバック）。MAX_TABS=8 上限で発話長も頭打ち。
- ~~**発話速度を調整できない**~~ — **Session 82 で実装**: NVDA の rate 制御準拠 — 盲目ユーザーは TTS を高速で回すが、没入中に設定パネルへ行けない。`_speechRate`（0.5–3.0、clamp）が全 utterance に効き、voice `speech-faster`/`speech-slower`（'速くして'/'遅くして'/'読み上げを速く'+EN）が ±0.25 ステップで '読み上げ速度 N倍' と告知。`speak({rate})` は個別上書き可。
- ~~**読み上げを一時停止/再開できない**~~ — **Session 82 で実装**: `SpeechSynthesis.pause/resume` でキューを保持したまま中断 — stop-reading の cancel とは別物。voice `pause-reading`（'読み上げを一時停止'/'読み上げ中断'+EN）/`resume-reading`（'読み上げを再開'/'読み上げを続けて'+EN）。'一時停止'（video-toggle）・'読み上げ停止'（stop-reading）と衝突しない句を選定。
- ~~**記事の目次が読めない**~~ — **Session 82 で実装**: VoiceOver ローター "headings" リスト / JAWS 見出しダイアログ準拠。`getReaderToc()` が `style==='h'|'title'` のテキストを文書順で返す → voice `toc`（'目次'/'見出し一覧'/'章立て'+EN）が 'N個の見出し。…' を発話、10件超は '、他N件' で頭打ち。
- ~~**設定パネルに音声で届かない**~~ — **Session 83 で実装**: 音声のみのユーザーは没入中に設定パネルへ行けないため、旗艦 a11y ノブを voice に開放。`onCaptionScale(±0.25)`/`onDwellTime(±250)` ホストフック（stepper と同じ clamp→apply→persist、境界で null → コマンドは「これ以上大きくできません」と誠実告知）→ voice `caption-size-up/down`（'キャプションを大きく/小さく'+EN）、`dwell-time-up/down`（'注視時間を長く/短く'+EN）。`_onVolume` と同じ後付け配線パターン。
- ~~**音量の現在地を聞けない**~~ — **Session 83 で実装**: `onVolume(0)` は無変化で undefined を返すため、`onVolumeStatus` 専用ゲッターを追加 → voice `volume-status`（'音量は'/'今の音量'/EN）が '音量はN%です' と告知。
- ~~**現在時刻を聞けない**~~ — **Session 83 で実装**: NVDA Insert+F12 準拠。voice `time`（'今何時'/'現在の時刻'/'時間を教えて'+EN）→ '現在時刻はH時MM分です'（ホストフック不要）。
- ~~**タブのピン留めがない**~~ — **Session 84 で実装**: Chrome "Pin tab" 準拠。`pinTab/unpinTab/togglePin` — ピン済みはストリップ左端に集約（新たなピンはクラスタ末尾へ）、`closeTab` は全経路（単発・他を閉じる・右を閉じる）で拒否→false、✕ ボタンも描画しない（dead affordance は描かない = 嘘を描かない）。`togglePin` は 'pinned'/'unpinned'/null を返す → voice `pin-tab`（'タブをピン留め'/'ピン留め解除'+EN）が状態に応じて告知。close-tab コマンドは pinned 拒否時「ピン留めされたタブは閉じられません」と誠実告知（confirmationText→action内speak 化）。
- ~~**タブを並べ替えられない**~~ — **Session 84 で実装**: Chrome Ctrl+Shift+PageUp/PageDown 準拠。`moveTab(index,±1)` — 隣接スワップで activeIndex を追従、ピン/非ピン境界を跨ぐ移動は Chrome 同様拒否（領域分離維持）。voice `move-tab-left/right`（'タブを左/右に移動'+EN）→ 端・境界では「タブをこれ以上移動できません」。
- ~~**ブックマークを直接開けない**~~ — **Session 84 で実装**: 履歴と対称。bare 'ブックマーク' は従来のトグルのまま、voice `bookmarks-open`（'ブックマークを開いて'/'ブックマークを見て'+EN）が `setMode('bookmarks')`+`show()`（既に開いていれば hide しない — open≠toggle）。
- ~~**ページ内検索のヒットが見えない**~~ — **Session 85 で実装**: Chrome Ctrl+F 準拠（現在ヒット=橙・他=黄）。`_markFindHits` がマッチ行を 'current'/'other' にタグ付け（タグは laid-out 行オブジェクト上に持つため、再レイアウトで自然に消える）、`_drawReader` が行背景に `col.findCurrent`/`col.findHit` を描画。findNext/Prev で current が追従。
- ~~**記事の文字サイズが音声で変えられない**~~ — **Session 85 で実装**: WCAG 1.4.4 — 音声のみのユーザーは readerTextScale stepper に届かない。`onReaderScale(±0.25)` ホストフック（stepper と同じ clamp(0.5–2.0)→`updateSetting`→`tabManager.setReaderScale`、境界で null）→ voice `reader-size-up/down`（'記事の文字を大きく/小さく'+EN）→ '記事の文字サイズ N倍'/「これ以上大きくできません」。
- ~~**発話速度を数値指定できない**~~ — **Session 85 で実装**: NVDA の rate 値設定準拠 — ±0.25 ステップの往復ではなく直接指定。voice `speech-rate-set`（'読み上げ速度2倍'/EN 'speech rate to 1.5'）→ `setSpeechRate`（clamp）→ '読み上げ速度 N倍'。
- ~~**プライベートタブを直接開けない**~~ — **Session 86 で実装**: Chrome Ctrl+Shift+N 準拠。`newTab(url,{privateMode})` 化 + `newPrivateTab()` — モードトグルを反転せず1枚だけ private で開く（isPrivate がパネルに付くため履歴・closed-stack 除外は自動継承）。voice `private-new-tab`（'プライベートタブ'/'シークレットタブ'/'new incognito tab' — private-mode の `/incognito/` より先に登録し specific beats generic）。
- ~~**ハイコントラストを音声で切り替えられない**~~ — **Session 86 で実装**: Windows/macOS の高コントラスト OS 切替準拠。設定 apply ブロックを `_applyHighContrast(v)` に抽出（settings トグルと voice が完全同一パス）→ `onHighContrast(value?)` フック → voice `high-contrast`（'ハイコントラスト' トグル/'ハイコントラストをオフ'/'enable high contrast' 明示指定）→ 'ハイコントラスト オン/オフです'。
- ~~**記事の読了時間がわからない**~~ — **Session 86 で実装**: Edge/Safari "reading time" 準拠。`getReadingTimeMinutes()` — 日本語黙読速度 ~500字/分で推定（短い記事は1分下限）→ voice `reading-time`（'読了時間'/'この記事の長さ'/'どのくらいで読める'+EN）→ 'この記事は約N分です'、非リーダー時は「記事が開かれていません」。
- ~~**検索エンジンを音声で切り替えられない**~~ — **Session 86 で実装**: `SEARCH_ENGINES` をモジュール定数に昇格、`onSearchEngine(name)` フックがサイクルボタンと同じ `updateSetting`→`setSearchEngine` パス → voice `search-engine`（'検索エンジンをGoogleに'/'use bing'、JA カナ別名対応）→ '検索エンジンをXにしました'、未対応名は「その検索エンジンは使えません」。
- ~~**セッションを音声で復元できない**~~ — **Session 86 で実装**: `restoreSession` が復元数を返すようになり、`onRestoreSession` フック経由で voice `restore-session`（'セッションを復元'/'前のセッションを復元'/EN）→ 'N個のタブを復元しました'/'復元するセッションがありません'。
- ~~**設定トグル（キャプション等）が音声で切り替えられない**~~ — **Session 87 で実装**: 設定パネル行の apply を `_applyToggle(key,v)` スイッチに抽出し、settings トグルと voice `onSettingToggle` フックが完全同一パスを走る。bare はトグル、明示 オン/オフ/enable/disable は値指定 → voice `captions-toggle`（'キャプションをオン'/'字幕を消して'+EN）、`haptics-toggle`（'ハプティックをオン'/'振動をオフ'）、`gaze-toggle`（'注視選択をオン'/'enable gaze'）、`curved-toggle`（'カーブパネルをオン'/'湾曲パネルをオフ'）、`follow-toggle`（'ウィンドウ追従をオン'/'window follow off'）、`snapturn-toggle`（'スナップターンをオン'）→ 'X オン/オフです'/'切り替えられません'。
- ~~**コンフォートプリセットが音声で切り替えられない**~~ — **Session 87 で実装**: サイクルボタンの音声面。bare 'コンフォート' は次プリセットへサイクル（COMFORT_PRESETS をモジュール定数に昇格し panel cycle と hook で共有）、'コンフォートを敏感に'/'comfort preset to tolerant' は直接指定（JA 別名 敏感→sensitive/標準→moderate/寛容→tolerant/オフ→disabled）→ 'コンフォート Xです'/'そのコンフォート設定は使えません'。
- ~~**パネル距離が音声で変えられない**~~ — **Session 87 で実装**: 弱視ユーザーが没入のまま読み面を引き寄せられる windowDistance stepper の音声面。`onPanelDistance(±0.2)` が stepper と同じ clamp(0.6–6.0)→`updateSetting`→`windowManager.setDistance` → voice `panel-distance`（'パネルを近づけて'/'パネルを遠く'/'panel closer'）→ 'パネル距離 N m'、境界では「パネルはこれ以上移動できません」。
- ~~**タブを番号で直接選べない**~~ — **Session 88 で実装**: Chrome Ctrl+1..8（位置指定）/Ctrl+9（最後）準拠。voice `tab-select`（'タブN'/'tab N'）→ `setActive(N-1)` → タイトル/URL で告知、範囲外は「タブNはありません」（clamp しない — 頼んでいない場所へ連れて行かない）。`last-tab`（'最後のタブ'/'last tab'）。
- ~~**ページタイトルが読み上げられない**~~ — **Session 88 で実装**: NVDA Insert+T 準拠。voice `title`（'タイトル'/'このページのタイトル'/'page title'）→ active タブの currentTitle→currentUrl→'タイトルなし' の順で告知。
- ~~**ミュートできない**~~ — **Session 88 で実装**: OS/ハードウェアのミュートキー準拠。`onMute(want?)` フックが `_mutedVolume` に退避→masterVolume=0、解除時に復元（ミュート中の手動音量変更は退避値を破棄 → 次のミュートは実際の音量を記録）。voice `mute-toggle`（'ミュート'/'消音'/'mute'、'ミュートを解除'/'unmute' は明示 want=false で誤ミュート不可）→ 'ミュート オンです'/'ミュートを解除しました'。
- ~~**読み上げ音声が選べない**~~ — **Session 88 で実装**: NVDA の音声選択準拠。`_voice`/`_voiceIndex` が `synthesis.getVoices()` をサイクル、選択は全発話の `utterance.voice` に適用 → voice `select-voice`（'声を変えて'/'change voice'）→ '声をXにしました'、音声0件は「読み上げ音声が利用できません」。
- ~~**数値 stepper が音声で変えられない**~~ — **Session 89 で実装**: 汎用 `onStepper(key,delta)` フック（`VOICE_STEPPERS` 定数で panel stepper と同一 min/max/step、live apply も同一路径）→ voice `grace-time`（'グレース時間を長く/短く' — WCAG 2.2.1 の tremor/nystagmus 要石）、`snap-angle`（'スナップ角を大きく/小さく'）、`move-speed`（'移動速度を速く/遅く'）、`caption-hold`（'キャプションを長く/短く' — WCAG 2.2.1 保持時間）、`caption-height`（'キャプションを上/下に' — XAUR の位置カスタマイズ）→ 'X N単位'/境界・フック無しは「変更できません」。
- ~~**利き手・スムーズ移動が音声で切り替えられない**~~ — **Session 89 で実装**: TOGGLE_KEYS に `southpaw`/`enableSmoothMove` を追加。voice `southpaw-toggle`（'利き手を左に/右に'/'left/right-handed' — 明示 want）→ '利き手を左/右にしました'；`smooth-move-toggle`（'スムーズ移動をオン/オフ'+EN）→ _applyToggle に enableSmoothMove ケース追加で前庭警告トーストも panel と同一路径。
- ~~**読み上げピッチが変えられない**~~ — **Session 89 で実装**: NVDA pitch 制御準拠。`_speechPitch` 0.5–2.0 を全発話の `utterance.pitch` に適用 → voice `speech-pitch`（'声を高く/低く'/'pitch up/down' — ±0.25）→ 'ピッチ N倍'。
- ~~**現在のURLが読み上げられない**~~ — **Session 89 で実装**: タイトルと対の1行告知原子。voice `read-url`（'URLを教えて'/'read the url'）→ active タブ currentUrl または「URLがありません」。
- ~~**動画をシークできない**~~ — **Session 90 で実装**: YouTube J/L キー準拠。`ImmersiveVideo.seek(deltaSec)` が currentTime を [0,duration] にクランプ → `onVideoSeek` フック → voice `video-seek`（'10秒戻る'/'30秒進む'/'動画を戻して'/'seek forward'/'rewind' — 数値キャプチャ、既定±10秒）→ 'N秒戻りました/進みました'。go-back/go-forward の loose regex より前に登録（registerDefaultCommands の先頭 — '10秒戻る' が '戻る' に吸収される衝突をテストで実測捕捉）。
- ~~**設定パネルが音声で開閉できない**~~ — **Session 90 で実装**: faceB/menu ボタンの開閉本体を `_setSettingsPanelVisible(want)` に抽出しボタンと `onSettingsPanel` フックが完全同一経路（visible 反転 + mesh + semanticDOM + caption）。voice `settings-toggle`（'設定を開いて/閉じて'/'設定パネル' — 明示方向またはトグル、go-to catch-all より前に登録）→ 結果の表示状態を告知（'設定を開きます'/'設定を閉じます'）。
- ~~**全タブを一括で閉じられない**~~ — **Session 90 で実装**: Chrome "Close all tabs" 準拠。`closeAllTabs()` が後方イテレートで全タブを closeTab 経由で閉じる（private/空タブ非記録ルール完全一致、ピン留めは拒否して生存）→ voice `close-all-tabs`（'すべてのタブを閉じて'/'close all tabs'）→ 'N個のタブを閉じました。ピン留めM個は残ります'、全ピン/空は誠実告知。
- ~~**ブックマーク/履歴のN番目を直接開けない**~~ — **Session 91 で実装**: tab-select の保存リスト版。`onBookmarkOpen(n)`/`onHistoryOpen(n)` が `bookmarks.getBookmarks()`/`getHistory(MAX_HISTORY)` のN番目を active タブで開く → voice `bookmark-select`（'ブックマークN'/'ブックマークのN番目'/'bookmark N'）、`history-select`（'履歴N番目'/'履歴のN'/'history N'）→ タイトル告知、範囲外は「ブックマークNはありません」（clamp しない）。
- ~~**記事のN行目へジャンプできない**~~ — **Session 91 で実装**: VoiceOver go-to-line 準拠。`onReaderLine(n)` が `_readerLines` の存在と `n ≤ total` を検査 → `scrollContentTo(n-1)` → voice `reader-goto-line`（'N行目へ'/'line N' — go-to catch-all より前に登録）→ 'N行目に移動しました'/'N行目はありません'/'記事を開いていません'。
- ~~**日付が聞けない**~~ — **Session 91 で実装**: NVDA Insert+F12 の date 側（'time' と対）。voice `date`（'今日の日付'/'何月何日'/'current date'）→ '今日はM月D日です'。
- ~~**ブックマーク/履歴が読み上げられない**~~ — **Session 92 で実装**: tabs-list の保存リスト版。`onBookmarkList`/`onHistoryList` がタイトル配列を返し、voice 側が count+5件cap+'他N件'（toc 準拠）で告知 → voice `bookmarks-list`（'ブックマーク一覧'/'ブックマークを読み上げ'/'list bookmarks'）、`history-list`（'履歴一覧'/'履歴を読み上げ'/'list history'）→ 'N個のブックマーク。A、B、…'/'ブックマークがありません'。共通 `listCmd` ヘルパ。
- ~~**タイトルがコピーできない**~~ — **Session 92 で実装**: copy-url の対。`onCopyTitle` が active タブの currentTitle を clipboard.writeText → voice `copy-title`（'タイトルをコピー'/'copy the title'）→ 'タイトルをコピーしました'/'コピーするタイトルがありません'。
- ~~**読み上げ位置から再開できない**~~ — **Session 93 で実装**: NVDA read-from-current-position 準拠。`layoutReaderLines` が各行に `block` 索引を付与（title 行は undefined）→ `narrationFromLine(lines,scroll,title,blocks)` がスクロール位置のブロックから再チャンク（先頭=全文、内部開始=タイトル再告知しない）→ `getReaderNarrationFrom()` → voice `read-here`（'ここから読み上げ'/'ここから読んで'/'read from here'）。
- ~~**トップサイトを番号で開けない**~~ — **Session 93 で実装**: bookmark-select/history-select 準拠。`onTopSiteOpen(n)` が `getTopSites`（private-mode/search-engine 除外はタイルと同一ルール）のN番目を active タブで開く → voice `top-site-select`（'トップサイトN'/'top site N' — 既存の /トップ?サイト/ より先に登録）→ タイトル告知/'トップサイトNはありません'。
- ~~**履歴を検索できない**~~ — **Session 93 で実装**: `onHistorySearch(term)` が `getHistory(MAX_HISTORY)` を title+url で絞り込み → voice `history-search`（'履歴からXを検索'/'履歴でXを調べて'/'history search X'/'search history for X'）→ 'N件見つかりました。最近: title'/'Xは履歴にありません'。'を探して' は find-in-page が所有するため除外。
- ~~**戻る/進むの告知が境界で嘘を吐く**~~ — **Session 94 で実装**: voice back/forward は既に `tabManager.getActiveTab().goBack()/goForward()` に配線済みだったが、静的 `confirmationText` が境界でも '戻ります'/'進みます' と喋っていた → `goBack`/`goForward` の bool を action 内で告知（controller faceB/faceA 準拠）→ '戻れません'/'進めません'。
- ~~**リーダーを行数でスクロールできない**~~ — **Session 94 で実装**: go-to-line の相対版。`onReaderScroll(±n)` が `scrollContent`（クランプ+no-move で false）→ voice `reader-scroll-lines`（'N行進む'/'N行戻る'/'scroll down N lines' — /進|戻/ の loose regex より先に登録）→ 'N行進みました'/'これ以上進めません'。
- ~~**読書進捗が聞けない**~~ — **Session 94 で実装**: `readerProgress()` がビューポート下端/全行の % を返す → voice `reader-progress`（'進捗'/'何%読んだ'/'reading progress'）→ '記事のN%を読みました'/'記事を開いていません'。
- ~~**ブックマークを検索できない**~~ — **Session 95 で実装**: history-search の保存リスト版。`onBookmarkSearch` が title+url を part-match → voice `bookmark-search`（'ブックマークからXを検索'/'search bookmarks for X'）→ 'N件見つかりました。最初: X'/未一致は誠実告知。
- ~~**N番目の検索ヒットに直接飛べない**~~ — **Session 95 で実装**: findNextMatch の索引版。`findMatchAt(n)` が {index,total}|'out'|null を返し `_markFindHits`+scroll → voice `find-match-select`（'3番目のヒット'/'match 4'）→ 'N件目に移動しました'/'ヒットNはありません'/'検索をしていません'。
- ~~**残り読了時間が聞けない**~~ — **Session 95 で実装**: `getRemainingMinutes()` が総読了時間×未読分（readerProgress の合成）→ voice `remaining-time`（'あと何分'/'how much longer'）→ '残り約N分です'/'記事を開いていません'。
- ~~**N番目の見出しに直接飛べない**~~ — **Session 96 で実装**: nextHeading の索引版。`headingAt(n)` が {index,total}|'out'|null → voice `heading-select`（'3番目の見出し'/'見出し2'/'heading 5'）→ 'N番目の見出し（全M）'/'見出しNはありません'/'見出しがありません'。
- ~~**検索位置を動かさず確認できない**~~ — **Session 96 で実装**: volume-status 準拠の status-query。`findStatus()` が {index,total}|null → voice `find-status`（'何件目'/'ヒットは何件'/'how many matches'）→ 'M件中N件目'/'検索をしていません'。'find status' は find-in-page の正当な語として残置（テストで衝突を実測）。
- ~~**最初/最後のヒットに飛べない**~~ — **Session 96 で実装**: find-match-select の端点版。`findLastMatch()` → voice `find-first`/'最初のヒット'・`find-last`/'最後のヒット'/'last match' → 'N件目に移動しました'/'検索をしていません'。
- ~~**現在の行を読み上げられない**~~ — **Session 96 で実装**: VoiceOver "read current line" 準拠。`currentLine()` が scroll 位置の行テキスト → voice `read-line`（'この行を読んで'/'read the current line'）→ 本文 or '記事を開いていません'。
- ~~**段落単位で移動できない**~~ — **Session 97 で実装**: NVDA/JAWS Ctrl+↓/↑ 準拠の段落ナビ（行と見出しの中間レイヤー — R19 の `block` 索引を活用）。`_paragraphStarts()` が block 連続ランの先頭を収集 → `nextParagraph(±1)`（nextHeading 同型・両端循環・{index,total}）→ voice '次の段落'/'前の段落'/'next paragraph'。
- ~~**N番目の段落に直接飛べない**~~ — **Session 97 で実装**: headingAt の段落版。`paragraphAt(n)` → voice `paragraph-select`（'3番目の段落'/'段落3'/'paragraph 4'）→ 'N番目の段落（全M）'/'段落Nはありません'/'段落がありません'。
- ~~**今どの段落か分からない**~~ — **Session 97 で実装**: findStatus の段落版。`paragraphStatus()` が scroll を含む段落 → voice `paragraph-status`（'何段落'/'which paragraph'）→ '全M段落のN段落目'/'記事を開いていません'。
- ~~**記事の文字数が聞けない**~~ — **Session 97 で実装**: 読了時間の分子を status 原子として公開。`getCharCount()` → voice `char-count`（'何文字'/'文字数'/'how many characters'/'word count'）→ '記事はN文字です'/'記事を開いていません'。
- ~~**段落だけを読み上げられない**~~ — **Session 98 で実装**: NVDA "read current paragraph" 準拠。`getParagraphNarration()` が scroll 下の block を `narrationChunks` へ（title 領域=空配列 → readAloud が '読み上げられる文章がありません' を担当）→ voice `read-paragraph`（'この段落を読み上げ'/'read the current paragraph'）。
- ~~**何行目か分からない**~~ — **Session 98 で実装**: findStatus の行版。`lineStatus()` が scroll 位置の行番号 → voice `line-status`（'何行目'/'line number'）→ '現在N行目（全M行）'/'記事を開いていません'。
- ~~**タブの位置が分からない**~~ — **Session 98 で実装**: tabs-list は題名を読むが位置を答えない → voice `tab-status`（'タブは何個'/'which tab'）→ 'N個のタブのM枚目を表示中'/'タブがありません'。
- ~~**プライベート/ピン状態を聞けない**~~ — **Session 98 で実装**: voice `privacy-status`（'プライベートかどうか'/'is it private'）→ 'プライベートタブです'/'通常のタブです'、`pin-status`（'ピンがありますか'/'is it pinned'）→ 'ピン留めされています'/'いません'。**実測捕捉の衝突**: 'プライベートモードですか'/'プライベートタブですか'/'ピン留めかどうか'/'ピン留めですか' は private-mode・private-tab・pin-tab の bare パターンが所有するため、status 側の句は曖昧でない形に限定 + 共存テスト2件で既存ルートを保護。
- ~~**ジャンプ前の場所に戻れない**~~ — **Session 99 で実装**: Vim `` `` `` マーク準拠。`scrollContentTo` がジャンプ前に `_scrollMark` へ現行位置を記録（全ジャンプ原子 — 見出し/段落/ヒット/N行目/Home/End が単一点を経由するため自動カバー。`scrollContent` の増分スクロールは意図的にマークしない）→ `jumpBack()` が scrollContentTo(mark) でトグル → voice `jump-back`（'さっきの場所'/'元の位置へ'/'ジャンプバック' — '戻る' は go-back 所有のため非採用）→ '元の場所に戻りました'/'戻る場所がありません'。新記事ロードでマークはリセット。
- ~~**検索ハイライトを消せない**~~ — **Session 99 で実装**: Chrome の Esc キー準拠。`clearFind()` が `_findMatches`/`_findIndex` を消去して `_markFindHits` でタグ除去 → voice `clear-find`（'検索を解除'/'ハイライトを消して'/'clear search'）→ 'ハイライトを消しました'/'検索をしていません'。
- ~~**クリップボードの URL を開けない**~~ — **Session 99 で実装**: Chrome "Paste and go" 準拠。`onPasteGo` が `navigator.clipboard.readText` → `^https?://` 検査 → active タブで `navigate`（非 URL は 'URLがコピーされていません'、権限失敗は 'クリップボードにアクセスできません' と誠実告知）。async なので action 内 `.then` で speak — voice `paste-go`（'ペーストして開く'/'貼り付けて開く'/'paste and go'）。
- ~~**クリップボードの中身を聞けない**~~ — **Session 100 で実装**: NVDA read-clipboard 準拠。`onReadClipboard` が `navigator.clipboard.readText` → 本文をそのまま発話（空は 'コピーされていません'、権限失敗は 'クリップボードにアクセスできません'）→ voice `read-clipboard`（'クリップボードを読み上げ'/'read clipboard'/'what's on the clipboard'）。paste-go と同じ async `.then` speak パターン。
- ~~**プライベートタブだけ一括で閉じられない**~~ — **Session 100 で実装**: Chrome "Close incognito tabs" 準拠。`TabManager.closePrivateTabs()` が `isPrivate` のみ closeTab 経由で後ろから閉じる（ピン留め private は closeTab 拒否で他の一括系と同じく残存）→ voice `close-private-tabs`（'プライベートタブを閉じて'/'close private tabs' — 'incognito' は private-mode の `/incognito/i` 所有のため英句は private のみ）→ 'N個のプライベートタブを閉じました'/'プライベートタブがありません'。**実測捕捉**: clear-history は Session 56 で既存（'履歴を消去'）— 同名再登録は action を上書きするため重複実装は除去。
- ~~**最初のタブに直接行けない**~~ — **Session 100 で実装**: last-tab（Ctrl+9）の対。voice `first-tab`（'最初のタブ'/'先頭のタブ'/'first tab'）→ `setActive(0)` → タイトル告知/'タブがありません'。
- ~~**ブックマーク済みか聞けない**~~ — **Session 100 で実装**: privacy-status の保存リスト版。`active.isBookmarked(currentUrl)` → voice `bookmark-status`（'ブックマーク済みですか'/'is it bookmarked'）→ 'ブックマークされています'/'いません'/'ページを開いていません'。
- ~~**N番目のタブを閉じられない/ピンできない**~~ — **Session 101 で実装**: Chrome の右クリックタブ準拠（選択せずに Close/Pin）。voice `tab-close-n`（'タブNを閉じて'/'close tab N'）→ `closeTab(idx)` → タイトル告知/'ピン留めされたタブは閉じられません'/'タブNはありません'、`tab-pin-n`（'タブNをピン'/'pin tab N'）→ `togglePin(idx)` → 'タブNをピン留めしました'/'ピンを外しました'。**実測捕捉の衝突**: 両方とも tab-select の `/タブ([0-9]+)/`・`/tab ([0-9]+)/` に吸収されるため tab-select より前に登録し、さらに close-tab `/close\s+tab\b/`・pin-tab `/pin (this |the )?tab/` が 'close tab 3'/'pin tab 2' を吸収 → 数字続行を除く `(?!\s*\d)` で強化。
- ~~**アドレスバーにフォーカスできない**~~ — **Session 101 で実装**: Ctrl+L 準拠。voice `url-input`（'アドレスバー'/'URLを入力して'/'enter url'/'address bar'）→ `panel.onUrlInputRequested(currentUrl||'https://', cb)` で VR キーボードを開き confirm で `navigate` → 'URLを入力してください'/'アドレスバーがありません'。フックは panel 上の public プロパティのため tabManager クロージャで足りる。
- ~~**リセンターが音声から届かない**~~ — **Session 101 で実装**: Quest ホールドボタン準拠。`onRecenter` → `recenter()`（自身で caption も発火）→ voice `recenter`（'リセンター'/'中央に戻して'/'recenter'/'center view'）→ '中央に戻しました'/'中央に戻せません'。
- ~~**動画の再生位置が聞けない**~~ — **Session 101 で実装**: video-seek のステータス対。`onVideoStatus` が `{t: currentTime, d: duration}` → voice `video-status`（'動画はどのくらい'/'動画の位置'/'video position'）→ 'N分M秒を再生中（全X分Y秒）'/'再生中の動画がありません'（duration 不明時は位置のみ）。
- ~~**単語単位でナビゲートできない**~~ — **Session 102 で実装**: NVDA/JAWS の Ctrl+→/← 準拠。`WebPanel.nextWord(dir)` が `_wordCaret`（{line, idx}）を Intl.Segmenter('ja', word) でレイアウト済み行に沿って進め、行またぎ時は `scrollContentTo` が追従するため jumpBack マークも自動。voice `next-word`/`prev-word`（'次の単語'/'前の単語'/'next word'/'previous word'）→ 単語を発話/'これ以上進めません|戻れません'。
- ~~**閉じたタブを一括で再開できない**~~ — **Session 102 で実装**: reopen-tab の一括版（Ctrl+Shift+T 連打準拠）。voice `reopen-all`（'閉じたタブをすべて開き直して'/'reopen all tabs'）→ `reopenClosedTab` をスタックが空になるまでループ → 'N個のタブを開き直しました'/'閉じたタブがありません'（MAX_TABS 上限はループを自然終了、取得分だけ誠実にカウント）。
- ~~**ミュート状態を聞けない**~~ — **Session 102 で実装**: `onMuteStatus` が bool|null → voice `mute-status`（'ミュートかどうか'/'is it muted'）→ 'ミュートされています/いません/確認できません'。**衝突回避**: 'is it muted' は mute-toggle の `/(un)?mute/` に吸収されるため hoisted ブロックに登録。
- ~~**音声言語を切り替えられない**~~ — **Session 102 で実装**: iOS Voice Control の言語切替準拠。voice `language-switch`（'英語にして'/'日本語にして'/'switch to english|japanese'）→ `setLanguage` が recognition.lang + utterance.lang を同時更新、**応答は切替先の言語**（'Switched to English'/'日本語に切り替えました'）で切替が効いたことを聴覚で確認できる。
- ~~**認識した発話を確認できない**~~ — **Session 103 で実装**: ASR 認識確認（ろう・難聴ユーザーは認識器が正しく聞き取ったか聴覚で確かめられない）。`_prevTranscript` に直前トランスクリプトを保持 → voice `say-last-transcript`（'何と言った'/'what did i say'）→ '「X」と聞き取りました'/'まだ何も聞き取っていません'。
- ~~**背景タブを移動できない**~~ — **Session 103 で実装**: Chrome ドラッグ並べ替え準拠・move-tab-left/right の索引版。voice `move-tab-n`（'タブNを左に移動'/'タブNを右に移動'/'move tab N left|right'）→ `moveTab(idx,∓1)` → 'タブNをXに移動しました'/'これ以上移動できません'/'タブNはありません'。**実測捕捉の衝突**: go-to の `/^(.+)(?:を開く?|に(?:行く|移動(?:する)?))/` が JA 句を所有 → go-to より前に登録（テストが '開きます' 応答で検出）。
- ~~**行番号から読み上げられない**~~ — **Session 103 で実装**: VoiceOver read-from-line 準拠・read-here の索引版。`getReaderNarrationFrom(line)` に任意行引数（OOR は null で '記事なし' の [] と区別）→ voice `read-from-line`（'N行目から読み上げ'/'read from line N'）→ `readAloud`。**2件の実測捕捉**: ①goto-line の `/\d+行目/`・`/line \d+/` が所有 → goto-line より前の hoisted ブロックに登録 ②hoisted ブロックは constructor 内で tabManager 不在（ReferenceError → onCommandFailed をテストが検出）→ `_onReadFromLine` 遅延バインド hook。
- ~~**検索語を聞けない**~~ — **Session 103 で実装**: Ctrl+F バーの検索語フィールド読み上げ。`WebPanel._lastFindQuery`（findInReader が記録・clearFind/記事ロードで消去）+ `findQuery()` → `onFindQuery` → voice `find-query`（'検索語は'/'何を検索中'/'find query'）→ '「X」を検索中です'/'検索していません'。**実測捕捉の衝突**: find-in-page の `/find (.+)/` が 'find query' を 'query' 検索として所有 → hoisted ブロックに登録。
- ~~**直前のタブに往復できない**~~ — **Session 104 で実装**: Alt+Tab / MRU ピンポン準拠（最も頻度の高い切替パターンは2タブ間）。`TabManager._prevActiveIndex`（setActive が記録）+ `previousActiveIndex()` → voice `last-tab-switch`（'さっきのタブ'/'switch back'/'most recent tab'）→ setActive → 'タブNに切り替えました'/'前のタブがありません'。**衝突回避**: 'last tab' は last-tab-select、'前のタブ' は prev-tab の所有 → 非曖昧句を選定。
- ~~**直前のコマンドを繰り返せない**~~ — **Session 104 で実装**: Vim '.' / Windows Voice Access "repeat" 準拠（say-again は発話の再**再生**、こちらはコマンドの再**実行**）。`_repeatableTranscript` に直前の非 repeat トランスクリプトを保持（repeat 自身は記録しないため再帰不可）→ voice `repeat-command`（'もう一度実行して'/'同じことをして'/'do it again'）→ 再ディスパッチ/'繰り返すコマンドがありません'。**衝突回避**: 'repeat'/'もう一度' は say-again の所有。
- ~~**ブックマークを解除できない**~~ — **Session 104 で実装**: Chrome "ブックマークを削除" 準拠・bookmark-page トグルの単方向版。voice `unbookmark-page`（'ブックマークを外して'/'remove bookmark'/'unbookmark'）→ `isBookmarked` 確認 → `onToggleBookmark` → 'ブックマークを外しました'/'ブックマークされていません'（未登録ページで追加しない誠実経路）。
- ~~**読み上げ中か聞けない**~~ — **Session 104 で実装**: `synthesis.speaking` のステータス面。voice `speaking-status`（'読み上げ中ですか'/'喋っていますか'/'are you speaking'）→ '読み上げ中です'/'読み上げていません'。
- ~~**先頭/末尾の見出しに飛べない**~~ — **Session 104 で実装**: find-first/find-last の見出し版。`_headingStarts()` を抽出（headingAt が共有）+ `lastHeading()` → voice '最初の見出し'/'最後の見出し' → '1番目の見出し（全M）'/'最後の見出し（全M）'/'見出しがありません'。
- ~~**行ごとに読み進められない**~~ — **Session 105 で実装**: NVDA/VoiceOver の ↓/↑ キー準拠（1行ずつの読書ナビ）。voice `next-line`/`prev-line`（'次の行'/'前の行'/'next line'/'previous line'）→ `scrollContent(±1)` → **着地点の行を発話**/'これ以上進めません|戻れません'。
- ~~**半ページスクロールができない**~~ — **Session 105 で実装**: Vim Ctrl+D/Ctrl+U 準拠（full page-jump ではなく半分）。`scrollHalfPage(dir)`（`⌈visible/2⌉` 行 `scrollContent`）→ voice '半ページ進む'/'半ページ戻る'/'half page down|up'。**実測捕捉の衝突**: navigate の `進む` と back の `戻る` が両句を所有 → `_onHalfPage` 遅延バインドで hoisted ブロックに登録。
- ~~**パーセント位置に飛べない**~~ — **Session 105 で実装**: Kindle "go to N%" 準拠。`scrollToPercent(pct)`（`floor(total*N/100)`、OOR は 'out'、reader-off は null で区別）→ voice `reader-percent`（'50%のところ'/'50%地点'/'50パーセント'/'50 percent'）→ 'N%地点に移動しました'/'N%は範囲外です'/'記事を開いていません'。**衝突回避**: 'go to N percent' は go-to の EN 捕捉の所有 → bare パーセント句を選定。
- ~~**Web 検索を起動できない**~~ — **Session 105 で実装**: omnibox の 'Xを検索' intent（go-to の 開く/行く 捕捉がカバーしない）。voice `web-search`（'猫を検索して'/'Xについて検索'/'search for X'/'web search X'）→ `onGoTo(term)` → '「X」を検索します'。**衝突回避**: '履歴/ブックマーク' 先頭は lookahead で除外 — history-search/bookmark-search が所有。
- ~~**文ごとに読み進められない**~~ — **Session 106 で実装**: NVDA/JAWS Alt+↓/↑ 準拠（文レベルの読書ナビ — 行と単語の中間）。`_sentenceCaret` {block,idx} が **source block の文**（`splitSentences` 導出 — 複数表示行に跨る文も全文発話）を走査；文→行の写像は正規化オフセット数学（`norm(block) === norm(row1)+' '+norm(row2)+…` 前方スキャン）で wrap の空白正規化を吸収。voice '次の文'/'前の文'/'next|previous sentence' → 文を発話+スクロール追従/'これ以上進めません|戻れません'；'この文を読んで'/'何文目' → `currentSentence()`（スクロール下・記事全体索引 {index,total}）。
- ~~**先頭/末尾の段落に飛べない**~~ — **Session 106 で実装**: first/last-heading の段落版。`lastParagraph()`（`paragraphAt(paras.length)`）→ voice '最初の段落'/'最後の段落' → '1番目の段落（全M）'/'最後の段落（全M）'/'段落がありません'。
- ~~**N番目の段落を読み上げられない**~~ — **Session 106 で実装**: read-from-line の段落版。`getParagraphNarrationAt(n)`（paras[n-1] → narrationChunks、OOR='out'・reader-off=[] で区別）→ voice `read-paragraph-at`（'3番目の段落を読み上げ'/'read paragraph 3'）→ 'N番目の段落を読み上げます'+chunk 発話/'段落Nはありません'。**実測捕捉の衝突**: paragraph-select の `(\d+)番目の段落` が句を所有 → paragraph-select より前に登録（plain ジャンプは paragraph-select に残置 — 共存テストで保護）。
- ~~**文字ごとに読み進められない**~~ — **Session 107 で実装**: NVDA/JAWS ←/→ の文字ナビ準拠（word-nav の1段細粒度 — 未就学単語の判定・かな確認）。`_charsOf` が `Intl.Segmenter` grapheme クラスタ走査（結合文字・ZWJ絵文字も1単位として誠実）→ `nextChar`/`prevChar` が `_charCaret` {line,idx} で行境界を跨ぎ全グラフェムを巡回（空白も報告）。voice '次の文字'/'前の文字'/'next|previous character' → 文字を発話/'これ以上進めません|戻れません'。
- ~~**現在の単語を読み上げ/スペルできない**~~ — **Session 107 で実装**: NVDA numpad-5（1回=読み上げ、2回=スペル）準拠。`currentWord()`（caret 単語 → 無ければ scroll 行先頭語）、`spellWord()`（grapheme join '、'）→ voice 'この単語を読んで'/'read word'・'この単語をスペル'/'spell word'。
- ~~**現在の設定値を聞けない**~~ — **Session 107 で実装**: status-query 双子（set 側と対で 'how is X set' 準拠）。`onStepper(key,0)` を **query 経路**として新設（delta=0 で現在値のみ返し step/apply しない）。voice `speech-rate-status`（'読み上げ速度は' → 'N倍です'）、`speech-pitch-status`（'ピッチは'）、`voice-name`（'どの声' → '声はXです'/'声は未選択です'）、`language-status`（'言語は' → 'ja-JP'）、`search-engine-status`（'どの検索エンジン' → `onSearchEngineStatus` — 検索語との衝突を lookahead/長語形で回避）、`stepperStatusCmd`×5（'グレース時間は'/'スナップ角は'/'移動速度は'/'キャプション保持は'/'キャプション高さは' → '値+単位'/'確認できません'）。
- ~~**記事の構造を聞けない**~~ — **Session 108 で実装**: VoiceOver ローターサマリ（'describe page'）準拠。`getArticleSummary()` → {title,headings,paragraphs,chars} → voice `article-summary`（'この記事について'/'記事の概要'/'describe page'/'page info'）→ 'タイトル「X」。見出しN個、段落M個、C文字です'/'記事を開いていません'。
- ~~**今どの見出しの下にいるか聞けない**~~ — **Session 108 で実装**: NVDA read-current-heading 準拠。`headingHere()`（`_headingStarts` の scroll 以下最終スタート → {index,total,text} — headingAt の報告版で動かない）→ voice `heading-here`（'この見出し'/'現在の見出し'/'current heading'）→ 'N番目の見出し（全M）。X'/'見出しがありません'/'記事を開いていません'。
- ~~**残りの文数を聞けない**~~ — **Session 108 で実装**: reading-progress の文版。`sentence-status` 面（{index,total}）を再利用して不一致不可 → voice `sentences-left`（'あと何文'/'残りの文は'/'sentences left'）→ 'あとN文です'/'最後の文です'/'記事を開いていません'。
- ~~**認識感度とウェイクワードを音声で変えられない**~~ — **Session 108 で実装**: voice 層自身の設定面（`settings.sensitivity` = handleRecognitionResult の confidence 閾値、`requireWakeWord`/`isAwake`）は host フック不要のセルフコンテインド双子。voice `sensitivity-up`/`sensitivity-down`（'感度を上げて|下げて'/'sensitivity up|down' → ±0.1 clamp 0–1 → '認識感度はNです'/'これ以上…できません'）、`wake-word-toggle`（'ウェイクワードをオン|オフ' → オフで即 wake、オンで再 sleep）。
- ~~**タブNの名前を切り替えずに聞けない**~~ — **Session 109 で実装**: VoiceOver 'tab N name' 準拠（tab-select の報告双子）。voice `tab-title-n`（'タブNのタイトル'/'title of tab N'）→ 'タブNのタイトルは「X」です'/'タブNはありません' — tabManager 直接参照で `setActive` しない。**実測捕捉の衝突**: tab-select の `/タブ(\d+)/` 接頭一致が 'タブNのタイトル' を所有 → tab-select より前に登録（'タブ2' の plain 選択は共存テストで保護）。
- ~~**ピン留めタブに直接飛べない**~~ — **Session 109 で実装**: pin/unpin の選択双子（ピン済みは左クラスタのため 'the pinned tab' は一意）。voice `pin-select`（'ピン留めのタブ'/'pinned tab'）→ `tabs.findIndex(t=>t.pinned)` → `setActive` → 'タブNに切り替えました'/'ピン留めされたタブがありません'。
- ~~**全タブを再読み込みできない**~~ — **Session 109 で実装**: Chrome 'Reload all' 拡張準拠。voice `reload-all`（'すべて再読み込み'/'すべてのタブを再読み込み'/'reload all tabs'）→ 各パネル自身の `reload()`（URL ガード内蔵で空タブは no-op）→ 'N個のタブを再読み込みしました'。
- ~~**音量を数値で指定できない**~~ — **Session 109 で実装**: volume-up/down の数値双子（'volume to 50' 準拠）。voice `volume-set`（'音量をN%に'/'volume to N'）→ `_onVolumeStatus`+`_onVolume` 再利用で delta 正確計算 → '音量をN%にしました'/'音量を変更できません'。
- ~~**利用可能な声を聞けない**~~ — **Session 109 で実装**: NVDA 音声リスト準拠（select-voice の一覧双子）。voice `voice-list`（'声一覧'/'voice list'）→ `synthesis.getVoices()` → 'N個の声。X、Y…、他M件'（5件cap）/'読み上げ音声が利用できません'。
- ~~**ブックマーク/履歴の件数だけ聞けない**~~ — **Session 109 で実装**: list コマンドの count 面（'how many' で全リストは不要）。voice `bookmark-count`（'ブックマークは何個'/'how many bookmarks' → 'N個のブックマークがあります'）、`history-count`（'履歴は何件'/'history count' → 'N件の履歴があります'）。
- ~~**話題のコマンドだけ教えてもらえない**~~ — **Session 109 で実装**: Voice Access 'what can I say about X' 準拠。voice `scoped-help`（'Xについて教えて'/'help X'）→ name/description/リテラル pattern でレジストリ絞込 → '「X」のコマンドはN個です。…'（8件cap）/'「X」のコマンドはありません' — 'Xについて検索' は web-search の別句で非衝突。
- ~~**タブを名前で選べない**~~ — **Session 110 で実装**: VoiceOver 'tab by name' 準拠（番号選択の内容双子）。voice `tab-by-name`（'ニュースのタブ'/'tab named X'/'switch to X tab'）→ title/url 部分一致 → `setActive` → 'タブNに切り替えました'/'「X」のタブがありません'。`(.+)のタブ` の所有衝突は `^` アンカー+stoplist ルックアヘッドで解消（'さっき|最後|最初|前|次|ピン…のタブ' は各 owner へ透過）。
- ~~**アクティブタブの状態をまとめて聞けない**~~ — **Session 110 で実装**: NVDA describe-tab 準拠。voice `describe-tab`（'このタブについて'/'describe tab'）→ 'タブN（全M）。タイトル。読み込み状態。プライベート・ピン留め'。
- ~~**直前コマンドをN回繰り返せない**~~ — **Session 110 で実装**: Vim 'N.' 準拠。voice `repeat-n`（'N回繰り返して'/'N times'）→ `_repeatableTranscript` 再ディスパッチ（cap 5）。
- ~~**読み上げと動画をまとめて止められない**~~ — **Session 110 で実装**: Voice Access 'stop everything' 準拠。voice `stop-everything`（'すべて止めて'/'stop everything'）→ `synthesis.cancel` + `onVideoStop` → 'すべて停止しました'/'止めるものはありません'。
- ~~**バッテリー/接続状態を聞けない**~~ — **Session 110 で実装**: OS ステータス準拠。voice `battery-status`（'バッテリーは'/'battery level' → `navigator.getBattery()` async → 'バッテリーはN%です（充電中）'/API 無しは誠実）、`online-status`（'オンラインか'/'are we online' → 'オンライン/オフラインです'）。
- ~~**ブックマーク/履歴を名前で開けない**~~ — **Session 110 で実装**: omnibox 名指しオープン準拠（select 原子の NL 双子）。voice `open-bookmark-named`/`open-history-named`（'ブックマークのXを開いて'/'open bookmark X'、**go-to より前に登録** — `を開く` catch-all 所有を実測捕捉）→ `onBookmarkOpenNamed`/`onHistoryOpenNamed` フック → '「X」を開きます'/'「X」に一致する…がありません'。
- ~~**接続が安全かどうか聞けない**~~ — **Session 111 で実装**: Chrome ロックアイコン準拠。voice `security-status`（'このページは安全ですか'/'is it secure' → 'https のため接続は暗号化されています'/'http のため暗号化されていません'）、`hostname`（'ドメインは' → `new URL().hostname` のみ告知 — フィッシング対策）。
- ~~**戻る/進むが可能か質問してもナビゲートしてしまう**~~ — **Session 111 で実装**: 問い合わせ形は可否のみ告知する誠実経路。voice `back-status`/`forward-status`（'戻れますか'/'can we go back' → `historyIdx`/`history.length` → '戻れます/ません'）— 'back'/'navigate' の Map キー位置が hoisted 側のため status 双子を hoisted 登録 + `this._tabManager` 遅延バインド新設。
- ~~**タブを名前で閉じられない**~~ — **Session 111 で実装**: tab-by-name の破壊双子。voice `close-tab-by-name`（'Xのタブを閉じて'/'close the X tab' → 名指し `closeTab(i)` — close-tab/bulk 面の所有衝突を `^`+stoplist で透過化）。
- ~~**読んでいる行/記事をコピーできない**~~ — **Session 111 で実装**: Clipboard API 拡張。voice `copy-line`（'この行をコピー' → `onCopyLine` → '行をコピーしました'）、`copy-article`（'記事をコピー' → `_readerBlocks` 連結 → '記事をコピーしました（N文字）'）。
- ~~**記事の N% 位置へ飛べない**~~ — **Session 111 で実装**: Kindle 'go to N%' 準拠。voice `percent-jump`（'50%へ'/'go to N percent' → `onReaderPercent` で行換算 → 'N%に移動しました' — go-to 所有を実測捕捉のため hoisted 登録）。
- ~~**残りの段落/見出し数を聞けない**~~ — **Session 111 で実装**: sentences-left の残り双子。voice `paragraphs-left`（'残りの段落' → `onParagraphStatus` 再利用 → 'あとN段落です'）、`headings-left`（'残りの見出し'/'headings left' → `onHeadingHere` 再利用 → 'あとN見出しです'/'最後の見出しです'）。
- ~~**タブを名前でピン留めできない**~~ — **Session 112 で実装**: close-by-name のピン双子。voice `pin-tab-by-name`（'Xのタブをピン'/'pin the X tab' → 名指し `togglePin(i)` — pin-tab の `/pin (this |the )?tab/` が 'pin tab named X' を誤所有する実測を捕捉し先行登録）。
- ~~**明示的にピンを外せない**~~ — **Session 112 で実装**: トグルの単方向版。voice `unpin-active`（'ピンを外して'/'unpin this' → 未ピン時は 'ピン留めされていません' の誠実経路）。
- ~~**指定タブだけリロードできない**~~ — **Session 112 で実装**: reload-all の索引双子。voice `reload-tab-n`（'タブNをリロード' → `tabs[n-1].reload()` — tab-select の `/タブ(\d+)/` 所有を実測捕捉し先行登録）。
- ~~**左/右でタブを指定できない**~~ — **Session 112 で実装**: 空間メンタルモデル準拠。'左のタブ'/'right tab' → prev-tab、'右のタブ'/'next tab' にエイリアス追加 + tab-by-name stoplist に 左|右 追加。
- ~~**読み上げ速度/ピッチを一括リセットできない**~~ — **Session 112 で実装**: NVDA restore-default 準拠。voice `speech-reset`（'速度をリセット'/'reset speech' → rate+pitch → 1.0）。
- ~~**認識信頼度/ウェイクワード/記事文字サイズを聞けない**~~ — **Session 112 で実装**: ステータス問い合わせ。voice `confidence-status`（'認識の信頼度は' → 'N%です' — ASR 自己報告）、`wake-word-status`（'ウェイクワードは' → '「X」です'/'オフです'）、`reader-scale-status`（'記事の文字サイズは' → 新フック `onReaderScaleStatus` → 'N倍です' — delta-0 が no-op のため専用ゲッター）。
- ~~**現在の見出しのテキストを読み上げられない**~~ — **Session 113 で実装**: NVDA read-current-heading 準拠。voice `read-heading`（'この見出しを読み上げ'/'read the heading' → `headingHere().text` — 位置告知とは別の本文原子）。
- ~~**文を番号/端でジャンプできない**~~ — **Session 113 で実装**: sentence-caret の索引/端双子（findMatchAt/firstHeading 準拠）。WebPanel `sentenceAt(n)`/`firstSentence()`/`lastSentence()`（sentenceCaret 更新 + scrollContentTo でジャンプマーク記録）→ voice `sentence-select`（'N番目の文'/'sentence 3'）、`first/last-sentence` → 文テキスト発話。**バグ修正**: `_sentencesOf` は索引引数 — 総数ループがブロックオブジェクトを渡していた実害を実テストで捕捉修正。
- ~~**文字/単語カーソルの位置を聞けない**~~ — **Session 113 で実装**: lineStatus の caret 版。WebPanel `charStatus()`/`wordStatus()` → voice `char-status`（'何文字目' → 'この行のN文字目'）、`word-status`（'何単語目'）— caret 未移動時は 'まだ動いていません' の誠実経路。
- ~~**プライベートタブ数を聞けない**~~ — **Session 113 で実装**: tab-position のサブセット。voice `private-count`（'プライベートタブは何個' → 'N個のプライベートタブがあります'/'ありません'）。
- ~~**直前に実行したコマンドを確認できない**~~ — **Session 113 で実装**: アクションエコー（say-last-transcript の実行側双子）。voice `last-command`（'最後のコマンド'/'last command' → `_repeatableTranscript` → '最後のコマンドは「X」でした'）。
- ~~**'new tab with X' が term を捨てる**~~ — **Session 114 で実装**: new-tab の `/new\s+tab/` 前置一致が句を所有して term を silently drop していた実害を実測捕捉 → `new-tab-with` を先行登録（'Xで新しいタブ'/'new tab with X' → `newTab()` + `onGoTo(term)` で URL/検索語を解決）。
- ~~**リロードの語彙がリフレッシュ系のみ**~~ — **Session 114 で実装**: refresh パターンへ 'リロード' + `/reload(\s+the\s+page)?$/i` 追加 — 末尾アンカーで 'reload tab 2' は reload-tab-n を維持。
- ~~**残り行数/残りタブ数を聞けない**~~ — **Session 114 で実装**: line-status/tab-position の残量双子。voice `lines-left`（'あと何行' → 'あとN行です'/'最後の行です'）、`tabs-remaining`（'あと何タブ' → 'あとNタブです'/'最後のタブです'）。
- ~~**プライベートタブの一覧を聞けない**~~ — **Session 114 で実装**: private-count の読み上げ双子。voice `private-list`（'プライベートタブ一覧' → 5件cap名前列挙/'ありません'）。
- ~~**現在行の文字数を聞けない**~~ — **Session 114 で実装**: getCharCount の行版。voice `line-chars`（'この行は何文字' → `currentLine().length` → 'この行はN文字です'）。
- ~~**行テキストを番号で読み上げられない**~~ — **Session 115 で実装**: read-line の索引双子。voice `read-line-n`（'N行目を読んで'/'read line 5' → scrollContentTo + currentLine → 'N行目。テキスト'）— reader-goto-line の `/(\d+)\s*行目/` 所有を実測捕捉し hoisted 登録（`this._tabManager` 遅延バインド）。
- ~~**'検索エンジンは' が設定コマンドに誤答される**~~ — **Session 115 で実装**: search-engine の `/検索エンジンを?(.+)/` が bare 問い合わせを所有して 'その検索エンジンは使えません' と誤答 → setter を `を|に` 必須に絞り、status へ '検索エンジンは' 追加。
- ~~**ピン留め数/マイク状態/最新履歴を聞けない**~~ — **Session 115 で実装**: private-count・isListening・history-list の双子。voice `pin-count`、`mic-status`（'マイクの状態' → 'マイクはオンです/オフです' — ヘッドセット内で OS マイク表示が見えないユーザー向け）、`history-latest`（'最新の履歴' → `_onHistoryList()[0]`）。
- ~~**'open tab 3'/'タブNを開いて' がページナビゲートされる**~~ — **Session 116 で実装**: go-to catch-all が literal テキストで検索ナビゲートしていた実害を実測捕捉 → `open-tab-n` を先行登録（'open tab N'/'タブNを開いて' → setActive → 'タブNに切り替えました'）。
- ~~**位置問い合わせが名指し検索に誤答される**~~ — **Session 116 で実装**: '何番目のタブ'/'何枚目のタブ'/'現在のタブ番号' が tab-by-name の '「何番目」のタブがありません' に誤答 → stoplist 拡張で tab-status へ透過（'何枚目のタブ'/'現在のタブ番号' パターンも追加）。
- ~~**読み込み状態/最新ブックマーク/見出し数を聞けない**~~ — **Session 116 で実装**: describe-tab・history-latest・headings-left の双子。voice `loading-status`（'読み込み中ですか' → panel.loading）、`bookmark-latest`（'最新のブックマーク' → `_onBookmarkList()[0]`）、`heading-count`（'見出しの数' → headingHere().total）。
- ~~**認識感度/コントラスト/注視時間の現在値を聞けない**~~ — **Session 117 で実装**: sensitivity-up/down・high-contrast・dwell-time の双子。voice `sensitivity-status`（voice 層値・フック不要）、`contrast-status`（'コントラストは'/'contrast status' — 'ハイコントラスト…'/'high contrast…' は high-contrast トグル所有のため非曖昧形に限定）、`dwell-time-status`（'注視時間は' → gazeDwellTime getter フック）。
- ~~**タブセッションを音声で保存できない**~~ — **Session 117 で実装**: restore-session の書き込み双子。voice `save-session`（'セッションを保存'/'save session' → `serializeSession` + `saveTabSession` → 'N個のタブを保存しました' — private タブは serializeSession が除外）。
- ~~**主要コマンドの言い換え句が抜けている**~~ — **Session 117 で実装**: navigate へ '次に進んで'/'forward'/'go forward'、read-paragraph へ '今の段落を読んで'、next-heading へ '次の見出しを読んで'、wake-word-status へ `/wake word(?! (on|off))/i`（'wake word off' は wake-word-toggle を維持）、language-status へ '今の言語'、close-all-tabs へ '全て閉じて'/'全部閉じて'、help へ 'コマンド一覧を読み上げて'/'ヘルプを読み上げて'、tabs-list へ 'タブ一覧を読み上げて'/'read the tabs'。
- ~~**'close this tab' が名指しクローズに誤答**~~ — **Session 118 で実装**: close-tab-by-name の EN パターンが 'this' をタブ名として捕捉して '「this」のタブがありません' と誤答 → lookahead stoplist へ `this\b` 追加 + close-tab の EN パターンを `/close\s+(?:this\s+|the\s+)?tab\b(?!\s*\d)/i` へ拡張。
- ~~**'find first'/'find last' がリテラル検索される**~~ — **Session 118 で実装**: find-in-page の `/find\s+(.+)/` が 'first'/'last' を検索語として捕捉 → capture に `(?!first\b|last\b)` を追加し find-first/find-last へ `/^find first$/i`/`/^find last$/i` を登録。
- ~~**'前/次のタブに移動' がページナビゲートされる**~~ — **Session 118 で実装**: go-to の `に移動` catch-all が句を所有 → prev-tab/next-tab（登録順が先行）へ '前のタブに移動'/'次のタブに移動' を追加。
- ~~**高頻度コマンドの言い換え句が抜けている（第2弾）**~~ — **Session 118 で実装**: read-aloud へ 'このページを読んで'/'ページを読み上げて'/'記事を読み上げて'/'read this'、bookmark-page へ 'ブックマークして'、spell-word へ 'スペルで読んで'/'スペルを教えて'、read-word へ 'この単語'、find-prev へ '前のヒット'/'prev match'、read-sentence へ '現在の文'、sentence-status へ 'この文は'/'文は'、paragraph-status へ 'この段落は'/'段落は'、line-status へ 'この行は'/'行は'、where-am-i へ 'ここは'/'ここはどこ'/'what is here'、describe-tab へ 'このタブは'、new-tab へ '新しいウィンドウ'/'new window'、duplicate-tab へ '複製して'/'duplicate'、stop-loading へ '読み込みをやめて'/'stop the page'、scroll-top/bottom へ 'top of page'/'end of page'、time へ '何時'、close-tab へ 'このタブを閉じて'/'close this/the tab'、read-paragraph へ 'この段落を読み上げて'。
- ~~**タブ位置の問い合わせが名指し検索に誤答される（第2弾）**~~ — **Session 119 で実装**: 'このタブの位置'/'何個目のタブ'/'タブは何番目'/'タブの順番' → tab-by-name lookahead stoplist へ `このタブ`・`何個目` を追加して tab-status へ透過（'このニュースのタブ' の名指し選択は共存テストで維持）。
- ~~**'左/右に移動' がページナビゲートされる**~~ — **Session 119 で実装**: go-to の `に移動` catch-all が所有 → move-tab-left/right（登録順が先行）へ 'このタブを左へ'/'左に移動' 等を追加、onGoTo 非呼出を断言。
- ~~**'read the previous line' がジャンプバックされる**~~ — **Session 119 で実装**: jump-back の `/previous (spot|position|line)/i` が 'previous line' を所有 → `line` を除外し prev-line へ透過（'previous position' は jump-back を維持）。
- ~~**'incognito tabs' がプライベートモードをトグルする**~~ — **Session 119 で実装**: private-mode の `/incognito/i` が一覧意図の句を所有 → `/incognito(?!\s+tabs?)/i` に絞り private-list へ（'incognito mode' トグルは維持）。
- ~~**行レイヤーに端ジャンプがない**~~ — **Session 119 で実装**: first-heading/last-heading の行双子。voice `first-line`/`last-line`（'最初の行'/'last line'/'最後の行を読んで' → `_onReaderLine(1|total)` → 'N行目。…' — read-line-n の hoisted ブロックへ）。
- ~~**コレクション端の 'を読んで' 形が抜けている**~~ — **Session 119 で実装**: read-paragraph-at へ `/(?:最初|最後)の段落を読(?:んで|み上げ)/`（'最後' は `_onParagraphStatus().total` で解決）、first/last-sentence へ '最初/最後の文を読んで'、first/last-heading へ '最初/最後の見出しを読んで'、first/last-line へ 'を読んで' 形。
- ~~**'find first aid'/'find in page first' が壊れる（Devin Review #330）**~~ — **Session 119 で修正**: Session 118 の `(?!first\b|last\b)` が 'find first aid' のような複合語検索を全滅させ、optional `in page` 前置詞の backtrack で 'find in page first' が 'in page first' を検索していた → find-in-page を2regex構成へ（`find in page X` 専用 + 平系 `(?!in\s+…page)(?!first\s*$|last\s*$)`）に分割。pattern・抽出 regex の両方を同形に揃え、'find first'/'find last' の endpoint ルートは維持。
- ~~**隣タブを切り替えずに確認できない**~~ — **Session 120 で実装**: screen-reader の "what's next" 準拠 peek 原子。voice `peek-tab`（'次のタブを読んで'/'次のタブは'/'前のタブを読んで'/'read next tab' → 非破壊に `タブN: タイトル` 告知、1枚以下は誠実告知、wrap は nextTab と同仕様）— next-tab の loose /next\s+tab/i が 'read next tab' を所有するため hoisted 登録（`this._tabManager` 遅延バインド）。
- ~~**ページを音声で共有できない**~~ — **Session 120 で実装**: Web Share API 準拠の `share-page`（'共有して'/'share this page' → `onShare` フック promise → 発話; フック無しは '共有できません'）。VRApp 側は navigator.share → clipboard.writeText フォールバック。'/this page/' 風の非アンカーは 'share this page' を奪うため title 側は /^this page$/i アンカー化。
- ~~**高頻度コマンドの言い換え句が抜けている（第3弾）**~~ — **Session 120 で実装**: title へ 'ページの名前'/'ページタイトル'/'今のページ'/'this page'/'current page'、history/bookmarks-open へ '履歴を見せて'/'ブックマークを見せて'、bookmark-status へ 'ブックマークに入ってる'/'ブックマークしたか'/'did i bookmark'/'in bookmarks'、speech-rate-status へ 'reading speed'/'voice speed'、volume-status へ '音量はいくつ'/'what volume'、language-status へ '読み上げ言語'/'reading language'、vr-enter へ 'vr mode'、reader-size へ '文字を大きく/小さく'・'拡大して'/'縮小して'・'もっと大きく'/'もっと小さく'、settings-toggle へ '設定を見せて'/'設定を表示'/'show settings'（見せ/show は open 扱い）、help へ 'ヘルプを見せて'/'コマンド一覧を表示'、clear-history へ '閲覧履歴を消して'/'検索履歴を消して'/'clear browsing history'、describe-tab へ 'ページ情報'/'このサイトの情報'/'site info'/'page info'、security-status へ '証明書は'/'certificate'、move-tab へ 'タブを左/右に'・'move it left/right'。
- ~~**'戻る/進むことができますか' がナビゲートを実行する**~~ — **Session 121 で実装**: 質問形が back/navigate の `/戻[るれ]/`・`/進[むめ]/` loose regex に所有され、答えるべき問い合わせでページ移動していた（実測捕捉）→ back-status へ '戻ることができますか'/'もっと戻れる'/'前に戻れますか'、forward-status へ '進むことができますか'/'前に進めますか' を追加（goBack/goForward 非呼出を断言）。
- ~~**'ホームに戻る' が back に誤答される / ホーム面がない**~~ — **Session 121 で実装**: back の `/戻[るれ]/` が所有。Chrome Home ボタン準拠で新規 `home`（'ホームに戻る'/'ホーム'/'go home'/'home page' → `newTab()` の新規タブ面をホームとして開く、上限は 'タブをこれ以上開けません'）— hoisted 登録（`this._tabManager` 遅延バインド）。
- ~~**ページを音声で翻訳できない**~~ — **Session 121 で実装**: Chrome 翻訳バブル準拠の `translate-page`（'翻訳して'/'このページを翻訳'/'translate this page' → `onGoTo(translate.google.com/translate?sl=auto&tl=…&u=…)`、'英語に翻訳'→tl=en、'中国語に翻訳'→tl=zh-CN、URL無しは 'ページを開いていません'）。
- ~~**高頻度コマンドの言い換え句が抜けている（第4弾）**~~ — **Session 121 で実装**: private-new-tab へ '新しいプライベートタブ'/'プライベートタブを開いて'、next/prev-page へ '次のページへ'/'前のページへ'、scroll-top/bottom へ '最初のページ'/'最後のページ'/'first|last page'（アンカー付き）、refresh へ 'ページを更新'/'更新して'/'refresh page'/'reload this page'、bookmark-page へ 'ページを保存して'/'save this page'（save-session との共存テスト維持）、article-summary へ '要約して'/'summarize'、toc へ '見出しを全部読んで'/'章一覧'/'read all headings'、where-am-i へ 'フォーカスはどこ'/'what has focus'、share-page へ 'ツイートして'/'メールで送って'/'リンクを送って'/'tweet this'/'email this'、next-paragraph へ '読み上げをスキップ'/'skip ahead'、url-input へ '検索バー'/'search bar'。
- ~~**'タブNを読んで' が切り替えを実行する**~~ — **Session 122 で実装**: tab-select の `/タブ(\d+)/` が索引読み上げ句を所有して切替していた（実測捕捉）→ peek-tab の索引双子 `peek-tab-n`（'タブNを読んで'/'タブNは何'/'read tab N' → 非破壊に `タブN: タイトル` 告知、範囲外は 'タブNはありません'）を hoisted 登録。'タブ1' 単体は切替を維持（共存テスト）。
- ~~**'マイクをミュート' が音量をミュートし、'mute other tabs' が active をミュートする**~~ — **Session 122 で実装**: mute-toggle の `/(un)?mute/i` が両方を所有（実測捕捉）→ mic 停止は `stop`（音声認識停止）へ 'マイクをミュート'/'マイクオフ'/'マイクを止めて'/'mute the mic'/'mic off'/'stop listening' を追加し、mute-toggle は lookahead で 'other tabs'/'the mic' 系を素通し。'mute other tabs' は per-tab surface 不在のため誠実未認識。'ミュート' 単体は audio ミュートを維持。
- ~~**'前回のタブを開いて' が literal ナビゲートされる / undo 句がない**~~ — **Session 122 で実装**: go-to の JA catch-all が 'を開' に部分一致して '前回のタブ' をサイト名としてナビゲート（実測捕捉）→ lookahead で 前回|セッション|閉じた を除外し restore-session へ '前回のタブを開いて'/'前回のセッション'/'最後のセッション' を追加、reopen-tab へ '元に戻して'/'取り消して'/'閉じたタブをもう一度'/'閉じたタブを開いて'/'undo' 系を追加。
- ~~**保存済みセッションを音声で消せない**~~ — **Session 122 で実装**: save-session の消去双子 `clear-session`（'セッションを消して'/'clear session' → `onSessionClear` フック → VRApp は loadTabSession 有無を誠実判定して saveTabSession(null)）。
- ~~**ストレージ残量を問い合わせられない**~~ — **Session 122 で実装**: `storage-status`（'ストレージ'/'容量は'/'storage' → navigator.storage.estimate() → '約N MB使用中（上限M MB）'、API無しは 'ストレージ情報を取得できません' — paste-go の async .then speak パターン）。
- ~~**「画面が見えない」に応答する経路がない**~~ — **Session 122 で実装**: `trouble`（'反応しない'/'真っ暗'/'画面が見えない'/'not responding'/'screen is dark' → '音声は動作中です。「リセンター」で正面に戻せます。「ヘルプ」でコマンド一覧を聞けます' — パネル消失した voice-only ユーザーの音声回復導線）。
- ~~**高頻度コマンドの言い換え句が抜けている（第5弾）**~~ — **Session 122 で実装**: vr-exit へ 'ブラウザを終了'/'アプリを終了'/'終了して'/'quit'/'exit the app'、close-tab へ 'ウィンドウを閉じて'/'close window'、bookmark-page へ 'お気に入りに追加'/'add to favorites'、bookmarks へ 'お気に入りを見せて'、unbookmark-page へ 'ブックマークを削除'/'ブックマークから消して'、speech-faster/slower へ '早く/ゆっくり読んで'・'read faster/slower'、select-voice へ '別の声'/'違う声にして'、voice-name へ '声は何'/'音声エンジン'、say-again へ 'もう一回聞いて'/'聞き直して'/'listen again'、reading-time へ '読書時間'/'読んだ時間'/'time spent'、online-status へ 'Wi-Fiは'/'接続状態'/'wifi'、battery-status へ '充電は'/'充電中ですか'/'charging'、reader-size へ 'フォントを大きく/小さく'・'フォントサイズを上げて/下げて'、reader-progress へ 'スクロール位置'/'今どのあたり'/'scroll position'、refresh へ '再起動して'/'ブラウザを再起動'/'restart the page'。
- ~~**'左のタブを閉じて' が名指し検索に誤ルート / 左側一括閉じがない**~~ — **Session 123 で実装**: Chrome close-tabs-to-the-right の左双子 `TabManager.closeTabsToLeft()`（closeTab 経由・ピン拒否・activeIndex は splice で自走 — 前向き反復で `i < activeIndex` を逐次評価）+ voice `close-tabs-left`（'左のタブを閉じて'/'左側のタブを閉じて'/'close tabs to the left'）。close-tab-by-name の JA stoplist に 左|左側 を追加（'「左」のタブがありません' の誤答解消 — '右' は既に除外済みだった非対称バグ）。
- ~~**JA 序数でタブを選べない（'一番目のタブ' が名指し検索に誤ルート）**~~ — **Session 123 で実装**: `tab-select-ordinal`（'N番目のタブ' → 漢数字 map 一〜九 → setActive + タイトル告知、範囲外は 'タブNはありません'）。tab-by-name の `(.+)のタブ` capture が先行所有するため hoisted 登録（`this._tabManager` 遅延バインド）。
- ~~**'半分の音量' が数値パースに落ちない**~~ — **Session 123 で実装**: volume-set に '半分の音量'/'音量を半分に'/'half volume' を追加し `半分|half` → 50 特例。
- ~~**高頻度コマンドの言い換え句が抜けている（第6弾）**~~ — **Session 123 で実装**: close-tab へ 'ページを閉じて'/'サイトを閉じて'、volume-up/down へ '音を大きく/小さく'・'音量を大きく/小さく'・'音を上げて/下げて'、new-tab へ '新しいタブで開いて'/'新しいウィンドウで開いて'、url-input へ 'アドレスバーを見せて/出して/開いて'、read-url へ 'URLを表示'/'アドレスを読んで'/'URLは'、bookmark-page へ 'お気に入り登録'/'お気に入りに登録'/'後で読む'/'あとで読む'/'読書リストに追加'、bookmarks-open へ 'お気に入り一覧'/'読書リスト'、reader-size へ 'ズームインして'/'ズームアウトして'・'文字を拡大/縮小'・'ページを拡大/縮小'。
- ~~**'先頭に戻る'/'一番上に戻る'/'トップに戻る' がタブ内履歴を戻ってしまう誤実行**~~ — **Session 124 で実装**: back の `/戻[るれ]/` が 'Xに戻る' 系を所有（実測捕捉 — '先頭に戻る' で goBack 実行）→ `(?<!先頭に)(?<!一番上に)(?<!トップに)` lookbehind で透過 + scroll-top へ '先頭に戻る/戻って'・'一番上に戻る/戻って'・'トップに戻る/戻って'・'ページの先頭に戻る'・'トップへ' を追加。'戻る' 単体は従来どおり goBack（共存テストで非呼出を相互断言）。
- ~~**'オプションを開いて' が literal ナビゲートされる誤ルート**~~ — **Session 124 で実装**: go-to の `を開` catch-all が所有（実測捕捉）→ settings-toggle（登録順が先行するため追加だけで勝つ）へ 'オプション'/'オプションを開いて'/'設定画面'/'環境設定'/'プリファレンス'/`^options$`/`^preferences$` を追加、onGoTo 非呼出を断言。
- ~~**ズーム/文字サイズの音声リセットがない（'reset text size' がステータス告知に誤ルート）**~~ — **Session 124 で実装**: Chrome Ctrl+0 準拠 `reader-scale-reset` — `_onReaderScaleStatus()` で現在値取得 → `_onReaderScale(1.0 - cur)` の単一 delta で標準へ（'ズームをリセット'/'文字サイズを元に戻して'/'reset zoom'/'zoom reset'/'reset text size'/'reset font size'）。reader-scale-status の `/text size/i` が EN 句を所有するため先行登録。cur=1.0 は '文字サイズは標準です'、フック無しは '確認できません' の誠実経路。
- ~~**聴覚側のトラブル訴えに応答経路がない**~~ — **Session 124 で実装**: `audio-trouble`（'聞こえない'/'音が出ない'/'音が小さい'/"can't hear"/'no sound' → '「音量」で今の音量を確認できます。…' — trouble の視覚導線の聴覚双子）。
- ~~**高頻度コマンドの言い換え句が抜けている（第7弾）**~~ — **Session 124 で実装**: find-in-page へ 'ページ内を検索'/'ページ内で検索'/'この中から検索'/'探して'/'検索して'（全て検索語プロンプトへ）、scroll-up/down へ 'ちょっと上/下'・'少し上/下へ'・'もう少し上/下'、read-aloud へ 'このページを読み上げて'/'ページ全体を読み上げて'/'最初から読み上げ(て)'/'もう一回読んで'、trouble へ '動作が遅い'/'遅い'/'ページが重い'/'重い'/'カクカクする'/'フリーズした'/'固まった'/'画面が固まった'、battery-status へ '電池残量'/'充電残量'/'残量は'/'電源は'/'バッテリーの残り'/'電池残り'。
- ~~**'ページ内で「X」を検索' が未認識 / 「X」を探して が括弧込みで検索される**~~ — **Session 125 で実装**: find-in-page に `/ページ内[をで](.+?)[をで]検索/` を追加し（'ページ内であを検索'/'ページ内をあで検索' 両形）、抽出語の先末尾 `「」『』"''` を strip（'「テスト」を探して' が引用符込みで検索されて必ず '見つかりませんでした' になる実害を実測捕捉）。'バナナを検索して' は web-search 維持（共存テスト）。
- ~~**VR 出入り・エコー系の自然句が抜けている**~~ — **Session 125 で実装**: vr-enter へ 'VRを始める'/'VRモードに入る'/'VRモードで'/'没入モード'/'没入モードに入る'/'VRを開始'、vr-exit へ 'VRを終了'/'VRをやめる'/'VRを終わる'/'VRを出る'、say-again へ 'もう一回言って'/'今の行をもう一度'/'もう一度再生'、say-last-transcript へ '何を言った'/'何を聞き取った'/'今何を言った'。
- ~~**高頻度コマンドの言い換え句が抜けている（第8弾）**~~ — **Session 125 で実装**: read-heading へ '見出しを読み上げて/読み上げ'、next/prev-heading へ '次のセクション'/'前のセクション'、next-paragraph へ 'スキップして'/'先読みして'/'読み飛ばして'、prev-sentence へ 'さっきの文(を読んで)'、mute-toggle へ '静かにして'/'無音にして'/'静音にして'、volume-down へ 'うるさい'/'音が大きい'/'音がうるさい'、unbookmark-page へ 'お気に入りから消して'/'お気に入りを外して'/'ブックマークから外して'、trouble へ '耳が痛い'/'酔った'/'気分が悪い'/'目が疲れた'/'滑らかじゃない'/'ヘッドセットが暑い'（快適性訴えも音声回復導線へ）。
- ~~**設定トグルの状態を問い合わせる音声経路がない（'字幕はオン' がトグル実行される実害）**~~ — **Session 126 で実装**: 読み取り専用フック `_onSettingStatus`（VRApp `onSettingStatus` = settings[key] getter）を新設し `settings-status` で応答。EN 質問形は toggleCmd の loose regex が先行所有して質問が状態を変えていたため（実測捕捉）toggleCmd 群より前に登録 — 質問は状態を変えない（Voice Access 'is X on' 準拠）。
- ~~**接続品質の音声問い合わせがない**~~ — **Session 126 で実装**: `connection-status` が `navigator.connection` の effectiveType/downlink を告知（'回線速度'/'通信速度'/'connection speed'、API 無しは誠実応答）。
- ~~**'秘密のタブ'/'シークレットモード' が名指しタブ検索に誤ルート**~~ — **Session 126 で実装**: tab-by-name stoplist 拡張 + private-new-tab に '秘密のタブ'/'シークレットのタブ'/'プライベートのタブ'/'シークレットモード(で開いて)' を追加。
- ~~**'今何曜日' が認識されず日付句に曜日がない**~~ — **Session 126 で実装**: date に '今何曜日'/'何曜日'/'曜日は'/'what day' を追加し発話を 'X月Y日（Z曜日）' に拡張。
- ~~**高頻度コマンドの言い換え句が抜けている（第9弾）**~~ — **Session 126 で実装**: language-switch '英語で読んで'/'日本語で読んで'/'読み上げ言語を英語/日本語'、captions-toggle 'キャプションを出して/見せて'/'字幕を出して'、help '困った'/'わからない'/'ヘルプミー'、reopen-tab 'もとに戻して'/'取り消し(て)'、top-sites 'スタートページ'/'よく見るサイト'/'おすすめサイト'、clear-history '閲覧履歴を全部消して'、trouble 'ネットが遅い'。
- ~~**数値/列挙設定（パネル距離・モーション感度）の音声クエリがない**~~ — **Session 127 で実装**: settings-status の KEYMAP を `[regex, key, label?, {unit|map}]` に一般化 — 'パネルの距離'/'panel distance' → 'パネル距離 Xメートルです'、'モーション感度は'/'motion sensitivity' → プリセット JA 写像で応答。
- ~~**モーション感度を方向指定で変える音声経路がない**~~ — **Session 127 で実装**: `motion-sensitivity`（comfort-preset の方向双子）— 'モーション感度を上げて/下げて/標準に' → `_onSettingToggle('motionSensitivity', preset)`。settings-status の loose `/motion sensitivity/` が 'motion sensitivity up' を先取りしていたため `^…\??$` アンカーで透過。
- ~~**パネル距離の訴え句（'パネルが遠い'/'近すぎる'）が未認識・方向反転の余地**~~ — **Session 127 で実装**: 訴え形→修正アクション（訴えは現在値への苦情、近い→遠ざける方向を除外集合で保証）。EN 'too far'/'too close' 同形。
- ~~**'一番左のタブ'/'一番右のタブ'/'左端のタブ' が名指し検索に誤ルート**~~ — **Session 127 で実装**: tab-by-name stoplist 拡張 + first-tab/last-tab へ '一番左/一番右のタブ'・'左端/右端のタブ'・leftmost/rightmost を追加。
- ~~**fullscreen/immersive 文言が未認識・'exit fullscreen' が vr-enter に誤ルート**~~ — **Session 127 で実装**: vr-enter に '全画面'/'フルスクリーン(にして|モード)'/immersive mode/`(?<!exit )full ?screen/i`、vr-exit に '全画面をやめて'/'フルスクリーン解除'/'exit fullscreen' — lookbehind で enter 側が exit 句を横取りしないよう分離。
- ~~**高頻度コマンドの言い換え句が抜けている（第10弾）**~~ — **Session 127 で実装**: reader-size-up/down 訴え句（'文字が小さい/大きい'/'読みにくい'/'フォントを大きく/小さくして'）、keyboard 'キーボードを出して/閉じて/しまって'/'show|hide keyboard'、tabs-list 'タブ一覧を読んで'/'開いてるタブ'、read-url 'このページのURL'/'ページのアドレス'、copy-url 'このページのリンク'、trouble '見えにくい'/'見にくい'。
- ~~**マイク停止の自然言語形が未認識（'マイクを切って'/'turn off the mic' 等）**~~ — **Session 128 で実装**: stop へ 'マイクを切って'/'マイクをオフにして'/'マイク停止'/'聞き取りをやめて/停止'/'聞くのをやめて'/'音声認識を止めて/終了'/'turn off the mic'/'turn the mic off'（語順両対応 regex）。
- ~~**video-seek の自然形が未認識（'早送り'/'巻き戻し'/'fast forward'）**~~ — **Session 128 で実装**: 早送り系+巻き戻し系+少し戻して+fast forward。'少し進めて' は navigate-forward 既存所有で対象外（共存テストで断言）。
- ~~**speech-rate の動詞/目的語形が未認識（'読み上げ速度を上げて' 等）**~~ — **Session 128 で実装**: speech-faster/slower へ速度オブジェクト句 + '速読して'/'ゆっくり' + 'speed up/slow down the reading'。
- ~~**read-aloud の全体形が未認識・/read all/ が 'read all headings' を横取り**~~ — **Session 128 で実装**: '全部読んで'/'全て読んで'/'最初から読んで'/'read all/everything/it all'/'from the top/beginning/start' — 既存テストで toc 横取りを検出し `^…$` アンカー化。
- ~~**copy-url/panel-distance/title/read-url/rate-status/paste-go の言い換え欠落**~~ — **Session 128 で実装**: 'コピーして'/'ページをコピー'、サイズ言い換え（'パネルを大きく'→近づける/'小さく'→遠ざける）、'タイトルを読んで'/'whats the title'、'今のページのアドレス'/'whats the url'/'page address'、'再生速度(は)'、'ペーストして'/'貼り付けて'/'paste it'/'paste the clipboard'。
- ~~**読み上げ位置・タブ一覧・コレクション読み上げの言い換え句が未認識（第12弾）**~~ — **Session 129 で実装**: line-status '今どこを読んでる'/'読み上げ位置'/'現在位置'/'読み上げ中'、tabs-list 'タブの一覧'/'タブリスト'/'開いてるもの'/'一覧を読んで'、tab-status 'タブの数'/'ウィンドウの数'、bookmarks/history '読んで' 形、bookmark-count 'お気に入りは何個'、percent-jump bare 'N%'/'N割'（×10 fold）、trouble/audio-trouble 訴え句（'何も見えない'/'真っ白'/'固まる'/'クラッシュ'/'声が出ない'/'音がしない'）、refresh '再起動'、home 'トップページ'/'開始ページ'、hostname/describe-tab 'サイトを教えて'/'このサイトについて'、keyboard 'キーボードを隠して'/'keyboard'、video-toggle/stop/status '再生して'/'動画を停止'/'再生位置'、reader-size bare '拡大'/'縮小'、jump-back 'この場所に戻って'、pause-reading '中断して'。'読み上げ中ですか'/'お気に入り一覧'/'一時停止'/'スタートページ' の既存ルートを共存テストで断言。
- ~~**'右端/左端/先頭/最後に移動' が literal ナビゲート（go-to catch-all 誤ルート）**~~ — **Session 130 で実装**: `move-tab-start`/`move-tab-end` を go-to より前に登録し、TabManager に `moveTabToStart`/`moveTabToEnd` を追加 — pinned タブは pinned クラスタ内端に留める（moveTab の境界規則を継承）。'Xに移動' の site ナビゲートは従来どおり go-to を維持。
- ~~**bulk クローズの残り3種が未実装（重複/非ピン/通常）**~~ — **Session 130 で実装**: `TabManager.closeDuplicateTabs()`（URL 先勝ちで重複の後出現側を閉じる）・`closeUnpinnedTabs()`・`closeNormalTabs()` を追加し音声コマンド登録 — 各 closeTab 経由でピン拒否・クローズスタック規則を継承、0 件は誠実応答。
- ~~**find-again（クエリ再実行）が未実装**~~ — **Session 130 で実装**: repeat-command の検索双子 — 'もう一度検索'/'再検索'/'find again' で `findQuery()` → `findInReader(q)` 再実行。find-in-page より前に登録し 'again' のリテラル検索を回避。
- ~~**戻る/進む・リロード・スクロール・音量/速度系の自然言語句が未認識（第13弾）**~~ — **Session 130 で実装**: back '戻って'/'さっきのページ'、navigate '進んで'、refresh 'ページを再読み込み'/'リフレッシュして'、scroll-down 'スクロール'/'ページをめくって'、speech-rate 'N倍速'/漢数字/'半分の速さ'→0.5/'倍速で'→2、speech-reset '元の速度に戻して'/'標準速度'、percent-jump '半分まで'/'真ん中まで'→50%、trouble '目が痛い'/'疲れた'、online 'つながらない'/'圏外'、connection '回線が悪い'、battery '充電がない'、security 'HTTPSですか'、hostname 'ドメイン名'、unbookmark 'お気に入りから削除'、read-clipboard '何をコピーした'、title 'タブの名前'、find-status '見つからなかった'、総数形 '全部で何行/文/段落'、tab-status '何タブ'、tabs-list '開いてるウィンドウ'、new-tab 'もう一個タブ'、close-tab '閉じて'、pin/unpin 'ピンを付けて/取って'、pause-reading '一旦停止'、video 'ビデオを再生/ポーズ'、speech 訴え形 '読み上げが遅い/速い'。
- ~~**'あと何ページ戻れる/進める' がナビゲートを実行する（質問形の誤ルート）**~~ — **Session 131 で実装**: `history-depth` を back/navigate より前に登録し `historyIdx`/`history.length-1-idx` の残量告知へ — goBack/goForward 非呼出を共存テストで断言。
- ~~**'最初まで戻る'/'履歴の最初に戻る'/'一番最初に戻る' が1歩だけ戻る誤動作**~~ — **Session 131 で実装**: `nav-steps` を registerDefaultCommands 内の back/navigate/home より前に配置（connectBrowser 登録は Map キー位置で負ける — プローブ実測）→ '…に戻る' 語尾の start 形を all-the-way-back に解決。'最初のタブに戻る'/'一つ戻って' は back の単歩維持（漢数字 一 は nav-steps 対象外）。
- ~~**'Nページ戻って/進んで' の多段履歴ナビが未実装**~~ — **Session 131 で実装**: 数字+漢数字（二〜九）+ EN 'back/forward N pages' を `goBack`/`goForward` ループへ — 'Nページ戻り/進みました'、不足は '（これ以上戻れ/進めません）'、0 は誠実応答（Chrome Alt+← 連打準拠）。
- ~~**検索パネル終了・タブ一括/単体閉鎖・VR終了・字幕サイズ・履歴/検索呼び出し・休憩訴えの言い換え句が未認識（第14弾）**~~ — **Session 131 で実装**: clear-find '検索を閉じて/消して/終了'/'ハイライトを解除'、close-all-tabs 'タブを全部閉じる' 等、close-tab 'パネルを閉じて'/'ウィンドウを閉じる'、vr-exit '終了'/'アプリを閉じて'/'ブラウザを閉じて'、caption-size '字幕を大きくして/小さくして'、history-list '閲覧履歴'/'検索履歴'、find-query '最後の検索'、trouble '休憩したい'/'めまいがする'、back 'もっと戻って'/'さっき見たページ'。
- ~~**'最近閉じたタブ' の一覧読み上げが未実装**~~ — **Session 132 で実装**: `TabManager.closedTabs()`（LIFO スタックの最終優先コピー）+ `closed-list` コマンドで 'N個のタブを閉じました。最近から: …'（3件cap）。private/blank タブはスタック非記録のため漏洩なし。読み上げはスタックを消費しない。
- ~~**'お気に入りをすべて開いて' 一括オープンが未実装**~~ — **Session 132 で実装**: `open-all-bookmarks` が `onBookmarkList` を走査し MAX_TABS まで `newTab` — 残りは '上限で残りN件は開けません' と誠実告知（Chrome "open all bookmarks" 準拠）。go-to catch-all より前に登録。
- ~~**'ブックマーク一覧を開いて'/'ページ内検索を開いて'/'検索を開いて' が literal ナビゲート（go-to 誤ルート）**~~ — **Session 132 で実装**: bookmarks-open に一覧 'を開いて' 形を追加、find-in-page に '…を開いて/を開く/検索モード' 形を追加し bare プロンプトへ。'ブックマーク一覧' bare形は bookmarks-list の読み上げを維持（奪取回帰をテストで捕捉・分離）。
- ~~**reopen・閉じる・読み直し・リセンター・音声速度の言い換え句が未認識（第15弾）**~~ — **Session 132 で実装**: reopen-tab '閉じたタブを開き直して'/'開き直して'、close-other-tabs 'このタブだけ残して'/'このタブ以外を閉じて'、bookmark 'しおりを挟んで'、stop-reading '読み上げをやめる'、recenter '正面に戻して'/'向きをリセット'、speech '早口で'/'もっとゆっくり'、read-here '残りを読んで'/'ここを読んで'、read-sentence '今の文を読み直して'、trouble '暗い'/'見えない'/'目を休めたい'、vr-exit '全画面を閉じて'、clear-find 'ハイライトを外して'、close-tab 'このページを閉じて'、bookmarks 'ブックマークを閉じて'、next/prev-page '…を読んで'、say-again '繰り返して'/'聞き取れなかった'、reader-size '大きくして'/'文字が見にくい'。'何と言った' は say-last-transcript（transcript エコー）維持、close-tab-by-name stoplist に '残り' 追加。
- ~~**'N番目のタブを閉じて'/'最初/最後のタブを閉じて' の序数クローズが未実装**~~ — **Session 133 で実装**: `close-tab-ordinal`（数字+漢数字+first/last、close-tab-by-name 先行登録）→ `closeTab(n-1)`、範囲外・ピン留めは誠実応答。tab-select-ordinal が 'N番目のタブを閉じて' を切替に奪っていた実害を実測捕捉し `(?!を閉じ)` で透過。
- ~~**'ピンを付けて' がピン留め済みタブを外す（トグルの嘘）**~~ — **Session 133 で実装**: 一方向 pin の `pin-active`（'ピンを付けて'/'ピンを立てて'/'pin it' → ピン済みは 'すでにピン留めされています' で togglePin 非呼出）+ `unpin-all`（'ピンを全部外して'/'unpin all' → 全ピン解除、0件誠実応答）。
- ~~**'プライベートモードを終了'/'exit private mode'/'通常モードに戻る' の終了双子が未実装＋誤ルート**~~ — **Session 133 で実装**: `private-mode-off` は `_privateMode` 真なら off、偽なら 'プライベートモードはオフです'。'exit private mode' が private-mode トグルを実行（`(?<!exit )` で透過）、'通常モードに戻る' が back の `/戻[るれ]/` で履歴戻りを実行（`(?<!モードに)` で透過、両コピー）していた実害を実測捕捉・修正。
- ~~**'ハイコントラストか'/'is high contrast on' の質問形がトグルを実行**~~ — **Session 133 で実装**: high-contrast regex に `か(?:$|。|？|です)`/`は…です`/`is (on|off|enabled)` 除外、contrast-status へ質問形を登録（状態応答、非呼出を断言）。
- ~~**'中央に移動' が 0% ジャンプ（percent-jump 中点検出の漏れ）**~~ — **Session 133 で実装**: 中点検出に '中央' を追加（'半分|真ん中|中間' のみで '中央' が 0% へ飛んでいた実害）。
- ~~**序数/件数/目次/検索位置/読み上げ・スクロール・字幕・概要・URL・章・履歴の言い換え句が未認識（第16弾、約55ペア）**~~ — **Session 133 で実装**: tab-status 'いくつ開いてる'、toc '目次一覧'/'アウトライン'、find '次のマッチ'/'前のヒットへ'/'検索結果は何件'、read-word 'ふりがな'/'この漢字'、stop/resume-reading 'ナレーションを止めて'/'読書を再開'、read-here 'つづきから'、scroll 'もっと下'/'さらに上'、captions '字幕をオン'、describe-tab '画面を説明して'/'サイト名'、article-summary 'ページの概要'、read-url '今のURL'、next/prev-heading '次の章'、unbookmark 'お気に入りを削除'、clear-history '履歴を消して'、各 count '…いくつ'、reader-scale-status 'フォントサイズ'、privacy-status 'シークレットですか'。
- ~~**'N番目に移動して' の序数移動が literal ナビゲート（go-to 誤ルート）**~~ — **Session 134 で実装**: `move-tab-to-n`（数字+漢数字、move-tab-start/end 後・go-to 前）→ `moveTab(active, n-1-active)`、同位置 'すでにN番目です'、範囲外誠実拒否。move-tab-start/end/left/right に 'に移動して'/'に送って'/'ずらして' 形も追加（'一番右に移動して'/'最後に送って' 等が go-to に流れていた実害）。
- ~~**'どれくらい使ってる' のセッション経過時間が未実装**~~ — **Session 134 で実装**: `session-time`（'screen time' 準拠）がコンストラクタ `_startedAt` から '起動してから約N分です'。
- ~~**'バージョンは'/'ブラウザの名前' が未認識**~~ — **Session 134 で実装**: `about` が 'このブラウザはQui-Browserです'（version 文字列はこの層に来ないため製品名を誠実応答）。
- ~~**'通知を消して' の手動消去が未実装**~~ — **Session 134 で実装**: `dismiss-notify` + 新フック `onDismissNotify`（VRApp は `captionSystem.clear()`）、フック無しは '表示は自動で消えます'。
- ~~**'履歴を検索して'/'ブックマークを検索して' の bare 形が空文字列検索で誤答**~~ — **Session 134 で実装**: term 無しは '検索する語を言ってください' プロンプト、'…をXを検索' 形も捕捉可能に。
- ~~**move/ヘルプ/パネル距離/読み込み/ミュート/復唱/スペル/コピーの言い換え句が未認識（第17弾）**~~ — **Session 134 で実装**: help '操作方法'/'音声ガイド'/'コマンドを教えて' 等、panel-distance '近づけて'/'大きく見せて'、video-stop '曲を止めて'、mute-toggle 'このタブをミュート'/'全部ミュート'、say-last-transcript 'なんて言った'、say-again '復唱して'、spell-word 'スペル'、read-word '発音して'、clear-find '強調を消して'/'選択を解除'、copy-article '全部コピー'、loading-status '読み込み終わった'、remaining-time '残り時間'。
- ~~**'タブを検索して' が 'タブ' を web 検索、'Xのタブを探して'/'find the X tab' がページ内検索になる誤ルート**~~ — **Session 135 で実装**: `tab-search`（find-in-page 前）が title+url 一致で setActive、bare 形は 'タブの名前を言ってください'。
- ~~**'最新の通知'/'通知を読んで' の通知読み上げが未実装**~~ — **Session 135 で実装**: `read-notify` + `CaptionSystem.lastLine()` + 新フック `onReadNotify`、空は '通知はありません'。
- ~~**'ピン留め一覧' のピン留めタブ列挙が未実装**~~ — **Session 135 で実装**: `pin-list` がタイトル列挙。pin-select の loose `/pinned tab/i` を `/^pinned tab$/i` に限定（'read the pinned tabs' の列挙意図を解放）。
- ~~**'リーダーモード'/'ダークモード'/'明るさ'/'印刷'/'スクリーンショット'/'タブを並び替えて' が NO-MATCH で機能欠如と句失敗が区別不能**~~ — **Session 135 で実装**: 誠実不在クラスタ — `reader-mode`（常時ON応答）・`dark-mode`（ハイコントラスト誘導）・`brightness`（本体設定誘導）・`print`・`screenshot`・`sort-tabs`（'N番目に移動して'誘導）。
- ~~**'字幕を見せて'/'出して' がブラインドトグルで ON 要求が OFF に反転**~~ — **Session 135 で修正**: `onOff()` の on 分岐に 見せて|出して を追加（消して→OFF 維持）。
- ~~**'メニューを開いて'/'メニュー' が literal ナビゲート**~~ — **Session 135 で修正**: settings-toggle に 'メニュー'/'メニューを開いて'/'メニューを表示'/'設定を表示して'/'設定を出して'/'open the menu' 追加。
- ~~**'ニュースを見せて'/'写真が見たい' 等のコンテンツ意図句が未認識**~~ — **Session 135 で実装**: web-search に 'を見せて'/'を見たい'/'が見たい' 形追加（タブ/履歴/ブックマーク/設定/通知の '見せて' は先行登録維持）。reader-scale-status にズーム句、tabs-list に 'タブを見せて'。
- ~~**敬体表・丁寧要求尾（ください/ます/頂戴/くれ/もらえ/いただけ）・EN 敬体ラッパー（please/can you…）が全て NO-MATCH**~~ — **Session 136 で実装**: `processCommand` が生マッチ失敗時のみ `_politeVariants()` でリトライ（te/de 尾 + 敬語尾剥がし、ます→て godan 変換、です/でしょう剥がし、EN please/can-you 剥がし）。生フレーズ優先でゼロ回帰設計、て形動作へ dispatch。
- ~~**'help me please' が scoped-help のトピック扱いで '「me」のコマンドはありません' 誤答**~~ — **Session 136 で修正**: scoped-help EN を `(?!me\b)` lookahead + `(?:with|about)` 任意化 + 末尾 'please' 許容へ。
- ~~**'open a new tab'/'add a tab'、'back'/'go back'、'scroll down/up'、'help me'、'cancel' 等の bare EN 自然言語が NO-MATCH**~~ — **Session 136 で実装**: new-tab/close-tab/back/scroll/help/stop-everything 他へ JA/EN エイリアス約40句追加。
- ~~**'戻れない'/'進めない' 等の否定・可能形が back/navigate を実行してページを離れる**~~ — **Session 137 で修正**: `/戻[るれ]/`・`/進[むめ]/` に 〜ない/〜ません/〜ます lookahead（registerDefaultCommands + connectBrowser 両方）、訴え形は back-status/forward-status へ透過。
- ~~**'リンクを開いて'/'リンクに移動' が literal ナビゲート、リンク/ボタン選択面が無いのに NO-MATCH 以外の応答**~~ — **Session 137 で実装**: `links` 誠実不在原子を go-to 前に登録（'読み上げ' 誘導）。
- ~~**'Nつ先の段落'/'skip ahead N paragraphs' の counted 段落ナビが未認識**~~ — **Session 137 で実装**: `paragraph-skip-n` が `_onParagraphStep(±N)`。next-paragraph の loose `/skip ahead/` は `/skip ahead\s*$/` にアンカー。
- ~~**'音声入力'/'ジェスチャー'/'フォントを変えて'/'キャッシュを消して'/'ダウンロード'/'スリープして'/'設定をリセット' が NO-MATCH**~~ — **Session 137 で実装**: `input-methods`/`text-style`/`privacy-clean`/`download`/`sleep-mode`/`settings-reset` 誠実不在原子（各々実在の代替へ誘導）。
- ~~**'3行下に'/'おしゃべりを止めて'/'静音'/'明るすぎる'/'背景を暗く'/'このタブをもう一つ'/'タブを減らして'/'押せない' 等が未認識**~~ — **Session 137 で実装**: reader-scroll-lines 'N行下/上'、stop-reading/mute-toggle/brightness/dark-mode/duplicate-tab/close-tab/trouble/article-summary/print/share-page へのエイリアス拡充。
- ~~**'右のタブに移動'/'右隣のタブ'/'一つ右のタブ' が literal ナビゲートまたは名指し誤答**~~ — **Session 138 で修正**: next-tab/prev-tab に位置句追加、tab-by-name stoplist に位置語を追加。'タブNに移動'/'タブのN番目' は open-tab-n へ。
- ~~**'メモして'/'タイマー'/'メールを開いて'/'音楽を再生'/'テレビを見て' 等のデバイスアプリ句が NO-MATCH または literal ナビゲート**~~ — **Session 138 で実装**: `device-apps` 誠実不在原子（go-to 前に登録）。
- ~~**'画像検索'/'動画を検索' が語そのものの検索または NO-MATCH**~~ — **Session 138 で実装**: `media-search` 誠実不在原子（専用モード欠如を応答）。
- ~~**'早すぎる'/'ゆっくり言って'/'聞き取れない'/'音が小さすぎる'/'声を小さく'/'うるさすぎる'/'あと何分で読み終わる'/'ページ数は'/'さっきの記事'/'通知はある'/'女性の声で'/'タブを並べて' 等が未認識**~~ — **Session 138 で実装**: speech-slower/faster、volume-up/down、remaining-time、reader-progress、history/history-latest、sort-tabs、read-notify、select-voice へのエイリアス拡充。
- ~~**'タブを全部閉じて'/'全タブを閉じて'/'このタブだけ'/'他を全部閉じて' が NO-MATCH**~~ — **Session 139 で修正**: close-all-tabs に て/閉め 形、close-other-tabs に 'だけ' 形追加。
- ~~**'Googleにして'/'Bingで検索'/'グーグルを使って' のエンジン名短縮形が NO-MATCH**~~ — **Session 139 で実装**: search-engine に `名+にして/を使って/で検索/で調べて` パターン。
- ~~**'履歴の最初' が goBack を無限ループさせうる**~~ — **Session 139 で修正**: nav-steps の unbounded リクエストを 50 にキャップ（テストで捕捉）。
- ~~**'検索をやめる'/'検索をキャンセル'/'音声検索'/'ページの末尾'/'フォーカスは'/'今何行目'/'何段落目'/'何見出し目'/'その段落を読んで'/'前の文に戻って'/'もう一行'/'もう一段落'/'もう一文'/'読み込んでいる' 等が未認識**~~ — **Session 139 で実装**: clear-find/web-search/scroll-bottom/where-am-i/line-status/paragraph-status/read-heading/next・prev caret/read-paragraph/nav-steps/loading-status へのエイリアス拡充。
- ~~**'unmute mic' がマイクを停止する**~~ — **Session 140 で修正**: stop の `/mute mic/` が 'unmute' に誤マッチ → `\bmute` 化 + `mic-on` 新設（`this.start()` + '音声認識を再開します'）。
- ~~**'unpin'/'unpin all'/'unpin tab 2' が pin-tab トグル/unpin-active に誤配線**~~ — **Session 140 で修正**: pin-tab を `(?<!un)pin` 化、unpin-active を anchored 化し 'unpin all'→unpin-all・'unpin tab N'→tab-pin-n を維持。
- ~~**'close the tab' が名指し検索で '「the」のタブがありません'**~~ — **Session 140 で修正**: close-tab-by-name の EN lookahead に `the\b` 追加 + close-tab に 'close it'/'close this one' 追加。
- ~~**'go to the top'/'go to bottom'/'go to the home' が literal ナビゲート**~~ — **Session 140 で修正**: go-to EN capture に `(?!the (top|bottom|home)|top|bottom|home|back)` lookahead + scroll-top/bottom/home に該当形追加。
- ~~**EN bare 形の未認識群**~~ — **Session 140 で実装**: 'pause'/'resume'/'continue'/'volume'/'louder'/'quieter'/'zoom'/'list all tabs'/'what page is this'/'start reading'/'exit'/'shut down'/'sleep'/'wake'/'lock' 等 + 誠実不在 `scroll-horizontal`/`window-state`。
- ~~**'閉じてよ'/'進んでね'/'教えてな' 系の文末終助詞が全コマンドで NO-MATCH**~~ — **Session 141 で修正**: `_politeVariants` に終助詞ストリップ層を追加（よ/ね/な/ぞ/ぜ/わ/とも/さ/よね/なあ/ねえ + 句読点）。
- ~~**'閉じろ'/'読め'/'黙れ'/'早くしろ'/'遅くしろ'/'静かにしろ'/'音消して'/'字幕消して' の命令形・を助詞なし形が未認識**~~ — **Session 141 で実装**: close-tab/read-aloud/speech-faster/slower/stop-reading/volume-down/mute-toggle/captions-toggle への語幹・口語形追加。
- ~~**'閉じないで'/'やめておいて'/'しなくていい'/'never mind' の否定要求が '認識できません'**~~ — **Session 141 で実装**: `negate` 誠実無操作原子（全コマンド最後に登録、'承知しました。実行しません'）。'読まないで'→stop-reading・'聞かないで'→stop の共存を保証。
- ~~**'何が開いてる'/'どこだっけ'/'どんなサイト'/'聞かないで' 等の口語問い合わせ形が未認識**~~ — **Session 141 で実装**: tabs-list/where-am-i/describe-tab/stop へのエイリアス拡充。
- ~~**'どうやって戻る'/'どうやって進む' の how 質問がナビゲートを実行**~~ — **Session 142 で修正**: back/navigate regex に `(?<!どうやって)` lookbehind（両コピー）+ help へ `/どうやって/`・'どうすればいい'/'how do i' 追加。
- ~~**'ありがとう'/'わかった'/'OK'/'got it' の社交応答が認識エラー**~~ — **Session 142 で実装**: `ack` 原子（ありがとう系→'どういたしまして'、確認系→'承知しました'）。
- ~~**'違う'/'間違えた'/'もういい'/'結構です'/'ほっといて'/'leave it' の訂正・辞退が認識エラー**~~ — **Session 142 で実装**: `negate` に訂正・辞退句を拡充（'承知しました。実行しません'）。
- ~~**'閉じてもいい'/'閉じたいんだけど'/'閉じちゃって'/'閉じといて'/'閉じたまえ'/'えっと閉じて'/'何が開いてるかな'/'i wanna go back' 等の口語・談話形が未認識**~~ — **Session 142 で実装**: `_politeVariants` に許可・願望・関西'といて'・'ちゃって'・'たまえ'・'かな'/'けど'尾・談話前置詞・EN casual wrapper を追加 + close-tab 'close' bare 形。
- ~~**'2個前のタブ'/'最後から二番目'/'second from the end' の相対位置指定が tab-by-name に「二個前」のタイトル誤検索**~~ — **Session 143 で実装**: `tab-relative` 原子（`tab-by-name` 前に登録、数字+漢数字の N個前/後・最後から/後ろからN番目・EN 'N/first-second-third from the end' → setActive、範囲外は誠実拒否）。
- ~~**'go to the end'/'the end'/'all the way down' が literal ナビゲートまたは未認識**~~ — **Session 143 で修正**: go-to EN lookahead を `end|beginning` へ拡張 + scroll-bottom/top に 'all the way'/'way'/'go to the end' 形追加。
- ~~**'消しちゃった'/'間違えて閉じた'/'戻して'/'take it back' の誤操作報告が認識エラー**~~ — **Session 143 で実装**: reopen-tab に誤操作報告形を拡充（最近閉じたタブを復元）。
- ~~**'えっ'/'何て'/'huh'/'pardon'/'come again' の聞き取り修復要求が認識エラー**~~ — **Session 143 で実装**: say-again に修復要求形を追加（直前発話の再話）。
- ~~**'もう一度閉じて'/'read on'/'carry on'/'keep going'/'さっきより早く'/'大きい声で'/'声を出して'/'聞こえますか'/'動かない' が未認識**~~ — **Session 143 で実装**: prefixRe に 'もう一度/もう一回/もういちど'（bare 'もう一度' は say-again 維持）、resume-reading/speech-faster/volume-up/mic-status/trouble へのエイリアス拡充。
- ~~**'どのタブが音出てる'/'どのタブか忘れた' が tab-by-name に「ど」タイトル誤検索**~~ — **Session 144 で修正**: tab-by-name stoplist に 'どの|今どの' 追加 + `tab-audio` 誠実不在原子（タブごとの音声検出なし→ミュート誘導）、'どのタブか忘れた'→describe-tab/'今どのタブ'→where-am-i。
- ~~**'誰が書いた'/'著者は誰'/'いつの記事'/'公開日は' のメタ情報質問が認識エラー**~~ — **Session 144 で実装**: `tab-meta` 誠実不在原子（著者・公開日は抽出不可、describe-tab へ誘導）。
- ~~**'読み終わったら閉じて'/'通知が来たら教えて'/'シャッフルして' の条件付き・ランダム要求が認識エラー**~~ — **Session 144 で実装**: `conditional` 誠実不在原子。
- ~~**'タブを全部ピン留め' に pin-all が不在**~~ — **Session 144 で実装**: `pin-all`（unpin-all の双子、未ピンタブを一括 togglePin、全ピン済みは誠実応答）。
- ~~**'音量ゼロにして'/'最大音量で' が数値必須の volume-set で未認識**~~ — **Session 144 で実装**: volume-set にゼロ/最大の名前付き目標分岐（/最大|max|full/→100、/ゼロ|zero/→0、/半分|half/→50）。
- ~~**ステータス・エイリアスの残欠落**~~ — **Session 144 で実装**: 'ズーム率は'→reader-scale-status、'今の速さは'→speech-rate-status、'あと何ページ'→reader-progress、'このページについて'→describe-tab、'このタブを複製'/'もうひとつ開いて'→duplicate-tab、'新しいタブをもう一つ'/'another tab'→new-tab、'ページを拡大して'→reader-size-up、'リーダーを閉じて'/'元のページに戻して'→reader-mode（常時ON応答）、'さっきのサイト'→back（両コピー）、'PDFに保存'→print、'スクショして'→screenshot、'タブが多すぎる'→tabs-list、'近くに寄せて'→panel-distance。
- ~~**'Wi-Fiを切って'/'Bluetoothをつけて'/'機内モード'/'パススルー'/'ガーディアン'/'カメラを起動' が online-status 誤答または認識エラー**~~ — **Session 145 で実装**: `device-settings` 誠実不在原子（online-status 前に登録、'ヘッドセットの設定で操作してください'。'Wi-Fiは' は online-status 維持）。
- ~~**'1分進めて'/'5分戻して'/'30秒スキップ' が navigate/back を実行または未認識**~~ — **Session 145 で修正**: video-seek に `N分(戻|進)`・`N(秒|分)スキップ` 追加（分→秒換算）。'進んで' は navigate 維持。
- ~~**'頭から再生'/'最初から再生して'/'動画を最初から' が未認識**~~ — **Session 145 で実装**: video-seek リスタート分岐（delta -1e9、ホスト側 clamp。EN 'from the beginning'/'skip ahead' は read-aloud/paragraph-skip が既存所有で対象外）。
- ~~**'10割る3'/'1足す2は' の算術が percent-jump 誤ジャンプまたは認識エラー**~~ — **Session 145 で実装**: percent-jump 'N割' に `(?!る|り)` lookahead + `calc` 原子（四則・EN plus/minus/times/divided by・0除算拒否、'計算して' bare は式プロンプト）。
- ~~**'チュートリアルを開いて'/'音声ガイドを読んで' が literal ナビゲート**~~ — **Session 145 で修正**: go-to lookahead に チュートリアル|ガイド|ヘルプ|使い方 + help に句追加。
- ~~**'ここをコピー'/'この段落をコピー'/'リンクのURLをコピー' が認識エラー**~~ — **Session 145 で実装**: `copy-selection` 誠実不在原子（'記事をコピー''URLをコピー''行をコピー' へ誘導）。
- ~~**'今日の天気'/'天気を教えて'/'最新ニュース'/'面白い記事' のトピック質問が認識エラー**~~ — **Session 145 で実装**: web-search にトピック句 + 'Xを教えて' 形（'使い方を教えて'→help、'音声検索'→プロンプト維持）。
- ~~**'コントローラーが効かない'/'メモをして'/'5分タイマー'/'もっと暗く'/'キャプションを隠して'/'再生位置は'/'あとで読み直す'/'読み上げを早送り' が未認識**~~ — **Session 145 で実装**: trouble/device-apps/brightness/captions-toggle/video-status/bookmark-page/speech-faster へのエイリアス拡充。
- ~~**'閲覧履歴を見せて'/'曜日を教えて' が web 検索に流出**~~ — **Session 146 で修正**: history に '閲覧履歴を見せて'/'履歴はどこ'、date に '曜日を教えて'/'曜日は何'/'日付は' 追加（登録順が先行し web-search に勝つ。onGoTo 非呼出を断言）。
- ~~**'プロフィールを開いて'/'読み上げを開始'/'音読を開始' が literal ナビゲート**~~ — **Session 146 で修正**: go-to lookahead に 読み上げ|音読|プロフィール|アカウント|パスワード + read-aloud に '読み上げを開始'/'音読を開始'/'読み始めて'/'音読して'/'読み聞かせて'/'もう一回最初から'/'初めから' 追加（onGoTo 非呼出を断言）。
- ~~**'ログインして'/'パスワードを教えて'/'アカウント設定' が検索または未認識**~~ — **Session 146 で実装**: `account` 誠実不在原子（'サイト内で操作してください'。web-search より先行登録で 'パスワードを教えて' を獲得）。
- ~~**'縦にして'/'画面を回転'/'分割して'/'2画面にして'/'お気に入りを全部消して' が未認識**~~ — **Session 146 で実装**: `orientation`（回転なし）・`split-view`（'新しいタブ'誘導）・`clear-bookmarks`（'ブックマークを外して'誘導）誠実不在原子。
- ~~**'ページを送って'/'友達に送って'/'リンクを共有'/'シェアして'/'もうちょっと下'/'ずっと下'/'タブを整理して'/'通知を止めて'/'ダウンロード履歴'/'この文を翻訳して'/'声を止めて'/'画面がちらつく'/'フルスクリーンで見たい'/'通知設定'/'どんどん進んで' が未認識**~~ — **Session 146 で実装**: share-page/scroll-down・up・bottom/sort-tabs/dismiss-notify/download/translate-page/stop-reading/trouble/vr-enter/settings-toggle/resume-reading へのエイリアス拡充（'閲覧履歴' bare は history-list 維持）。
- ~~**'ヘルプを開いて'/'サポート'/'問い合わせ'/'やり方は' が未認識**~~ — **Session 147 で実装**: help にエイリアス追加（go-to lookahead が ヘルプ を所有するため裸形は NO-MATCH だった）。
- ~~**'これは何'/'何これ'/'このページは何'/'説明して'/'誰のサイト'/'URLはどこ'/'危険ですか'/'暗号化されてる' が未認識**~~ — **Session 147 で実装**: describe-tab/hostname/security-status への質問形（'このページは'→where-am-i、'内容を教えて'→article-summary 維持の共存テスト）。
- ~~**'最後まで読んで'/'あと全部読んで'/'残り全部'/'全部読み上げて'/'すべて読んで' が未認識**~~ — **Session 147 で実装**: read-here/read-aloud への読了形。
- ~~**'標準の速さで'/'もとの速さに'/'速度リセット'/'速さを戻して'/'読み上げ速度を戻して' が未認識**~~ — **Session 147 で実装**: speech-reset へのカジュアル形 + speech-faster '早口で読んで'/'速めで読んで'。
- ~~**'音量を最大'/'音量を最小'/'音量をゼロ'/'声を上げて'/'声を下げて'/'ボリュームを上げて/下げて'/'音を切って'/'ミュート解除して'/'ミュートを外して'/'音をつけて' が未認識**~~ — **Session 147 で実装**: volume-set 名前付き目標（最小→0）、volume-up/down 動詞形、mute-toggle 拡張（want 判定に 外して|つけて|ならして|ありにして を追加して '音をつけて' をミュートではなく解除方向へ）。
- ~~**'最近のタブ'/'使用中のタブ'/'アクティブなタブ'/'今のタブ'/'選択中のタブ' が「Xのタブがありません」誤検索**~~ — **Session 148 で修正**: tab-by-name の lookahead stoplist に 最近|使用中|アクティブな|今|選択中 + describe-tab へ該当句。
- ~~**'右に移動して'/'左に移動して' が literal ナビゲート**~~ — **Session 148 で修正**: move-tab-right/left に 'に移動して'/'に動かして' 形追加（onGoTo 非呼出を断言）。
- ~~**'人気の記事'/'ランキング'/'急上昇'/'トレンド'/'おすすめを読んで' が未認識**~~ — **Session 148 で実装**: top-sites へ推薦/ランキング句（最頻サイト一覧が唯一の honest 推薦面）。'おすすめの記事'→web-search 維持の共存テスト。
- ~~**'リーディングリスト'/'保存した記事'/'後で読むリスト'/'ウォッチリスト' が未認識**~~ — **Session 148 で実装**: bookmarks-open へ保存リスト句。
- ~~**'タブを一覧'/'タブの一覧を出して/見せて'/'開いたタブ全部'/'タブ数'/'開いてる数'/'全部で何個'/'どのくらい開いてる'/'タブが重い'/'タブ多すぎ'/'パネルが多い'/'ウインドウを閉じて'/'画面を閉じて'/'パネルを減らして' が未認識または検索流出**~~ — **Session 148 で実装**: tabs-list（'タブの一覧を見せて' は web-search 'Xを見せて' から回収）/tab-status/close-tab へのエイリアス。
- ~~**'パネルを動かして'/'右に寄せて'/'上に上げて'/'目の高さ' が未認識**~~ — **Session 148 で実装**: `panel-move` 誠実不在原子（横/縦移動は視線つかみ操作のみ。'近づけて' 誘導）+ panel-distance 方向判定に 'こっち'/'手前'/'奥' + recenter '中央にして'/'リセンターして'/'向き直して'。
- ~~**'履歴消して'/'履歴を削除して' が未認識（regex が 消去|削除|クリア|消す のみ）**~~ — **Session 149 で実装**: clear-history へ '履歴消して'/'消去して'/'削除して'/'クリアして'。
- ~~**'キャッシュ削除'/'データを消して'/'パスワードを消して'/'オートフィルを消して'/'ダウンロードを消して' が未認識**~~ — **Session 149 で実装**: privacy-clean 拡張（'パスワードを教えて'→account 維持の共存テスト）。
- ~~**'再生履歴'/'視聴履歴'/'購入履歴' が未認識**~~ — **Session 149 で実装**: `other-history` 誠実不在原子（'「履歴を読んで」で閲覧履歴を聞けます'）。
- ~~**'最近の履歴'/'昨日の履歴'/'履歴を一覧'/'履歴を確認' が未認識・'いつ見た'/'さっきのページは'/'前に見たサイト' が未認識**~~ — **Session 149 で実装**: history-list へ日付/bare 形、history-latest へ 'いつ見た' 系（'履歴を見て'→history、'さっき見たページ'→back 維持の共存テスト）。
- ~~**'読みかけ'/'止めたところから'/'読み終わった'/'半分読んだ'/'何分残ってる' が未認識**~~ — **Session 149 で実装**: resume-reading（読みかけ系）/read-here（'途中から'）/reader-progress（読了・途中系）/remaining-time（'何分残ってる'系）へのエイリアス（'再開して'→video-toggle 維持）。
- ~~**'行頭に戻る'/'一文字戻る'/'単語を戻る'/'頭に戻る' が back で1ページ戻る誤動作**~~ — **Session 150 で修正**: back regex へ (?<!一文字)(?<!ひと文字)(?<!一単語)(?<!ひと単語)(?<!単語を)(?<!行頭に)(?<!頭に)(?<!一つ)(?<!ひとつ)(?<!頭まで) lookbehind + '一つ戻る'/'ひとつ戻る' を bare リテラルで維持（navigate 側も 進む に同系 lookbehind）。
- ~~**'行頭'/'行末'/'文頭'/'文末'/'語頭'/'語尾'/'段落の先頭'/'最初の文字'/'beginning of line'/'word by word' 等キャレット端ジャンプ句が未認識**~~ — **Session 150 で実装**: `caret-edge` 誠実不在原子（'「一文字戻る」「次の単語」で細かく動けます'）。
- ~~**'一文字進んで'/'ひと文字'/'一文字ずつ進んで'/'一文字前'/'ひと文字戻る' が未認識**~~ — **Session 150 で実装**: next-char/prev-char へ単位移動形。
- ~~**'単語を進んで'/'次の単語へ'/'単語単位'/'語を飛ばす'/'一単語戻る'/'前の単語へ' が未認識**~~ — **Session 150 で実装**: next-word/prev-word へ方向形。
- ~~**'一行目'/'二行目' の漢数字序数・'最終行'/'最後の行目'・'spell that/this' が未認識**~~ — **Session 150 で実装**: reader-goto-line の行目 capture を漢数字対応（KANJI map）+ last-line/spell-word エイリアス。'30行目'→reader-goto-line 維持の共存テスト。
- ~~**'末尾に飛んで'/'末端まで'/'先頭に飛んで'/'頭まで戻る' が未認識**~~ — **Session 150 で実装**: scroll-bottom/scroll-top へ 飛んで/まで 形。
- ~~**'go to sleep' が literal ナビゲート・'おやすみ'/'寝る'/'スタンバイ'/'起きて'/'ウェイクアップ' が未認識**~~ — **Session 151 で実装**: sleep-mode へ JA 睡眠双子 + 'good night'/'go to sleep'/'wake me up'（onGoTo 非呼出を断言）。
- ~~**'クリックして'/'押して'/'タップして'/'選択して'/'フォーカスして'/'入力して'/'入力欄' が未認識**~~ — **Session 151 で実装**: input-methods へ要素ジェスチャー・入力句（'見つめて選ぶ' 誘導）。
- ~~**'何を開いてる'/'開いているもの' が go-to で literal ナビゲート**~~ — **Session 151 で修正**: tabs-list へ '何を開いてる'/'開いているもの'/'開いてるものは'/'開いてるやつ'。
- ~~**'読み進めて'/'読み上げを進めて' が navigate でページ forward 実行**~~ — **Session 151 で修正**: navigate の 進め 分岐へ (?<!読み|上げを) lookbehind + resume-reading へ '読み進めて'/'読み上げ続けて'/'続けて読んで' 等。
- ~~**'ゆっくりと'/'丁寧に'/'はっきりと'/'急いで'/'さっさと' が未認識（副詞形）**~~ — **Session 151 で実装**: speech-slower/speech-faster へ副詞形。
- ~~**'さっき閉じたやつ'/'閉じたばっかり'/'間違って閉じた'/'閉じる前のタブ' が未認識**~~ — **Session 151 で実装**: reopen-tab へ口語・誤操作形。
- ~~**'小さくして'/'近くで見せて'/'ズームして'/'飛ばして' が未認識**~~ — **Session 151 で実装**: panel-distance（近/遠方向判定継承）・reader-scale-status・next-paragraph へ。
- ~~**'ボリュームを上げる'/'音量をあげる'/'音量を下げる' 等の る-動詞形が未認識**~~ — **Session 152 で実装**: volume-up/down へ る 終止形（'上げる'/'下げる'/'あげる'/'さげる'）。
- ~~**'字幕を表示'/'字幕を非表示'/'字幕なし'/'字幕あり'/'show/hide captions' が未認識＋'字幕を消す' がブラインドトグル**~~ — **Session 152 で修正**: captions-toggle へ表示/非表示/あり/なし形 + `onOff()` の want 判定に 表示|出す|つける|あり（true）・非表示|隠す|なし|消す（false）を追加し明示方向を要求。
- ~~**'今の文'/'この文'/'今の行'/'読んでるところ'/'今の段落' が未認識**~~ — **Session 152 で実装**: read-sentence/line-status/paragraph-status へ現在位置句。
- ~~**'コマンドは'/'どんなコマンド'/'操作方法は'/'命令一覧' が未認識**~~ — **Session 152 で実装**: help へ発見可能性句。
- ~~**'もう戻れない'/'これ以上戻れない'/'戻れるページは' が未認識（進 twin 同）**~~ — **Session 152 で実装**: back-status/forward-status へ不平形（ナビゲート非実行を断言）。
- ~~**'履歴はある'/'履歴を教えて' が未認識**~~ — **Session 152 で実装**: history-list へ存在質問形。
- ~~**'反応が遅い'/'重たい'/'もたつく'/'読むのが遅い' が未認識**~~ — **Session 152 で実装**: trouble へ性能訴え、speech-faster へ '読むのが遅い'（読書速度の訴え）。
- ~~**'行を進めて' が navigate でページ forward 実行**~~ — **Session 153 で修正**: navigate の 進め lookbehind に 行を を追加 + next-line に '行を進めて'/'一つ下へ'、prev-line に '行を戻って'/'一つ上へ'。
- ~~**'もっと下に'/'下に行って'/'上に行って'・'ページ送り'/'ページを戻して' が未認識**~~ — **Session 153 で実装**: scroll-up/down へ方向句、next-page/prev-page へめくれ/戻して形（'ページを送って'→share-page・'めくって'→scroll-down 維持の共存テスト）。
- ~~**'男の声で'/'女性の声'・'言語を変えて'（言語指定なし）が未認識/無指定で常に日本語へ切替**~~ — **Session 153 で修正**: select-voice へ性別句、language-switch へ bare 形 + 言語指定なしは '日本語または英語を指定してください' プロンプト。
- ~~**'ピン留めしてる'/'お気に入りに入ってる'/'保存してる' の状態質問が未認識**~~ — **Session 153 で実装**: pin-status/bookmark-status へ てる形。
- ~~**'エラーが出た'/'止まった'/'勝手に閉じた'/'開けない'/'リンクが開けない' が未認識**~~ — **Session 153 で実装**: trouble へ障害報告形、links へ 'リンクが開けない'。
- ~~**'字が見えない'/'ズームアップ'・'さっきのところ'・'頭から読んで'・'音量を元に戻して' が未認識**~~ — **Session 153 で実装**: reader-size-up/jump-back/read-aloud/settings-reset へ。
- ~~**'scroll to the top/bottom'・'jump to top/bottom' が未認識（regex の 'to the' 間隙）**~~ — **Session 154 で修正**: scroll-top/bottom の regex を `(to( the)? )?` 化 + jump-to 形。
- ~~**'slower'/'faster' 裸形・'pause this' が未認識**~~ — **Session 154 で実装**: speech-slower/faster へ /^slower$//^faster$//more slowly|quickly/、pause-reading へ 'pause (it|this)'。
- ~~**'what did you say'・'リピート'/'今のを繰り返して'/'今の言葉' が未認識**~~ — **Session 154 で実装**: say-again へ聞き返し・繰り返し句。
- ~~**'もう一度再生'/'リプレイ'/'play it again' が +10秒スキップしていた**~~ — **Session 154 で修正**: video-seek の restart 判定に もう一?回|もう一度|リプレイ|play (it )?again を追加し冒頭へシーク。
- ~~**'what page'/'what site'・'am i online'・'whats playing'・'go offline' が未認識**~~ — **Session 154 で実装**: describe-tab（'…is this' は where-am-i 維持）/online-status/video-status/device-settings へ。
- ~~**'clear my history'・'too small'/'make it bigger'・'im stuck'/'it froze'・'聞こえにくい' が未認識**~~ — **Session 154 で実装**: clear-history/reader-size/trouble/audio-trouble へ + panel-distance 'もうちょっと大きく'・stop-everything 'やめさせて'。
- ~~**'go to main content'/'next landmark' が literal ナビゲート/未認識**~~ — **Session 155 で修正**: `landmarks` 誠実不在原子（go-to 前登録）→ '「目次」で見出しを確認できます'。
- ~~**'next link'/'前のリンク'・'next field'/'テキストボックス'・'all caps'/'大文字にして'・'select all'/'テキストをコピー' が未認識**~~ — **Session 155 で実装**: links/input-methods/text-style/copy-selection 誠実応答へ。
- ~~**'redo'/'やり直して' が未認識（undo の双子なし）**~~ — **Session 155 で実装**: `redo` 誠実不在原子 → '「元に戻して」で閉じたタブを開き直せます'。
- ~~**'search the page for X'/'look for X' が未認識**~~ — **Session 155 で実装**: find-in-page へ EN capture 形2系。
- ~~**'what can you do'/'command list'・'what word/letter is this'・'how is it spelled'・'what speed'・'where is the panel'・'am i at the top'・'where i left off' 等が未認識**~~ — **Session 155 で実装**: help/word-status/char-status/spell-word/speech-rate-status/recenter/reader-progress/resume-reading へ + 'quit the app'→vr-exit、'restart the app'/'reboot'→device-settings、'magnify'→reader-size-up、'拡大率'→reader-scale-status、微量スクロール形。

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
- ~~**`TabManager` のタブストリップ本体の色**は未抽出（掃引に含まれていない）。同じ手順で閉じられる。~~ — **Session 75 で解決**: `chromeColors.js` に `tabStripColors(highContrast)` を抽出（通常モードは旧リテラルと同一値で非回帰、HC は `prefersHighContrast()` で配線）。contrast スイープに strip 系6ペア + Top Site タイル3ペアを追加し、全ペア WCAG 2 合格をテストで固定。

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
- ~~**'did i bookmark this' がブックマークをトグルし、'am i muted' がミュートをトグルし、'is the mic on' がマイクを起動していた（質問形が実行していた）**~~ — **Session 156 で修正**: bookmark-page に (?<!did i )、mute-toggle に (?!d\b)、mic-on に (?<!the )…(rophone)? を付与し各 status 系へ透過（mute-status 'ミュートしてる'/'am i muted'/'are we muted'、bookmark-status 'did i bookmark'/'have i bookmarked'/'ブックマークした'、mic-status 'mic check'）。
- ~~**'close the tab on the right/left' がアクティブタブを閉じていた**~~ — **Session 156 で修正**: close-tab の lookahead を (?!\s*(?:\d|on\b|to\b)) 化し位置句では実行しない（誤閉じより未認識が安全）。
- ~~**'go to my email tab'/'open X tab'/'open my settings' が go-to で literal ナビゲート**~~ — **Session 156 で修正**: goToEn lookahead に settings\b と 'tab' 語尾除外を追加 → tab-by-name へ /^(go to|jump to|open) (the |my )?(.+?) tab$/、settings-toggle へ /open (my |the )?settings/・/settings please/・/^settings$/。device-apps の /(email|mail)/ が 'open my mail tab' を奪っていたのも (?!.*\btab\b) で修正。
- ~~**'go forward 30 seconds'/'skip ahead 30 seconds'/'jump forward 5 minutes' が navigate または NO-MATCH**~~ — **Session 156 で実装**: video-seek へ単位付き skip/jump/go forward N sec/min 形（'skip ahead 4 paragraphs' は paragraph-skip-n 維持）+ EN minutes の分計算。
- ~~**'close the other tabs'/'close my tabs'/'close everything' が未認識**~~ — **Session 156 で実装**: close-other-tabs の /close\s+(the |all the |all )?other tabs/ 化、close-all-tabs へ /close (all )?my tabs/・/^close everything$/。
- ~~**'take/send/bring me back'・'forward a page'/'one page forward' が未認識**~~ — **Session 156 で実装**: back へ /(take|send|bring) me back/（両コピー）、navigate へ /forward (a|one|the) page/・/one page forward/（'go forward' は (?! \d) で維持）。
- ~~**'tell me the time'/'時計'・'whats my battery'・'version number'/'who made this'/'バージョン番号'・'when did i visit'/'have i been here'/'前に来たことある' が未認識**~~ — **Session 156 で実装**: time/battery-status/about/history-latest へ。
- ~~**'to the top/bottom'・'go back up'・'move it closer'/'push it away'/'shrink the window'・'read this faster'/'speed it up'/'slow down'・'press enter'/'エンターを押して'・'its not working'/'cant see anything'/'見えない'/'動いてない'・'cant hear anything' が未認識**~~ — **Session 156 で実装**: scroll-top/bottom/panel-distance/speech-faster/slower/input-methods/trouble/audio-trouble へ（'can see' 系は audio-trouble でなく trouble へ）。
- ~~**'microphone' が (raphone)? typo で未認識**~~ — **Session 156 で修正**: mic-on/mic-off/mic-status 全4箇所を (rophone)? へ。
- ~~**'find my tab' が 'my' を検索語にしていた**~~ — **Session 156 で修正**: tab-search の term 抽出に my/the/a 単独ストップワード除外（→ 'タブの名前を言ってください' プロンプト）。
- ~~**'reopen my last tab' が last-tab で右端タブに切り替わり、'close the tab i just closed' がアクティブタブを閉じていた**~~ — **Session 157 で修正**: reopen-tab を /reopen(?!.*\ball\b).*\btab\b/ 化 + 'bring back my tab'/'the tab i closed'/'ctrl z'/'ctrl+z' 追加、close-tab に i\b lookahead。
- ~~**'今のタブを閉じて'/'幾つのタブ'/'違うタブ' が by-name の term 誤検索・未認識**~~ — **Session 157 で修正**: close-tab-by-name/tab-by-name の stoplist に 今|幾つ|何個|違う 追加 → close-tab/tab-status/next-tab へ。
- ~~**'help please' が scoped-help で '「please」のコマンドは0個' と誤答**~~ — **Session 157 で修正**: scoped-help に (?!please\b)（既存 (?!me\b) と並置）→ polite 層経由で help へ。
- ~~**'tomorrow'/'明日は何日'/'next week'/'来月'/'今年'/'whats the date' 等の相対日付が未認識**~~ — **Session 157 で実装**: date アクションが明日(+1)/明後日(+2)/来週(+7)/来月/来年/今年を計算して応答。
- ~~**'level two heading'/'h2'/'heading level 2' が未認識**~~ — **Session 157 で実装**: `heading-level` 誠実不在原子（→'「2番目の見出し」で順番に選べます'）+ heading-select に first–tenth の EN 序数（action で単語→数値マップ）。
- ~~**'go youtube'/'youtube に行って'/'close app'/'switch tabs'/'be quiet'/'move up'/'cancel all'/'真っ暗だ'/'最大化して'/'what should i say'/'もっと早く読んで'/'読み続ける' 等が未認識**~~ — **Session 157 で実装**: goToEn bare 'go X'（方向/ホーム語は stoplist で除外）+ goToJp 'に行って'/'へ行って' 尾、vr-exit/next-tab/mute-toggle/scroll/stop-everything/trouble/window-state/help/speech-faster/resume-reading へ各形追加。
- ~~**'今の音量を教えて' が web-search で '音量' を検索していた**~~ — **Session 158 で修正**: volume-status の exact literal '音量を教えて' に '今の' 前置形が無かった → '今の音量を教えて'/'音量を確認'/'声の大きさ'/'音量を変えて'（数値なしの変更要求は status 応答で現量提示 — volume-set へ流すと missing digit が 0 に coerce される）追加。
- ~~**'読み直して'/'頭から読み直して' が say-again で直前発話のリプレイのみ**~~ — **Session 158 で修正**: 読み直しは「ページを読み返す」意図 → read-aloud へ移動（'もう一度' は say-again 維持）。
- ~~**'左側のタブ'/'もっと左のタブ'/'真ん中のタブ' が by-name でタイトル誤検索**~~ — **Session 158 で修正**: prev/next-tab に 左側/右側/もっと左/もっと右 形追加、tab-by-name stoplist に 真ん中|左側|右側|もっと → '真ん中のタブ' は誠実な NO-MATCH。
- ~~**'わからん'/'使い方教えて'/'どうする'/'操作がわからない' が未認識、褒め句('すごい'/'いいね'/'great')が未認識**~~ — **Session 158 で実装**: help に迷子句9形、ack に感謝強形 + 褒め句（→'ありがとうございます' 応答分岐）。
- ~~**'天気は'/'ニュースを聞かせて'/'調べて'/'検索させて'/'google で検索して' が未認識**~~ — **Session 158 で実装**: web-search に話題 alternation（天気/気温/湿度/ニュース形）+ 非 capture の裸動詞形（調べて/検索させて → '検索語がありません' プロンプト、term を動詞自身にしない）。
- その他 fill: read-aloud '読みたい'/'読んでほしい'、first/last-tab '最初のやつ'/'最後のやつ'、text-style '文字を変えて'、reader-size-up '読みやすくして'/'見やすくして'、trouble '眠い'/'頭痛い'/'めまい'/'ふらつく'。
- ~~**進行・状態の疑問句が未認識**（'読んでる最中'/'再生中'/'喋ってる'/'ミュートになってる'/'お気に入り登録してる'/'聞こえます'）~~ — **Session 159 で実装**: speaking-status/video-status/mute-status/bookmark-status/mic-status に進行・状態形を追加。
- ~~**'is it working'/'did it work'/'動いてる'/'止まってる' が未認識**~~ — **Session 159 で実装**: `working-status` 原子（'音声認識は動作中です。「ヘルプ」で…'）— 'is it frozen' は trouble が先行所有のため維持。
- ~~**能力疑問句が未認識**（'できる'/'できますか'/'対応してる'/'what can i do'/'can i close this'）~~ — **Session 159 で実装**: help へ /can i /i + JA 可能形。'can i go back/forward' は back/forward-status が先行登録のため維持（共存テスト）。
- ~~**'any notifications'/'any tabs open' が未認識**~~ — **Session 159 で実装**: read-notify/tab-status へ EN 存在疑問形。
- ~~**反応句が未認識**（'なるほど'/'へー'/'本当ですか'/'まじか'/'確かに'）~~ — **Session 159 で実装**: ack へ追加（承知しました）。
- その他 fill: read-aloud '読んでくれる'/'読んでおいて'、speaking-status '喋ってる'、bookmark-status 'ブックマークに追加した'。
- ~~**~てみる/~てしまう/~ちゃう/~てあげて/~てもらう の動詞語尾が全コマンド未認識**~~ — **Session 160 で実装**: `_politeVariants` に語尾層追加（てみる→て、てしまう→て、ちゃう/じゃう→て、てあげて/てもらう→て）。'戻ってみる'→back、'読んであげて'→read-aloud、'閉じちゃう'→close-tab（'閉じちゃった'/'消えちゃった' は reopen-tab の raw リテラルが先行）。
- ~~**'where are we'/'whats this site'/'who is this'/'when was this'/'what does this say' が未認識**~~ — **Session 160 で実装**: where-am-i/tab-meta/read-aloud へ（'who made this' は about 所有 — 共存テスト）。
- ~~**'お願い'/'頼む'/'please do'/'pls help'/'help me out' が未認識**~~ — **Session 160 で実装**: help へ。
- ~~**bare '早く'/'遅く'/'ボリューム'、命令形 '止めろ'/'探せ'/'調べろ'、'置いといて' が未認識**~~ — **Session 160 で実装**: speech-faster/slower、volume-status、stop-everything、find-in-page、web-search（→プロンプト）、negate へ。
- その他 fill: scroll 'もうちょい上/下'/'keep scrolling'、line-status 'どこ読んでた'、read-here '続きは'/'次の部分'、remaining-time 'あと少し'、share-page '送って'（'送っちゃって' は語尾層経由）。
- ~~**~ちゃお/~じゃお 意志形・~なきゃ 義務形・二重語尾（~てあげてください 等）が未認識**~~ — **Session 161 で実装**: `_politeVariants` に語尾層III（ちゃお→て、じゃお→で、なきゃ→あ行五段→て形マップ+一段→て、てあげてください/てくださると/ていただければ/てほしいな→て）。'閉じちゃお'→close-tab、'読まなきゃ'→read-aloud、'閉じてほしいな'→close-tab。
- ~~**'かい' 終助詞・EN 短縮前置詞（gonna/wanna/gotta/gimme/lemme）が未認識**~~ — **Session 161 で実装**: 文末粒子ストリップに かい/かいな、EN prefix 層に bare gonna|wanna|gotta|gimme|lemme|imma（'wanna go back'→back、'gonna close this'→close-tab + 'close this' リテラル追加、'gimme the tabs'→tabs-list + 'the tabs'）。
- ~~**bare EN 名詞/動詞（'tabs'/'bookmarks'/'history'/'scroll'/'read'/'find'/'search'/'stop'/'top'/'bottom'/'up'/'down'）が未認識**~~ — **Session 161 で実装**: 各オーナーへ単一語リテラル（'stop'→stop-reading、'stop everything'→stop-everything 維持）。
- ~~**JP 指示語・EN 離脱/称賛句が未認識**~~ — **Session 161 で実装**: 'なにこれ'/'これなに'/'何それ'/'what is this'/'lemme see'→describe-tab、'take me home'→home、'get outta here'/'get me out'→vr-exit、'kinda slow'→trouble、'cheers'/'appreciate it'/'good job'→ack、'やって'→help。
- その他 fill: half-page '半分進んで/戻って/半分上/下'、pause-reading '待て'/'待ってくれ'、find-in-page '検索しろ'/'探しろ'、speaking-status '読んでる'。
- ~~**方言/口語進行形（てん/でん・とる/どる）・関西依頼形（てや/てはる/てもろて/てくれん）が未認識**~~ — **Session 162 で実装**: `_politeVariants` 語尾層IV（てん→て、でん→で、てんか/でんの→てる、とる→てる、どる→でる、てや/てはる/てもろて/てくれへん/てくれん→て、てへん→てる）。'戻ってん'→back、'読んどる'→speaking-status、'閉じてもろて'→close-tab。
- ~~**'open up a tab'/'open a tab' が 'a' 名指しタブ検索に誤ルート**~~ — **Session 162 で修正**: new-tab リテラル化 + goToEn 前置詞に fire up|pull up|bring up|open up（'fire up youtube'→go-to）+ tabs 除外。
- ~~**EN 待機句・離脱句・挨拶・'close em all' 系が未認識**~~ — **Session 162 で実装**: 'hang on'/'wait a sec'/'one sec'→pause-reading、'whatcha doing'/'何してる'→working-status、'close em all'/'close them all'→close-all-tabs、'sup'/'yo'/'whats up'→ack。
- ~~**知らん/できひん（関西）・ずに否定形が未認識**~~ — **Session 162 で実装**: '知らん'/'できひん'→help、'戻られへん'→back-status、'読まずに' 等 ずに 系→negate。
- その他 fill: describe-tab '閉じてる'/'開いてる'（進行態質問）、working-status '使ってる'/'whatcha reading'、'pull up the tabs'→tabs-list、'pull up the history'→history、'bring up bookmarks/settings'。
- ~~**お〜ください敬語・辞書形+な禁止形・ます語幹+な命令形が未認識/誤実行**~~ — **Session 163 で実装**: `MASU_TE` 語幹→て形マップで 'お読みください'→read-aloud、'お待ちください'→pause-reading、'閉じな'→close-tab、'読みなさいよ'→read-aloud。**実害**: '戻るな'/'進むな' が navigate/back を実行（'戻る|進む' が素朴一致）→ `(?!な)` 化 + negate に `るな/するな`/`don't|never` 禁止形を追加。
- ~~**ておいて/てごらん/てして（備置・試行・方言二重て形）が未認識**~~ — **Session 163 で実装**: '閉じておいて'→close-tab、'読んでごらん'→read-aloud、'閉じてして'→close-tab。
- ~~**EN 'would you mind ~ing'・過度敬語・'is it ~' 状態質問・me-構文が未認識**~~ — **Session 163 で実装**: mind+動名詞→語幹化（'mind closing this'→close-tab）、'be so kind as to'/'if you please'/'pretty please' 剥がし、'is it loud/paused/playing/dark'→volume/working/video/brightness-status、'tell me again'→say-again、'read me the page'→read-aloud、'give me the tabs'→tabs-list、'shut it'→close-tab、'turn it off'→vr-exit、'turn up/down the volume'→volume、'make it louder/faster'等。
- ~~**カジュアル依頼疑問形・んじゃない否定誘い・させて使役が未認識**~~ — **Session 164 で実装**: `(て|で)(くれる|もらえる|くれない|もらえない)(か|かな)?`→て形、辞書形+んじゃない/んじゃね/んじゃん→て形（一段/五段両バリアント）、`させて`→て・あ行五段+せて→んで/って。'閉じてくれるか'→close-tab、'読むんじゃない'→read-aloud、'見させて'→describe-tab。
- ~~**EN ASR 修正句・待機慣用句・bare 検索句が未認識**~~ — **Session 164 で実装**: 'i said X'/'i meant X' 前置剥がし（'i said close it'→close-tab）、'be right back'/'brb'/'hold that thought'→pause-reading、'google it'/'look it up'→web-search、'check it out'→describe-tab。
- ~~**EN 拒否・指示代名・感嘆句が未認識**~~ — **Session 164 で実装**: 'nope'/'nah'/'no way'/'not that'/'wrong one'/'scratch that'→negate、'the first one'→first-tab、'the last one'→last-tab、'the other one'→next-tab、'wow'/'amazing'→ack、'enough'/'thats enough'→stop-everything、'put/bring it back'→reopen-tab、'are you there'→working-status、'do you hear me'→mic-status。
- その他 fill: っぱなし 放置句→describe-tab/speaking-status、'now what'→help、'count the tabs'→tabs-list、'a little more'→scroll-down、'try again'→repeat-command。
- ~~**条件・意向・方言命令形が未認識**~~ — **Session 165 で実装**: `たら/ば/べき/ほうがいい` 提案尾→て形両クラス、意向 `よ/よう/お-row+う/ましょう/とこ/んどこ`、方言 `んさい/みゃあ/っち/だべ/んか`、`つつ/ながら` 同時並行形。'閉じればいい'→close-tab、'戻ろう'→back、'読みゃあ'→read-aloud、'閉じるんか'→close-tab。
- ~~**EN 許可慣用句が literal ナビゲートを実行**~~ — **Session 165 で修正**: 'go ahead'/'go right ahead'/'go for it' が go-to で 'right ahead'/'for it' をナビゲート対象に → goToEn lookahead に `right|for` 追加 + ack literal 化（登録順で ack が先勝ち）。
- ~~**EN 相槌・辞退・存在確認・一括句が未認識**~~ — **Session 165 で実装**: ack に yeah/sure-thing/go-ahead 系 + JA 'どうも/すみません/はい/そっか' 系、negate に nvm/whoops/drop-it/'それじゃない'/'やめといた' 系、working-status に 'still there' 系、tab-relative に 'second to last'/'penultimate'、close-others に 'close the rest'/'keep just this one' 等。
- その他 fill: 'wipe my history'→clear-history（history 一覧奪取を解消）、'mute them all'→tab-audio（mute-toggle 誤トグルを解消）、'open a duplicate'/'clone it'→duplicate-tab、'put this tab first'→move-tab-start、'start over'→read-aloud、'fresh start'→settings-reset、'sort by name'→sort-tabs。

- ~~**敬語前置詞+受益尾の連鎖が未認識**~~ — **Session 166 で実装**: '恐れ入りますが'/'恐縮ですが'/'申し訳ありませんが'/'ついでに'/'まず' 前置剥がしを `_politeVariants` 再帰へ、TAIL_TE に いただけ…/くだされ/くださいませ/くれると…/ほしいんですが 系を追加。'恐れ入りますが閉じていただけますか'→close-tab。
- ~~**博多よる進行・dictだけ・べし形が未認識**~~ — **Session 166 で実装**: '読みよる'→speaking-status、'閉じよる'→describe-tab、'閉じるだけ'→close-tab、'閉じるべし'→close-tab、'開けっぱなし'→describe-tab、'鳴りっぱなし'→tab-audio。
- ~~**EN 前置詞ネスト（i was wondering if / do you think you could / would you be so kind and X）が未認識**~~ — **Session 166 で実装**: EN prefix chain に wondering/hoping/think-you-could/any-chance/be-so-kind/mind/how-about-we/why-dont-we/shall-we/suppose-we/lets + you-(have|need|got)-to/shoulda/coulda/should/could/might + and|then 逐次剥がし、動名詞化を post-strip にも適用。'if you wouldnt mind closing this'→close-tab。
- ~~**EN 無線相槌・強否定・メタ句が未認識**~~ — **Session 166 で実装**: ack に roger/copy/aye-aye/ten-four/wilco/yessir/okie-dokie/noted/gotcha 系、negate に nopers/absolutely-not/negative/hell-no 系、help に 'what can i say'/'show commands'/'do me a favor'/'just do it'/JA 'できること教えて' 系、trouble に 'おかしい'/'なんか変'/'へんだ' 系、nav 系に 'head back'/'walk it back'/'head forward'/'run it back'/'scroll on down'/'keep on scrolling'、describe-tab に 'bring/pull/queue/line it up'。
- ~~**dict形+接続尾（か/けど/し/から/の/んや/んだ/じゃ/んか）が未認識**~~ — **Session 167 で実装**: `dict+尾`→dictTe。'閉じるけど'→close-tab、'読むし'→read-aloud、'閉じるんや'→close-tab、'戻るんや'→back。
- ~~**'まい'否定意志形が実行されていた**~~ — **Session 167 で修正**: negate に `/まい$/` を追加し back/navigate lookahead に まい を追加 — '戻るまい'/'閉じるまい' が back/close-tab を実行していた。
- ~~**'keep it up/going/rolling' 継続句が negate に誤ルート**~~ — **Session 167 で修正**: negate の `/keep it/i` に先勝ちする resume-reading literal で回収、'keep at it'/'press on'/'carry on with it'/'continue on' も併記。
- ~~**'did it mute/save/bookmark'・'did i pin' 過去形質問が実行していた**~~ — **Session 167 で実装**: mute-status/pin-status/bookmark-status に did/get 形追加、'is it saved'→bookmark-status。
- ~~**させて-依頼尾・繰り返し句・敬語命令形が未認識**~~ — **Session 167 で実装**: `させて(くれ|もらう|もらえる|いただけないか|ほしい)`→て形（'閉じさせてもらう'→close-tab）、'何度も/もっかい/もいっかい' 前置、repeat-command に 'もっかい/もいっかい/もう一度だけ'、'お戻りなさい'→back、'お進みなさい'→navigate、'ご覧なさい'→describe-tab、'閉じれ'→close-tab、'止まれ/やまれ/とまれ'→stop-everything。
- ~~**別れ句・JA相槌・ENフィラーが未認識**~~ — **Session 167 で実装**: vr-exit に 'じゃあね/ばいばい/お疲れさま/終わり/see ya/peace out/adios/ciao/im out/signing off' 等、ack に JA '承知/かしこまり/合点/御意/そうだ/そのとおり/ほんそれ/まさに/そうそう/へえ/さすが/いい感じ/あざます/感謝' + EN 'ya got it/right on/way to go/attaboy/bravo/umm/ah' 系。
- ~~**稼働・聴力確認句が未認識**~~ — **Session 167 で実装**: working-status に '生きてる/動いてます/働いてる/whats going on/whats the status/hows it looking'、mic-status に 'd?ya hear me'、volume に 'bump it up/down'。
- ~~**依頼前置詞・困惑句が未認識**~~ — **Session 167 で実装**: help に 'お願いします/よろしくお願いします/どうぞ/わかんない/わかりませんでした/どうしたら'、negate に 'nah bruh/no can do/no dice/negative ghostrider/most certainly not/whatever/doesnt matter/forget everything'。

---

## 使い方（次のセッションへ）

1. **A章**はユーザーの明示的な承認があれば即着手可能。承認の有無を最初に確認すること。
2. **B章**は「バグではあるが今は到達不能」なものなので、単独で1セッション分の作業にはしない方がよい。もし関連する別の作業（例：ProgressiveLoaderを実際に使う新機能を追加するとき）のついでに直すのが自然。
3. **C章**は大規模リファクタなので、Explore/Planエージェントで事前調査してから着手すること。
4. 対応したら、この一覧から削除し、CLAUDE.md の Session Log に通常の形式で記録すること（🐛 fix / 🧹 cleanup / ✨ feat のいずれか、根拠と検証方法込み）。

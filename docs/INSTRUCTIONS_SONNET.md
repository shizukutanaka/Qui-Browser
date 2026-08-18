# Sonnet セッション実行指示書 (Qui-Browser)

**対象**: Claude Sonnet で実行される改善セッション。このファイル単体で作業開始できる自己完結型指示書。
**作成**: Session 57。姉妹編: `INSTRUCTIONS_OPUS.md`（設計判断を伴う大規模タスク用）。

Sonnet は「仕様が明確な小〜中規模タスク」を担当する。曖昧さがある/大規模リファクタ/設計判断が要るものは Opus に回す（`INSTRUCTIONS_OPUS.md` 参照）。

---

## 0. 最初に読むもの（順番どおり）

1. `CLAUDE.md` — プロジェクトの記憶。特に `## Session Log`（直近5セッション）
2. `docs/OUTSTANDING_ISSUES.md` — 残課題の正典（**E章が最新の改善案一覧**）

## 1. 必須の作業規律（Opus と共通・省略禁止）

```bash
git fetch origin main
git checkout -B claude/loop-improvements-L276b origin/main
git config user.email noreply@anthropic.com && git config user.name Claude
```

- **pre-fix fail 確認**: 新テストは `git stash push -- <src files>` → テスト → `git stash pop` で「修正前に fail する」ことを必ず確認。
- **フルゲート**: `npm test`（全 green・1364件）、`npm run lint`（**0 errors 維持**・warning を増やさない）、`npm run build`（green）。
- **ターゲットの寸法・距離を変える変更をしたら** `tests/target-size.test.js` が全ターゲットの**角サイズ**(度)を実ジオメトリから測る。寸法は `panelGeometry.js` のような**純モジュール**に置くこと(メートルのままでは押せるか判定できない — Session 70)。
- **色を変える変更をしたら** `tests/contrast.test.js` が実パレットを掃引する。新しい描画面の色は `chromeColors.js` / `bookmarkLayout.js` / `keyboardLayout.js` のような**純パレット関数**に置き、掃引表に足すこと(canvas の色は目視検証不能 — Session 69)。
- **`src/main.js`・`index.html`・`VRApp` の配線を触ったら** `npm run build && npm run verify:app` を走らせる。実 Chromium で**ビルド済みアプリを実際に起動**し、ランタイム例外・console error・主要 DOM の欠落を検出する。`new VRApp()` は Jest で構築できない（実 GPU が要る）ので、**モジュールの実行時エラーは unit test では原理的に捕捉できない** — Session 74。
- **テキストを描く変更をしたら** `npm run verify:layout` も走らせる。実 Chromium で本番の折り返し・切り詰めを実フォントで測り、パネルからはみ出さないか検証する(Sessions 62〜67 の日本語はみ出し欠陥ファミリーの再発防止。依存ゼロ)。
- **ドキュメント**: `CLAUDE.md` に `### Session N:` を既存フォーマットで追記＋`**Last Revision**` 更新。
- **出荷**: commit → push → PR → main マージ。
- **報告**: 「結論 → 根拠 → 残課題」の順。未検証を検証済みと書かない。

## 2. 触ってはいけないもの（実測済みの壁・凍結事項）

- `.github/workflows/*` の編集・タグ push・Release 作成・Pages 有効化は **403 で不可能**。試行しない。オーナー手順は `docs/PUBLISHING.md`。
- ~~A-1 / A-2~~ は **Session 74 で削除完了**。`enableWebPanel` 既定値変更のみ **ユーザーの明示的名指しまで凍結**。
- `docs/archive/` は履歴記録。**改変・削除禁止**（新規ドキュメントは `docs/` 直下に置く）。
- **B-1〜B-4**（`docs/OUTSTANDING_ISSUES.md`）は「バグだが到達不能」。**単独で着手しない**。関連する別作業のついでにのみ修正。

## 3. テスト環境の地雷

- `babel.config.js` 削除禁止。`new VRApp()` はテスト不可 → `tests/vr-app-wiring.test.js` の prototype-binding パターン踏襲。canvas 描画は目視検証不能 → pure 関数を切り出してテスト（`bookmarkLayout.js` が手本）。既存テストのモック流儀（`resetMocks:true` 対策で plain function を使う等）は各 `tests/*.test.js` の冒頭コメントに従う。

## 4. Sonnet 担当タスク（仕様が明確・小〜中規模）

### S-1. 効果音のプロシージャル生成フォールバック（E-3、優先度: 中）
- **問題**: `assets/sounds/*.mp3`（click/hover/success/error）はリポジトリに存在せず、`src/vr/VRApp.js` `loadAudioAssets()` が graceful 404 で音声を無効化している。
- **方針**: mp3 が読めない場合、`SpatialAudio` に WebAudio `OscillatorNode`/`GainNode` による短いプロシージャル効果音（click=短い高音、error=低い二重音 等）を生成させるフォールバックを追加。**既存の graceful 404 挙動を壊さない**こと（mp3 があればそちらを優先）。
- **受け入れ基準**: モックした AudioContext で「バッファ未取得時にプロシージャル生成に切り替わる」ことをテスト。`tests/spatial-audio.test.js` の既存モック（`createGain`/`createPanner`）を再利用。

### S-2. Clear History の音声コマンド化（E-4、優先度: 低）
- **背景**: Session 56 で「Clear History」設定アクションを追加（`VRApp._clearBrowsingHistory()`）。音声からも到達できると a11y 一貫性が上がる。
- **方針**: `src/vr/input/VoiceCommands.js` `connectBrowser()` に `onClearHistory` コールバックを既存の分離パターン（`onGoTo`/`onTopSites` と同型）で追加し、`履歴を消去`/`clear history` 等のフレーズを登録。VRApp 側で `_clearBrowsingHistory()` に配線。`confirmationText` を付けてクロスモーダル確認（Session 18 の go-to 事例参照）。
- **受け入れ基準**: コマンド登録順の衝突がないこと（`processCommand` は登録順で最初のヒットで止まる — go-to のような貪欲なパターンより**前**に登録）。regression テスト付き。

### S-3. README/CHANGELOG の現状同期（E-5、優先度: 低）
- **方針**: `README.md` / `CHANGELOG.md` の陳腐化した主張（機能数・テスト数・バージョン・存在しない docs へのリンク）を**実測に基づいて**修正。数値は `ls tests/*.test.js | wc -l`・`npm test` の実出力・`package.json` の version を根拠にする。誇張表現（"Enterprise-grade" 等）は事実ベースに置換。
- **受け入れ基準**: 相対リンクが全て解決すること（`docs/` 内の実在ファイルを指す）。docs 変更のみなのでフルゲートは「無変更で green」の確認。

### S-4. B章バグの機会的修正（該当する別タスクがある場合のみ）
- 例: `ProgressiveLoader` を実際に使う機能を足すなら B-3（`getAdaptiveUrl()` の非冪等サフィックス）も同時に直す。**単独では着手しない。**

## 5. 進め方のコツ

- 1セッション = 1つの well-scoped 改善 + テスト + ドキュメント + PR マージ。欲張らない。
- 「未配線の tested capability を UI に出す」は安全で価値が高い定番（Session 48/54/55/56）。ただし高価値なものは概ね消化済み（audio volume / haptics / clear history）。残りは上記 S-1〜S-4。
- 迷ったら Explore エージェントで「その public メソッドに定義ファイル外の呼び出し元があるか」を grep 確認してから着手。

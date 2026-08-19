# Opus セッション実行指示書 (Qui-Browser)

**対象**: Claude Opus で実行される改善セッション。このファイル単体で作業開始できる自己完結型指示書。
**作成**: Session 57。姉妹編: `INSTRUCTIONS_SONNET.md`（小〜中規模タスク用）。

---

## 0. 最初に読むもの（順番どおり）

1. `CLAUDE.md` — プロジェクトの記憶。特に `## Session Log`（直近5セッション）と `## Known Issues & Limitations`
2. `docs/OUTSTANDING_ISSUES.md` — 残課題の唯一の正典（A〜E章。**E章が最新の長所短所改善案**）
3. `docs/MODEL_GUIDE.md` — モデル使い分けの経緯

## 1. 必須の作業規律（全タスク共通・省略禁止）

```bash
# 1) ブランチ再スタート（前回PRがマージ済みのため毎回）
git fetch origin main
git checkout -B claude/loop-improvements-L276b origin/main
# 2) コミッター設定（stop-hook が検査する）
git config user.email noreply@anthropic.com && git config user.name Claude
```

- **修正 → regression テスト → pre-fix fail 確認**: 新テストは必ず「修正前のコードで fail する」ことを `git stash push -- <src files>` → テスト実行 → `git stash pop` で確認する。fail しないテストは regression 保証にならない（56セッション一貫の流儀）。
- **フルゲート**: `npm test`（全 green・現在1441件/47スイート）、`npm run lint`（**0 errors 維持**。52件の既存 no-console warning は増やさない）、`npm run build`（green）。
- **ターゲットの寸法・距離を変える変更をしたら** `tests/target-size.test.js` が全ターゲットの**角サイズ**(度)を実ジオメトリから測る。寸法は `panelGeometry.js` のような**純モジュール**に置くこと(メートルのままでは押せるか判定できない — Session 70)。
- **色を変える変更をしたら** `tests/contrast.test.js` が実パレットを掃引する。新しい描画面の色は `chromeColors.js` / `bookmarkLayout.js` / `keyboardLayout.js` のような**純パレット関数**に置き、掃引表に足すこと(canvas の色は目視検証不能 — Session 69)。
- **`src/main.js`・`index.html`・`VRApp` の配線を触ったら** `npm run build && npm run verify:app` を走らせる。実 Chromium で**ビルド済みアプリを実際に起動**し、ランタイム例外・console error・主要 DOM の欠落を検出する。`new VRApp()` は Jest で構築できない（実 GPU が要る）ので、**モジュールの実行時エラーは unit test では原理的に捕捉できない** — Session 74。
- **テキストを描く変更をしたら** `npm run verify:layout` も走らせる。実 Chromium で本番の折り返し・切り詰めを実フォントで測り、パネルからはみ出さないか検証する(Sessions 62〜67 の日本語はみ出し欠陥ファミリーの再発防止。依存ゼロ)。
- **ドキュメント更新**: `CLAUDE.md` に `### Session N:` エントリを既存フォーマット（🐛/✨/🧹/🔧 の絵文字bullet、テスト数、検証結果）で追記し、末尾の `**Last Revision**` を更新。課題を開閉したら `docs/OUTSTANDING_ISSUES.md` も更新。
- **出荷**: commit → `git push -u origin claude/loop-improvements-L276b` → PR 作成 → main へマージ（PR 作成・マージは**可能**）。

## 2. 権限の壁（実測済み 403 — 試行するだけ無駄）

| 操作 | 結果 |
|---|---|
| `.github/workflows/*` の編集を含む push | 403（`without workflows permission`） |
| git タグの push / Release 作成 / workflow dispatch / Pages 有効化 | 403 / API 非公開 |

公開（Release + Pages）のオーナー手順は `docs/PUBLISHING.md` に完備。**繰り返し試行しないこと。**

## 3. ユーザーの明示的な名指しがあるまで凍結

- ~~**A-1** `assets/js/`・`tests/archive/`~~ / ~~**A-2** 未使用 devDependencies~~ — **Session 74 で削除済み**
- **`enableWebPanel` 既定値**（現在 false）: 変更はプロダクト判断。トグルは Session 51 で追加済み

## 4. テスト環境の地雷

- ルートの `babel.config.js` は **削除禁止**（`.babelrc` は node_modules 境界を越えないため、実 three/examples の transpile に必須）
- `new VRApp()` はテスト不可（`setupRenderer()` が実GPUを要求）。`tests/vr-app-wiring.test.js` の **prototype-binding パターン**（`VRApp.prototype.method.call(手作りthis)`）を踏襲する
- getter/setter を検証するときは `Object.create(VRApp.prototype)` を使う（フラットなオブジェクトリテラルはアクセサを素通りする）
- canvas 描画は headless で目視検証不能 — レイアウト計算は pure 関数に切り出してユニットテスト（`src/vr/browser/bookmarkLayout.js` が手本）

## 5. Opus 担当タスク（設計判断を伴う大規模作業）

### O-1. 設定パネルのグルーピング（E-1 / C-2、優先度: 高に昇格）
- **背景**: Session 54-56 で Sound Volume / Haptics / Clear History が加わり、フラット2カラムは飽和。発見性が受忍限度を超えつつある。
- **対象**: `src/vr/VRApp.js` `createSettingsPanel()`（~1180行以降）と `makeToggleButton` 系。
- **方針**: 折りたたみセクション（Locomotion / Accessibility / Audio&Haptics / Browsing / Actions）。セクションヘッダは interactable、開閉状態は `settings` に永続化。ヒットテスト・`_redraw` レジストリ（high-contrast 切替の一括再描画）・`_announceSettingsButton`（WCAG 4.1.3）を壊さないこと。
- **受け入れ基準**: レイアウト計算を pure 関数化してテスト / 既存の全設定が到達可能 / キャプション告知が全ボタンで機能 / フルゲート green。

### O-2. Playwright E2E スモークハーネス（E-2、環境は準備済み）
- この実行環境は Chromium プリインストール（`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`、`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`）。**`playwright install` は実行しない。** 別バージョンが要る場合は `executablePath: '/opt/pw-browsers/chromium'`。
- スモーク範囲: `npm run build` → `npm run preview` → ページロード・console error ゼロ・Enter VR ボタン存在・SW 登録成功。`npm test`（Jest）には混ぜず別スクリプト（`npm run test:e2e`）にする。
- これが入ると「canvas UI を目視検証できない」積年の制約が部分的に解消される。

### O-3. VRApp 分割の継続（モノリス ~3300行）
- 実証済みパターン: `AccessibilityCoordinator`（Sessions 44/45/47）の **getter/setter 委譲**（呼び出し箇所ゼロ変更）。
- 次候補: teleport/locomotion 系（`this.teleport`、`snapTurn`、`updateLocomotion`）→ LocomotionCoordinator。着手前に Explore エージェントで全代入箇所を洗う（dispose 時の null 再代入が委譲を壊さないか確認）。

### O-4. MixedReality 配線（E-7 / C-4、Plan エージェント必須）
- 963行の完成済みARサブシステム（`src/vr/ar/MixedReality.js`）に `startSession()` 呼び出しゼロ。**着手前に Plan エージェントで設計**: `immersive-vr` と `immersive-ar` はセッション共存不可 → 既存VRセッションの終了/再入場フローの設計が本体。実機（Quest 3）検証不能のため、マージ基準は「ユニットテスト + 正直な制約ドキュメント」。

### O-5. Top Sites スピードダイヤル（E-6 / C-3、Session 17 から保留）
- 障害: `BookmarkPanel` に3タブ目を足すとスクロール矢印ゾーン（`bookmarkLayout.js` の `SCROLL_*` 定数）と座標衝突。ヘッダレイアウト再設計から。データ層は完成済み（`BookmarkStore.getTopSites`）。

## 6. 完了時

`CLAUDE.md` セッションログ・`docs/OUTSTANDING_ISSUES.md` を更新し PR をマージしたら、ユーザー報告は「結論 → 根拠 → 残課題」の順で簡潔に。**未検証のものを検証済みと書かない。**

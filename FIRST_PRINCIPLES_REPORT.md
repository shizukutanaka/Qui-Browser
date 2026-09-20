# 第一原理最適化レポート — Qui-Browser

手法: 目的→制約→本質→最小構成→実装→検証→改善 の順序固定。部品ごとに 存在理由/依存先/依存元/削除可能か/統合可能か を問い（ソクラテス）、削除・統合・単純化を第一手段とし（マスクのアルゴリズム）、推測でなく計測する。

## 1. 目的

- **プロダクトの目的**: Quest 2/3・Pico 4 で、Webページを「取得→本文抽出→VRパネル描画」して読む、アクセシビリティ優先のリーダーシェル。キャプション・触覚・トーストのクロスモーダル通知が看板。
- **この作業の目的**: 「ゼロから作るなら」を基準に現行設計と比較し、価値密度最大の一手を実行する。

## 2. 制約

- 単一メンテナ・ゼロ予算・CI無料枠
- WebXRのハード制約: cross-origin ページの画素合成不可（F-1 記録済み）
- ランタイム依存は `three` + `web-vitals` のみ（Session 74 で確定）
- `engines: node >=18`、Vite 5.4、Jest 29
- `workflow` OAuth スコープ無し（台帳 K-1）— `.github/workflows/` の変更は push 不可

## 3. 本質

利用者が欲しいもの: **ヘッドセットで文字を読む**。本当に困っていること: VR 内での可読性・入力（日本語IME）・フィードバック。その問題だけ解決するなら必要なもの: 静的フロントエンド + SSRFガード付き取得プロキシ + SW によるオフライン耐性。**それ以外は本質に寄与しない。**

## 4. 部品分解（存在理由を問う）

| 部品 | 存在理由 | 判定 |
|---|---|---|
| `src/` + `proxy/` + `public/` | 本質経路 | 残す |
| `docs/archive/`(117), `docs/patches/` | どこからも参照されない陳腐文書 | **削除** |
| `examples/`, `mvp/` | 削除済み assets/js への参照のみ・起動不能 | **削除** |
| `locales/` | i18next 孤児（依存自体 Session 74 で消滅） | **削除** |
| `wasm/` + `wasm-build.yml` | `instantiateStreaming` 呼出しゼロ | **削除** |
| `assets/styles|css|sounds/` | link/import ゼロ、sounds は .gitkeep のみ | **削除** |
| ルート `manifest.json`/`service-worker.js`/`offline.html` | publicDir が同名で dist を上書き → 双子の死体 | **削除** |
| `public/` 内 parallel app 一式 | 削除済み実装が **毎ビルド dist/ に混入** | **削除** |
| `ProgressiveLoader.js` | import ゼロ | **削除** |
| `tools/benchmark*.js`, 5 workflow | 呼出し元ゼロ／削除済み対象を参照 | **削除** |
| `monitoring.js`, `DevTools.js` | opt-in・到達経路あり | 残す |

## 5. コスト分析

残したままでは: 読む側が176,934行中66%の死体を参照コストとして払い続ける。削除側: git 履歴に残るため復元コスト ≈ 0。**コスト > 価値** が全削除対象で成立。

## 6. ボトルネック（最も壊れやすい一点）

計測して見つけたのは**コード量ではなく配信面**: `Dockerfile` が `vite build` を一度も実行せず素のソースを nginx で配信（`import 'three'` は解決不能 → **出荷物が起動しない**）。`netlify.toml`/`vercel.json` も同じ嘘。さらに `manifest.json`/SW の参照する `/assets/icons/*` が dist に存在せず **PWA アイコン全 404**。この一点が利用者価値への最大の穴だった。

## 7. 単純化

- `docker-compose.yml` の `nginx-cache`（設定ゼロ・接続なし）削除、ソースマウント削除
- `.env.example`: 44行中 ~38行がコードに存在しない変数 → 実際に読まれる6行へ
- `vite.config.js`: 死んだ manualChunk + 未使用 `@assets` エイリアス削除

## 8. 依存削減

新規依存ゼロ。ESLint flat config の `globals`/`@eslint/js` は eslint 自身の推移依存（lockfile 既収録）。`@rollup/rollup-darwin-arm64` は macOS npm optional-deps bug の回避用で `--no-save`（lockfile 非変更）。

## 9. 計測（before → after、全て実測）

| 指標 | before | after |
|---|---|---|
| 総 LOC | 176,934 | **60,507（−66%）** |
| テスト | 47 suites / 1,480 | 46 / 1,463（削除モジュール分のみ） |
| ビルド | 5.2s | **2.4s** |
| dist | 死んだ parallel app を同梱 | 28ファイル・アイコン全て配信 |
| lint | **設定解決不能で起動すらしなかった** | 0 errors / 128 warnings（既存） |
| verify:docs / layout / app / vr-boot | — | 100% / PASS / PASS / PASS |

## 10. 自己否定

- この削除は自己満足か？ → 否。各項目に「到達経路ゼロ」の grep 証拠がある。
- 複雑さを増やしたか？ → 否。新規ファイルは `eslint.config.js` のみ（必須の修復）。
- 一人で運営できるか？ → 改善。嘘をつく設定4件を真実化。
- 戻す10%はあるか？ → 検討したが現状無し（git 履歴が安全網）。

## 11. ゼロベースレビュー

今日ゼロから作るなら: Vite + three + プロキシ + SW + a11y 層 —— **ほぼ現在の `src/` そのもの**。違うのは docs 117件・examples・wasm・平行実装・嘘のデプロイ設定で、これらは全て削除した。

## 12. 価値密度 / 最終判断

4択を比較: **追加**（新機能）= 価値密度低（本質経路は揃っている）／ **変更**（Docker/Netlify/Vercel 修復）= 高（出荷物が起動するようになる）／ **削除** = 最高（コスト≈0 で保守面 −66%）／ **何もしない** = 負（壊れたイメージを配り続ける）。

**選択: 削除 + 最小修復 → 実施済み。** PR: https://github.com/shizukutanaka/Qui-Browser/pull/59

## 残課題（オーナー作業）

`.github/workflows/` の削除・修正は `workflow` スコーク不足で push 不能（台帳 K-1）。`workflow-changes.patch` を別途交付 — `git apply` で適用可能。

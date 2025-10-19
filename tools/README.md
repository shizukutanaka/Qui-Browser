# 開発ツール / Development Tools

このディレクトリには、Qui Browser VR の開発とメンテナンスに役立つツールが含まれています。
*This directory contains tools for developing and maintaining Qui Browser VR.*

---

## 📋 目次 / Table of Contents

1. [ツール一覧 / Tool List](#ツール一覧--tool-list)
2. [ベンチマークツール / Benchmark Tool](#ベンチマークツール--benchmark-tool)
3. [使用例 / Usage Examples](#使用例--usage-examples)

---

## ツール一覧 / Tool List

### 1. benchmark.js

パフォーマンスベンチマークツール
*Performance benchmarking tool*

**機能 / Features:**
- モジュールの読み込み速度測定 / Module load time measurement
- メモリ使用量分析 / Memory usage analysis
- 統計情報生成（最小、最大、平均、中央値、標準偏差、P95、P99）
- 複数の出力形式（JSON、CSV、Markdown）

**主な指標 / Key Metrics:**
- ✅ ファイルサイズ / File size
- ✅ 読み込み時間 / Load time
- ✅ メモリ使用量 / Memory usage
- ✅ パフォーマンスグレード / Performance grade

---

## ベンチマークツール / Benchmark Tool

### インストール / Installation

特別なインストールは不要です。Node.js があれば実行できます。
*No special installation required. Just needs Node.js.*

```bash
# Node.js のバージョン確認 / Check Node.js version
node --version  # v18+ 推奨 / recommended
```

### 基本的な使い方 / Basic Usage

```bash
# ヘルプを表示 / Show help
node tools/benchmark.js --help

# 特定のモジュールをベンチマーク / Benchmark specific module
node tools/benchmark.js --module vr-text-renderer

# すべてのモジュールをベンチマーク / Benchmark all modules
node tools/benchmark.js --all

# 反復回数を指定 / Specify iterations
node tools/benchmark.js --module vr-launcher --iterations 1000

# 結果をファイルに出力 / Output results to file
node tools/benchmark.js --all --output results.md --format markdown
```

### オプション / Options

| オプション / Option | 説明 / Description | デフォルト / Default |
|-------------------|-------------------|---------------------|
| `--module <name>` | 特定のモジュールをベンチマーク / Benchmark specific module | - |
| `--all` | すべてのモジュールをベンチマーク / Benchmark all modules | - |
| `--iterations <n>` | 反復回数 / Number of iterations | 100 |
| `--output <file>` | 結果を出力 / Output results to file | - |
| `--format <type>` | 出力形式 / Output format (json, csv, markdown) | markdown |
| `--help` | ヘルプを表示 / Show help | - |

---

## 使用例 / Usage Examples

### 例1: 単一モジュールの詳細ベンチマーク

```bash
node tools/benchmark.js --module vr-text-renderer --iterations 1000
```

**出力例 / Example Output:**

```
📊 Benchmarking: vr-text-renderer
────────────────────────────────────────────────────────────
🔥 Warming up (10 iterations)...
⏱️  Running benchmark (1000 iterations)...
  Progress: 1000/1000

📦 File Size: 18.45 KB
⏱️  Load Time (ms):
   Min:    0.234
   Max:    2.145
   Mean:   0.456
   Median: 0.423
   StdDev: 0.112
   P95:    0.678
   P99:    0.892
💾 Memory Usage (bytes):
   Min:    12.34 KB
   Max:    45.67 KB
   Mean:   23.45 KB
   Median: 21.23 KB
```

### 例2: すべてのモジュールをベンチマーク

```bash
node tools/benchmark.js --all --iterations 500
```

**出力例 / Example Output:**

```
🚀 Starting comprehensive benchmark...

Total modules: 21
Iterations per module: 500
════════════════════════════════════════════════════════════

📊 Benchmarking: vr-launcher
...
📊 Benchmarking: vr-utils
...

📊 BENCHMARK SUMMARY
════════════════════════════════════════════════════════════

📦 Total Size: 456.78 KB

⚡ Fastest Module (load time):
   vr-utils: 0.234 ms

🐌 Slowest Module (load time):
   vr-video-player: 2.345 ms

📈 Average Load Time: 0.789 ms

💾 Top 3 Memory Consumers:
   1. vr-video-player: 234.56 KB
   2. vr-bookmark-3d: 198.23 KB
   3. vr-tab-manager-3d: 167.89 KB
```

### 例3: 結果をMarkdownで保存

```bash
node tools/benchmark.js --all --output benchmark-results.md --format markdown
```

**生成されるMarkdownの例 / Generated Markdown Example:**

```markdown
# VR Browser Performance Benchmark Results

**Date:** 2025-10-19T12:34:56.789Z
**Iterations:** 100
**Modules Tested:** 21

## Summary

- **Total Size:** 456.78 KB
- **Average Load Time:** 0.789 ms

## Detailed Results

| Module | Size (KB) | Load Time (ms) | Memory (KB) |
|--------|-----------|----------------|-------------|
| vr-launcher | 12.34 | 0.45 | 23.45 |
| vr-utils | 8.92 | 0.23 | 15.67 |
| vr-text-renderer | 18.45 | 0.56 | 34.21 |
...

## Performance Grades

- **vr-utils:** A+ (Excellent) (0.23 ms)
- **vr-launcher:** A+ (Excellent) (0.45 ms)
- **vr-text-renderer:** A+ (Excellent) (0.56 ms)
...
```

### 例4: 結果をJSONで保存

```bash
node tools/benchmark.js --all --output benchmark-results.json --format json
```

**JSONフォーマット / JSON Format:**

```json
[
  {
    "module": "vr-launcher",
    "fileSize": 12645,
    "fileSizeKB": "12.34",
    "loadTime": {
      "min": 0.234,
      "max": 1.234,
      "mean": 0.456,
      "median": 0.423,
      "stdDev": 0.112,
      "p95": 0.678,
      "p99": 0.892
    },
    "memoryUsage": {
      "min": 10240,
      "max": 51200,
      "mean": 24576,
      "median": 22528
    },
    "iterations": 100,
    "timestamp": "2025-10-19T12:34:56.789Z"
  }
]
```

### 例5: 結果をCSVで保存

```bash
node tools/benchmark.js --all --output benchmark-results.csv --format csv
```

**CSVフォーマット / CSV Format:**

```csv
Module,File Size (KB),Load Time Min (ms),Load Time Max (ms),Load Time Mean (ms),Load Time Median (ms),Load Time P95 (ms),Memory Min (bytes),Memory Max (bytes),Memory Mean (bytes)
vr-launcher,12.34,0.234,1.234,0.456,0.423,0.678,10240,51200,24576
vr-utils,8.92,0.123,0.987,0.234,0.212,0.345,8192,32768,16384
...
```

---

## パフォーマンスグレード / Performance Grades

ベンチマークツールは、読み込み時間に基づいてパフォーマンスグレードを割り当てます：
*The benchmark tool assigns performance grades based on load time:*

| グレード / Grade | 読み込み時間 / Load Time | 評価 / Rating |
|-----------------|------------------------|--------------|
| A+ | < 1 ms | Excellent（優秀） |
| A | 1-5 ms | Very Good（非常に良い） |
| B | 5-10 ms | Good（良い） |
| C | 10-20 ms | Fair（まあまあ） |
| D | > 20 ms | Needs Optimization（要最適化） |

---

## 最適化のヒント / Optimization Tips

### ファイルサイズの削減 / Reduce File Size

```bash
# コードの圧縮 / Minify code
npx terser assets/js/vr-text-renderer.js -o assets/js/vr-text-renderer.min.js

# ファイルサイズの確認 / Check file size
ls -lh assets/js/vr-text-renderer.js
```

### 読み込み時間の改善 / Improve Load Time

1. **遅延読み込み / Lazy Loading**
   ```javascript
   // 必要な時だけモジュールを読み込む
   const module = await import('./vr-text-renderer.js');
   ```

2. **コード分割 / Code Splitting**
   - 大きなモジュールを小さなチャンクに分割
   - Split large modules into smaller chunks

3. **キャッシュ戦略 / Caching Strategy**
   - Service Worker でモジュールをキャッシュ
   - Cache modules with Service Worker

### メモリ使用量の削減 / Reduce Memory Usage

1. **オブジェクトプーリング / Object Pooling**
   ```javascript
   // 再利用可能なオブジェクトプールを作成
   const pool = new ObjectPool(100);
   ```

2. **イベントリスナーのクリーンアップ / Cleanup Event Listeners**
   ```javascript
   // 使用後はイベントリスナーを削除
   element.removeEventListener('click', handler);
   ```

3. **メモリリークの検出 / Detect Memory Leaks**
   ```bash
   # Chrome DevTools Memory Profiler を使用
   # Use Chrome DevTools Memory Profiler
   ```

---

## CI/CD統合 / CI/CD Integration

### GitHub Actions での自動ベンチマーク

**.github/workflows/benchmark.yml**

```yaml
name: Performance Benchmark

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # 毎週日曜日 / Every Sunday

jobs:
  benchmark:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run benchmark
        run: node tools/benchmark.js --all --output benchmark-results.md --format markdown

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: benchmark-results.md

      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = fs.readFileSync('benchmark-results.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: results
            });
```

---

## トラブルシューティング / Troubleshooting

### エラー: "Module not found"

```bash
# モジュールが存在するか確認 / Check if module exists
ls -la assets/js/vr-*.js

# パスが正しいか確認 / Verify path is correct
pwd
```

### エラー: "Out of memory"

```bash
# Node.js のメモリ制限を増やす / Increase Node.js memory limit
NODE_OPTIONS=--max_old_space_size=4096 node tools/benchmark.js --all
```

### 結果のばらつきが大きい

```bash
# 反復回数を増やす / Increase iterations
node tools/benchmark.js --module vr-utils --iterations 10000

# ウォームアップ回数を増やす（コード内で調整）
# Increase warmup iterations (adjust in code)
```

---

## 貢献 / Contributing

ベンチマークツールの改善案がある場合：
*If you have suggestions to improve the benchmark tool:*

1. [Issue を作成](https://github.com/yourusername/qui-browser-vr/issues/new)
2. フォークして改善を実装
3. Pull Request を提出

---

## ライセンス / License

このツールは、プロジェクト全体と同じ MIT License の下でライセンスされています。
*This tool is licensed under the same MIT License as the entire project.*

---

**ハッピーベンチマーキング！ / Happy Benchmarking!** 📊✨

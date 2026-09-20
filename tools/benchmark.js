#!/usr/bin/env node

/**
 * VR Browser Performance Benchmark Tool
 *
 * パフォーマンステストとベンチマークを実行します
 * Runs performance tests and benchmarks
 *
 * Usage:
 *   node tools/benchmark.js [options]
 *
 * Options:
 *   --module <name>    特定のモジュールをベンチマーク / Benchmark specific module
 *   --all              全モジュールをベンチマーク / Benchmark all modules
 *   --iterations <n>   反復回数 / Number of iterations (default: 100)
 *   --output <file>    結果を出力 / Output results to file
 *   --format <type>    出力形式 / Output format (json, csv, markdown)
 *
 * Examples:
 *   node tools/benchmark.js --module vr-text-renderer --iterations 1000
 *   node tools/benchmark.js --all --output results.json --format json
 */

const fs = require('fs');
const path = require('path');

// ベンチマーク設定 / Benchmark Configuration
const CONFIG = {
  iterations: 100,
  warmupIterations: 10,
  outputFormat: 'markdown',
  outputFile: null,
  modules: [
    'vr-text-renderer',
    'vr-ergonomic-ui',
    'vr-comfort-system',
    'vr-input-optimizer',
    'vr-performance-profiler',
    'vr-accessibility-enhanced',
    'vr-environment-customizer',
    'vr-gesture-macro',
    'vr-content-optimizer',
    'vr-bookmark-3d',
    'vr-tab-manager-3d',
    'vr-spatial-audio',
    'vr-hand-tracking',
    'vr-gesture-scroll',
    'vr-keyboard',
    'vr-navigation',
    'vr-video-player',
    'vr-settings',
    'vr-performance-monitor',
    'vr-launcher',
    'vr-utils'
  ]
};

// コマンドライン引数の解析 / Parse Command Line Arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { ...CONFIG };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--module':
        options.module = args[++i];
        break;
      case '--all':
        options.benchmarkAll = true;
        break;
      case '--iterations':
        options.iterations = parseInt(args[++i], 10);
        break;
      case '--output':
        options.outputFile = args[++i];
        break;
      case '--format':
        options.outputFormat = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  return options;
}

// ヘルプメッセージ / Help Message
function printHelp() {
  console.log(`
VR Browser Performance Benchmark Tool

Usage:
  node tools/benchmark.js [options]

Options:
  --module <name>    特定のモジュールをベンチマーク / Benchmark specific module
  --all              全モジュールをベンチマーク / Benchmark all modules
  --iterations <n>   反復回数 / Number of iterations (default: 100)
  --output <file>    結果を出力 / Output results to file
  --format <type>    出力形式 / Output format (json, csv, markdown)

Examples:
  node tools/benchmark.js --module vr-text-renderer --iterations 1000
  node tools/benchmark.js --all --output results.json --format json
  `);
}

// パフォーマンス測定 / Performance Measurement
class PerformanceBenchmark {
  constructor(options) {
    this.options = options;
    this.results = [];
  }

  /**
   * モジュールのベンチマークを実行 / Run module benchmark
   */
  async benchmarkModule(moduleName) {
    console.log(`\n📊 Benchmarking: ${moduleName}`);
    console.log('─'.repeat(60));

    const modulePath = path.join(__dirname, '..', 'assets', 'js', `${moduleName}.js`);

    // ファイルの存在確認 / Check file existence
    if (!fs.existsSync(modulePath)) {
      console.error(`❌ Module not found: ${modulePath}`);
      return null;
    }

    const stats = fs.statSync(modulePath);
    const fileSize = stats.size;
    const fileSizeKB = (fileSize / 1024).toFixed(2);

    // ウォームアップ / Warmup
    console.log(`🔥 Warming up (${this.options.warmupIterations} iterations)...`);
    for (let i = 0; i < this.options.warmupIterations; i++) {
      await this.simulateModuleLoad(modulePath);
    }

    // ベンチマーク実行 / Run benchmark
    console.log(`⏱️  Running benchmark (${this.options.iterations} iterations)...`);

    const measurements = {
      loadTimes: [],
      memoryUsage: [],
      parseTime: []
    };

    for (let i = 0; i < this.options.iterations; i++) {
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      await this.simulateModuleLoad(modulePath);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      measurements.loadTimes.push(endTime - startTime);
      measurements.memoryUsage.push(endMemory - startMemory);

      // 進捗表示 / Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`\r  Progress: ${i + 1}/${this.options.iterations}`);
      }
    }

    console.log('\n');

    // 統計計算 / Calculate statistics
    const result = {
      module: moduleName,
      fileSize: fileSize,
      fileSizeKB: fileSizeKB,
      loadTime: this.calculateStats(measurements.loadTimes),
      memoryUsage: this.calculateStats(measurements.memoryUsage),
      iterations: this.options.iterations,
      timestamp: new Date().toISOString()
    };

    this.printResults(result);
    this.results.push(result);

    return result;
  }

  /**
   * モジュール読み込みをシミュレート / Simulate module load
   */
  async simulateModuleLoad(modulePath) {
    return new Promise((resolve) => {
      fs.readFile(modulePath, 'utf8', (err, data) => {
        if (err) {
          console.error(`Error reading file: ${err}`);
          resolve();
          return;
        }

        // 簡易パース（実際のJavaScript解析なし）
        // Simple parse (no actual JavaScript evaluation)
        const lines = data.split('\n').length;
        const chars = data.length;

        resolve({ lines, chars });
      });
    });
  }

  /**
   * 統計を計算 / Calculate statistics
   */
  calculateStats(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;

    // 中央値 / Median
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    // 標準偏差 / Standard deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // パーセンタイル / Percentiles
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median,
      stdDev,
      p95,
      p99
    };
  }

  /**
   * 結果を表示 / Print results
   */
  printResults(result) {
    console.log(`📦 File Size: ${result.fileSizeKB} KB`);
    console.log(`⏱️  Load Time (ms):`);
    console.log(`   Min:    ${result.loadTime.min.toFixed(3)}`);
    console.log(`   Max:    ${result.loadTime.max.toFixed(3)}`);
    console.log(`   Mean:   ${result.loadTime.mean.toFixed(3)}`);
    console.log(`   Median: ${result.loadTime.median.toFixed(3)}`);
    console.log(`   StdDev: ${result.loadTime.stdDev.toFixed(3)}`);
    console.log(`   P95:    ${result.loadTime.p95.toFixed(3)}`);
    console.log(`   P99:    ${result.loadTime.p99.toFixed(3)}`);

    console.log(`💾 Memory Usage (bytes):`);
    console.log(`   Min:    ${this.formatBytes(result.memoryUsage.min)}`);
    console.log(`   Max:    ${this.formatBytes(result.memoryUsage.max)}`);
    console.log(`   Mean:   ${this.formatBytes(result.memoryUsage.mean)}`);
    console.log(`   Median: ${this.formatBytes(result.memoryUsage.median)}`);
  }

  /**
   * バイト数をフォーマット / Format bytes
   */
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes.toFixed(0)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  /**
   * すべてのモジュールをベンチマーク / Benchmark all modules
   */
  async benchmarkAll() {
    console.log('🚀 Starting comprehensive benchmark...\n');
    console.log(`Total modules: ${this.options.modules.length}`);
    console.log(`Iterations per module: ${this.options.iterations}`);
    console.log('═'.repeat(60));

    for (const module of this.options.modules) {
      await this.benchmarkModule(module);
    }

    this.printSummary();
  }

  /**
   * サマリーを表示 / Print summary
   */
  printSummary() {
    console.log('\n\n📊 BENCHMARK SUMMARY');
    console.log('═'.repeat(60));

    // 合計ファイルサイズ / Total file size
    const totalSize = this.results.reduce((sum, r) => sum + r.fileSize, 0);
    const totalSizeKB = (totalSize / 1024).toFixed(2);

    console.log(`\n📦 Total Size: ${totalSizeKB} KB`);

    // 最速/最遅のモジュール / Fastest/slowest modules
    const sortedByLoadTime = this.results.slice().sort((a, b) => a.loadTime.mean - b.loadTime.mean);

    console.log(`\n⚡ Fastest Module (load time):`);
    console.log(`   ${sortedByLoadTime[0].module}: ${sortedByLoadTime[0].loadTime.mean.toFixed(3)} ms`);

    console.log(`\n🐌 Slowest Module (load time):`);
    const slowest = sortedByLoadTime[sortedByLoadTime.length - 1];
    console.log(`   ${slowest.module}: ${slowest.loadTime.mean.toFixed(3)} ms`);

    // 平均読み込み時間 / Average load time
    const avgLoadTime = this.results.reduce((sum, r) => sum + r.loadTime.mean, 0) / this.results.length;
    console.log(`\n📈 Average Load Time: ${avgLoadTime.toFixed(3)} ms`);

    // メモリ使用量トップ3 / Top 3 memory consumers
    const sortedByMemory = this.results.slice().sort((a, b) => b.memoryUsage.mean - a.memoryUsage.mean);
    console.log(`\n💾 Top 3 Memory Consumers:`);
    sortedByMemory.slice(0, 3).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.module}: ${this.formatBytes(r.memoryUsage.mean)}`);
    });
  }

  /**
   * 結果を保存 / Save results
   */
  saveResults() {
    if (!this.options.outputFile) return;

    let output;

    switch (this.options.outputFormat) {
      case 'json':
        output = JSON.stringify(this.results, null, 2);
        break;

      case 'csv':
        output = this.resultsToCSV();
        break;

      case 'markdown':
        output = this.resultsToMarkdown();
        break;

      default:
        console.error(`Unknown format: ${this.options.outputFormat}`);
        return;
    }

    fs.writeFileSync(this.options.outputFile, output, 'utf8');
    console.log(`\n✅ Results saved to: ${this.options.outputFile}`);
  }

  /**
   * 結果をCSVに変換 / Convert results to CSV
   */
  resultsToCSV() {
    const headers = [
      'Module',
      'File Size (KB)',
      'Load Time Min (ms)',
      'Load Time Max (ms)',
      'Load Time Mean (ms)',
      'Load Time Median (ms)',
      'Load Time P95 (ms)',
      'Memory Min (bytes)',
      'Memory Max (bytes)',
      'Memory Mean (bytes)'
    ];

    const rows = this.results.map((r) => [
      r.module,
      r.fileSizeKB,
      r.loadTime.min.toFixed(3),
      r.loadTime.max.toFixed(3),
      r.loadTime.mean.toFixed(3),
      r.loadTime.median.toFixed(3),
      r.loadTime.p95.toFixed(3),
      r.memoryUsage.min.toFixed(0),
      r.memoryUsage.max.toFixed(0),
      r.memoryUsage.mean.toFixed(0)
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * 結果をMarkdownに変換 / Convert results to Markdown
   */
  resultsToMarkdown() {
    let md = '# VR Browser Performance Benchmark Results\n\n';
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Iterations:** ${this.options.iterations}\n`;
    md += `**Modules Tested:** ${this.results.length}\n\n`;

    md += '## Summary\n\n';

    const totalSize = this.results.reduce((sum, r) => sum + r.fileSize, 0);
    md += `- **Total Size:** ${(totalSize / 1024).toFixed(2)} KB\n`;

    const avgLoadTime = this.results.reduce((sum, r) => sum + r.loadTime.mean, 0) / this.results.length;
    md += `- **Average Load Time:** ${avgLoadTime.toFixed(3)} ms\n\n`;

    md += '## Detailed Results\n\n';
    md += '| Module | Size (KB) | Load Time (ms) | Memory (KB) |\n';
    md += '|--------|-----------|----------------|-------------|\n';

    this.results.forEach((r) => {
      md += `| ${r.module} | ${r.fileSizeKB} | ${r.loadTime.mean.toFixed(2)} | ${(r.memoryUsage.mean / 1024).toFixed(2)} |\n`;
    });

    md += '\n## Performance Grades\n\n';

    // パフォーマンスグレードを割り当て / Assign performance grades
    this.results.forEach((r) => {
      const loadTime = r.loadTime.mean;
      let grade;

      if (loadTime < 1) grade = 'A+ (Excellent)';
      else if (loadTime < 5) grade = 'A (Very Good)';
      else if (loadTime < 10) grade = 'B (Good)';
      else if (loadTime < 20) grade = 'C (Fair)';
      else grade = 'D (Needs Optimization)';

      md += `- **${r.module}:** ${grade} (${loadTime.toFixed(2)} ms)\n`;
    });

    return md;
  }
}

// メイン実行 / Main Execution
async function main() {
  const options = parseArgs();
  const benchmark = new PerformanceBenchmark(options);

  console.log('🎯 VR Browser Performance Benchmark Tool');
  console.log('═'.repeat(60));

  if (options.module) {
    // 特定のモジュールをベンチマーク / Benchmark specific module
    await benchmark.benchmarkModule(options.module);
  } else if (options.benchmarkAll) {
    // すべてのモジュールをベンチマーク / Benchmark all modules
    await benchmark.benchmarkAll();
  } else {
    console.error('Error: Please specify --module <name> or --all');
    printHelp();
    process.exit(1);
  }

  // 結果を保存 / Save results
  benchmark.saveResults();

  console.log('\n✅ Benchmark complete!');
}

// エラーハンドリング / Error Handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// 実行 / Run
if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = PerformanceBenchmark;

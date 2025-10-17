#!/usr/bin/env node

/**
 * Qui Browser Performance Benchmark Tool
 * Comprehensive benchmarking for server performance, memory usage, and load testing
 */

const http = require('http');
const os = require('os');
const path = require('path');

class BenchmarkTool {
  constructor() {
    this.results = {
      memory: {},
      load: {},
      performance: {},
      timestamp: new Date().toISOString()
    };

    this.serverUrl = 'http://localhost:8000';
    this.benchmarkDuration = 30000; // 30 seconds
    this.concurrentConnections = 10;
    this.requestCount = 1000;

    this.parseArguments();
  }

  parseArguments() {
    const args = process.argv.slice(2);

    for (const arg of args) {
      if (arg === '--memory') {
        this.runMemoryBenchmark();
        return;
      } else if (arg === '--load') {
        this.runLoadBenchmark();
        return;
      } else if (arg === '--full') {
        this.runFullBenchmark();
        return;
      } else if (arg.startsWith('--duration=')) {
        this.benchmarkDuration = parseInt(arg.split('=')[1]) * 1000;
      } else if (arg.startsWith('--connections=')) {
        this.concurrentConnections = parseInt(arg.split('=')[1]);
      } else if (arg.startsWith('--requests=')) {
        this.requestCount = parseInt(arg.split('=')[1]);
      } else if (arg.startsWith('--url=')) {
        this.serverUrl = arg.split('=')[1];
      }
    }

    this.runFullBenchmark();
  }

  async runFullBenchmark() {
    console.log('🚀 Starting comprehensive performance benchmark...');
    console.log(`📊 Server: ${this.serverUrl}`);
    console.log(`⏱️  Duration: ${this.benchmarkDuration / 1000}s`);
    console.log(`🔗 Connections: ${this.concurrentConnections}`);
    console.log(`📝 Requests: ${this.requestCount}`);
    console.log('');

    try {
      await this.runMemoryBenchmark();
      await this.runLoadBenchmark();
      await this.runPerformanceBenchmark();
      this.displayResults();
    } catch (error) {
      console.error('Benchmark failed:', error.message);
      process.exit(1);
    }
  }

  async runMemoryBenchmark() {
    console.log('🧠 Running memory benchmark...');

    const samples = [];
    const sampleCount = 10;
    const sampleInterval = 1000; // 1 second

    for (let i = 0; i < sampleCount; i++) {
      const memoryUsage = process.memoryUsage();
      samples.push({
        timestamp: Date.now(),
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      });

      if (i < sampleCount - 1) {
        await this.sleep(sampleInterval);
      }
    }

    // Calculate statistics
    const rssValues = samples.map(s => s.rss);
    const heapUsedValues = samples.map(s => s.heapUsed);

    this.results.memory = {
      samples,
      statistics: {
        rss: {
          min: Math.min(...rssValues),
          max: Math.max(...rssValues),
          avg: rssValues.reduce((a, b) => a + b, 0) / rssValues.length,
          final: samples[samples.length - 1].rss
        },
        heapUsed: {
          min: Math.min(...heapUsedValues),
          max: Math.max(...heapUsedValues),
          avg: heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length,
          final: samples[samples.length - 1].heapUsed
        }
      },
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      }
    };

    console.log(`✅ Memory benchmark completed (${samples.length} samples)`);
  }

  async runLoadBenchmark() {
    console.log('⚡ Running load benchmark...');

    const startTime = Date.now();
    const requests = [];
    const errors = [];
    const responseTimes = [];

    // Simple load test - make concurrent requests
    const batchSize = Math.min(this.concurrentConnections, 50);
    const batches = Math.ceil(this.requestCount / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchPromises = [];

      for (let i = 0; i < batchSize && batch * batchSize + i < this.requestCount; i++) {
        batchPromises.push(this.makeRequest());
      }

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, i) => {
        const requestIndex = batch * batchSize + i;
        if (result.status === 'fulfilled') {
          requests.push(result.value);
          responseTimes.push(result.value.duration);
        } else {
          errors.push({
            index: requestIndex,
            error: result.reason.message
          });
        }
      });

      // Progress update
      const progress = Math.min(((batch + 1) / batches) * 100, 100);
      console.log(`📈 Progress: ${progress.toFixed(1)}% (${requests.length}/${this.requestCount})`);

      // Small delay to avoid overwhelming
      if (batch < batches - 1) {
        await this.sleep(100);
      }
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    this.results.load = {
      requests: requests.length,
      errorCount: errors.length,
      duration: totalTime,
      requestsPerSecond: (requests.length / totalTime) * 1000,
      errorRate: (errors.length / (requests.length + errors.length)) * 100,
      responseTimes: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        median: this.calculateMedian(responseTimes),
        p95: this.calculatePercentile(responseTimes, 95),
        p99: this.calculatePercentile(responseTimes, 99)
      },
      statusCodes: this.groupByStatusCode(requests),
      errors: errors.slice(0, 10) // Keep only first 10 errors
    };

    console.log(`✅ Load benchmark completed (${requests.length} requests, ${errors.length} errors)`);
  }

  async runPerformanceBenchmark() {
    console.log('📊 Running performance benchmark...');

    const metrics = [];
    const sampleCount = 5;
    const sampleInterval = 5000; // 5 seconds

    for (let i = 0; i < sampleCount; i++) {
      try {
        const response = await this.makeRequest('/api/stats');
        if (response.statusCode === 200) {
          const stats = JSON.parse(response.body);
          metrics.push({
            timestamp: Date.now(),
            ...stats
          });
        }
      } catch (error) {
        console.warn('Failed to fetch performance metrics:', error.message);
      }

      if (i < sampleCount - 1) {
        await this.sleep(sampleInterval);
      }
    }

    this.results.performance = {
      metrics,
      summary: this.summarizePerformanceMetrics(metrics)
    };

    console.log(`✅ Performance benchmark completed (${metrics.length} samples)`);
  }

  async makeRequest(endpoint = '/') {
    const url = this.serverUrl + endpoint;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const req = http.request(
        url,
        {
          method: 'GET',
          timeout: 10000,
          headers: {
            'User-Agent': 'Qui-Browser-Benchmark/1.0',
            Connection: 'keep-alive'
          }
        },
        res => {
          let body = '';
          res.on('data', chunk => (body += chunk));
          res.on('end', () => {
            const duration = Date.now() - startTime;
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body,
              duration
            });
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  calculateMedian(values) {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sorted.length) {
      return sorted[sorted.length - 1];
    }
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  groupByStatusCode(requests) {
    const groups = {};
    requests.forEach(req => {
      groups[req.statusCode] = (groups[req.statusCode] || 0) + 1;
    });
    return groups;
  }

  summarizePerformanceMetrics(metrics) {
    if (metrics.length === 0) {
      return null;
    }

    const summary = {
      uptime: metrics[metrics.length - 1].uptime,
      avgRequests: metrics.reduce((sum, m) => sum + m.requests, 0) / metrics.length,
      avgErrors: metrics.reduce((sum, m) => sum + m.errors, 0) / metrics.length,
      avgResponseTime: metrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / metrics.length,
      avgCacheHitRate: metrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / metrics.length,
      finalMemoryUsage: metrics[metrics.length - 1].memory
    };

    return summary;
  }

  formatBytes(bytes) {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 BENCHMARK RESULTS');
    console.log('='.repeat(60));

    // Memory Results
    console.log('\n🧠 MEMORY BENCHMARK');
    console.log('-'.repeat(30));
    const memStats = this.results.memory.statistics;
    console.log(`RSS Memory: ${this.formatBytes(memStats.rss.avg)} (avg)`);
    console.log(`           ${this.formatBytes(memStats.rss.min)} (min) - ${this.formatBytes(memStats.rss.max)} (max)`);
    console.log(`Heap Used: ${this.formatBytes(memStats.heapUsed.avg)} (avg)`);
    console.log(
      `           ${this.formatBytes(memStats.heapUsed.min)} (min) - ${this.formatBytes(memStats.heapUsed.max)} (max)`
    );

    // Load Test Results
    console.log('\n⚡ LOAD BENCHMARK');
    console.log('-'.repeat(30));
    const loadStats = this.results.load;
    console.log(`Requests: ${loadStats.requests.toLocaleString()}`);
    console.log(`Errors: ${loadStats.errorCount} (${loadStats.errorRate.toFixed(2)}%)`);
    console.log(`Duration: ${(loadStats.duration / 1000).toFixed(2)}s`);
    console.log(`RPS: ${loadStats.requestsPerSecond.toFixed(2)}`);
    console.log(`Response Time: ${loadStats.responseTimes.avg.toFixed(2)}ms (avg)`);
    console.log(`               ${loadStats.responseTimes.min}ms (min) - ${loadStats.responseTimes.max}ms (max)`);
    console.log(`               ${loadStats.responseTimes.median.toFixed(2)}ms (median)`);
    console.log(
      `               ${loadStats.responseTimes.p95.toFixed(2)}ms (95th) - ${loadStats.responseTimes.p99.toFixed(2)}ms (99th)`
    );

    // Performance Results
    if (this.results.performance.summary) {
      console.log('\n📈 PERFORMANCE BENCHMARK');
      console.log('-'.repeat(30));
      const perfStats = this.results.performance.summary;
      console.log(`Uptime: ${(perfStats.uptime / 1000 / 60).toFixed(2)} minutes`);
      console.log(`Avg Requests: ${perfStats.avgRequests.toFixed(1)}`);
      console.log(`Avg Errors: ${perfStats.avgErrors.toFixed(1)}`);
      console.log(`Avg Response Time: ${perfStats.avgResponseTime.toFixed(2)}ms`);
      console.log(`Avg Cache Hit Rate: ${(perfStats.avgCacheHitRate * 100).toFixed(1)}%`);
      console.log(`Final Memory: ${this.formatBytes(perfStats.finalMemoryUsage.rss)}`);
    }

    // Overall Score
    this.calculateOverallScore();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Benchmark completed successfully!');
    console.log('='.repeat(60));
  }

  calculateOverallScore() {
    const loadScore = Math.min(100, (1000 / this.results.load.requestsPerSecond) * 50);
    const memoryScore = Math.max(0, 100 - this.results.memory.statistics.heapUsed.avg / (1024 * 1024 * 100)); // Score based on MB usage
    const errorScore = Math.max(0, 100 - this.results.load.errorRate * 2);

    const overallScore = (loadScore + memoryScore + errorScore) / 3;

    console.log(`\n🏆 OVERALL SCORE: ${overallScore.toFixed(1)}/100`);
    console.log(`   Load: ${loadScore.toFixed(1)}/100`);
    console.log(`   Memory: ${memoryScore.toFixed(1)}/100`);
    console.log(`   Stability: ${errorScore.toFixed(1)}/100`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  saveResults() {
    const fs = require('fs');
    const resultsPath = path.join(__dirname, '..', 'benchmark-results.json');

    try {
      fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
      console.log(`\n💾 Results saved to: ${resultsPath}`);
    } catch (error) {
      console.error('Failed to save results:', error.message);
    }
  }
}

// Main execution
if (require.main === module) {
  const benchmark = new BenchmarkTool();
  process.on('SIGINT', () => {
    console.log('\n🛑 Benchmark interrupted by user');
    benchmark.saveResults();
    process.exit(0);
  });
}

module.exports = BenchmarkTool;

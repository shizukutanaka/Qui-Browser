#!/usr/bin/env node

/**
 * Performance Regression Checker
 * Compares current benchmark results against baseline to detect regressions
 *
 * Usage:
 *   node check-performance-regression.js benchmark-results.json [baseline.json]
 *
 * John Carmack principle: "If you can't measure it, you can't improve it"
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const THRESHOLDS = {
  // Percentage increases that trigger warnings/failures
  loadTime: {
    warning: 10,  // 10% slower = warning
    error: 20     // 20% slower = error
  },
  memory: {
    warning: 15,
    error: 30
  },
  fileSize: {
    warning: 10,
    error: 20
  }
};

const BASELINE_FILE = 'baseline-performance.json';

// ============================================================================
// Main Function
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node check-performance-regression.js <results-file> [baseline-file]');
    process.exit(1);
  }

  const resultsFile = args[0];
  const baselineFile = args[1] || BASELINE_FILE;

  // Load results
  const results = loadJSON(resultsFile);
  if (!results) {
    console.error(`❌ Failed to load results from: ${resultsFile}`);
    process.exit(1);
  }

  // Load baseline (if exists)
  let baseline = null;
  if (fs.existsSync(baselineFile)) {
    baseline = loadJSON(baselineFile);
    if (!baseline) {
      console.warn(`⚠️  Failed to load baseline from: ${baselineFile}`);
      console.warn('   Continuing without baseline comparison...');
    }
  } else {
    console.log(`📝 No baseline found. Creating baseline: ${baselineFile}`);
    saveBaseline(results, baselineFile);
    console.log('✅ Baseline created. Run again to compare against baseline.');
    process.exit(0);
  }

  // Compare results
  const comparison = compareResults(results, baseline);

  // Print report
  printReport(comparison);

  // Exit with appropriate code
  if (comparison.hasErrors) {
    console.error('\n❌ Performance regression detected!');
    process.exit(1);
  } else if (comparison.hasWarnings) {
    console.warn('\n⚠️  Performance warnings detected.');
    process.exit(0); // Don't fail on warnings
  } else {
    console.log('\n✅ No performance regressions detected.');
    process.exit(0);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load JSON file
 */
function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Save baseline file
 */
function saveBaseline(results, filePath) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
    return true;
  } catch (error) {
    console.error(`Failed to save baseline: ${error.message}`);
    return false;
  }
}

/**
 * Compare results against baseline
 */
function compareResults(current, baseline) {
  const comparison = {
    modules: [],
    hasErrors: false,
    hasWarnings: false,
    summary: {
      total: 0,
      improved: 0,
      degraded: 0,
      unchanged: 0
    }
  };

  // Get all module names
  const moduleNames = new Set([
    ...Object.keys(current.results || {}),
    ...Object.keys(baseline.results || {})
  ]);

  for (const moduleName of moduleNames) {
    const currentData = current.results?.[moduleName];
    const baselineData = baseline.results?.[moduleName];

    if (!currentData || !baselineData) {
      // Module added or removed
      continue;
    }

    const moduleComparison = compareModule(moduleName, currentData, baselineData);
    comparison.modules.push(moduleComparison);

    if (moduleComparison.hasError) {
      comparison.hasErrors = true;
      comparison.summary.degraded++;
    } else if (moduleComparison.hasWarning) {
      comparison.hasWarnings = true;
      comparison.summary.degraded++;
    } else if (moduleComparison.improved) {
      comparison.summary.improved++;
    } else {
      comparison.summary.unchanged++;
    }

    comparison.summary.total++;
  }

  return comparison;
}

/**
 * Compare individual module
 */
function compareModule(name, current, baseline) {
  const comparison = {
    name,
    metrics: [],
    hasError: false,
    hasWarning: false,
    improved: false
  };

  // Compare load time
  if (current.stats?.mean && baseline.stats?.mean) {
    const change = calculateChange(current.stats.mean, baseline.stats.mean);
    const metric = {
      name: 'Load Time',
      current: current.stats.mean.toFixed(2) + 'ms',
      baseline: baseline.stats.mean.toFixed(2) + 'ms',
      change: change.toFixed(1) + '%',
      status: getStatus(change, THRESHOLDS.loadTime)
    };

    comparison.metrics.push(metric);

    if (metric.status === 'error') {
      comparison.hasError = true;
    } else if (metric.status === 'warning') {
      comparison.hasWarning = true;
    } else if (change < 0) {
      comparison.improved = true;
    }
  }

  // Compare memory
  if (current.memoryUsed && baseline.memoryUsed) {
    const change = calculateChange(current.memoryUsed, baseline.memoryUsed);
    const metric = {
      name: 'Memory',
      current: formatBytes(current.memoryUsed),
      baseline: formatBytes(baseline.memoryUsed),
      change: change.toFixed(1) + '%',
      status: getStatus(change, THRESHOLDS.memory)
    };

    comparison.metrics.push(metric);

    if (metric.status === 'error') {
      comparison.hasError = true;
    } else if (metric.status === 'warning') {
      comparison.hasWarning = true;
    }
  }

  // Compare file size
  if (current.sizeKB && baseline.sizeKB) {
    const change = calculateChange(current.sizeKB, baseline.sizeKB);
    const metric = {
      name: 'File Size',
      current: current.sizeKB.toFixed(1) + ' KB',
      baseline: baseline.sizeKB.toFixed(1) + ' KB',
      change: change.toFixed(1) + '%',
      status: getStatus(change, THRESHOLDS.fileSize)
    };

    comparison.metrics.push(metric);

    if (metric.status === 'error') {
      comparison.hasError = true;
    } else if (metric.status === 'warning') {
      comparison.hasWarning = true;
    }
  }

  return comparison;
}

/**
 * Calculate percentage change
 */
function calculateChange(current, baseline) {
  if (baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
}

/**
 * Get status based on change and thresholds
 */
function getStatus(change, thresholds) {
  if (change >= thresholds.error) {
    return 'error';
  } else if (change >= thresholds.warning) {
    return 'warning';
  } else if (change < 0) {
    return 'improved';
  } else {
    return 'ok';
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Print comparison report
 */
function printReport(comparison) {
  console.log('\n' + '='.repeat(80));
  console.log('  Performance Regression Check');
  console.log('='.repeat(80));

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Total modules: ${comparison.summary.total}`);
  console.log(`   ✅ Improved: ${comparison.summary.improved}`);
  console.log(`   ⚠️  Degraded: ${comparison.summary.degraded}`);
  console.log(`   ➡️  Unchanged: ${comparison.summary.unchanged}`);

  // Detailed results
  if (comparison.modules.length > 0) {
    console.log('\n📈 Detailed Results:\n');

    for (const module of comparison.modules) {
      // Module header
      const statusIcon = module.hasError ? '❌' : module.hasWarning ? '⚠️' : module.improved ? '✅' : '➡️';
      console.log(`${statusIcon} ${module.name}`);

      // Metrics table
      if (module.metrics.length > 0) {
        console.log('   ┌─────────────┬──────────────┬──────────────┬──────────┬────────┐');
        console.log('   │ Metric      │ Current      │ Baseline     │ Change   │ Status │');
        console.log('   ├─────────────┼──────────────┼──────────────┼──────────┼────────┤');

        for (const metric of module.metrics) {
          const statusIcon =
            metric.status === 'error' ? '❌' :
            metric.status === 'warning' ? '⚠️' :
            metric.status === 'improved' ? '✅' : '➡️';

          console.log(
            `   │ ${metric.name.padEnd(11)} │ ` +
            `${metric.current.padEnd(12)} │ ` +
            `${metric.baseline.padEnd(12)} │ ` +
            `${metric.change.padEnd(8)} │ ` +
            `${statusIcon.padEnd(6)} │`
          );
        }

        console.log('   └─────────────┴──────────────┴──────────────┴──────────┴────────┘');
      }

      console.log('');
    }
  }

  // Thresholds
  console.log('📏 Thresholds:');
  console.log(`   Load Time: ⚠️ ${THRESHOLDS.loadTime.warning}% | ❌ ${THRESHOLDS.loadTime.error}%`);
  console.log(`   Memory: ⚠️ ${THRESHOLDS.memory.warning}% | ❌ ${THRESHOLDS.memory.error}%`);
  console.log(`   File Size: ⚠️ ${THRESHOLDS.fileSize.warning}% | ❌ ${THRESHOLDS.fileSize.error}%`);
}

// ============================================================================
// Run
// ============================================================================

if (require.main === module) {
  main();
}

module.exports = {
  compareResults,
  compareModule,
  calculateChange,
  getStatus
};

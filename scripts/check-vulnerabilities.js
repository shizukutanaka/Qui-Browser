'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SEVERITY_THRESHOLD = process.env.SEVERITY_THRESHOLD || 'moderate';
const REPORT_DIR = process.env.REPORT_DIR || 'reports';
const EXIT_ON_VULNERABILITY = process.env.EXIT_ON_VULNERABILITY !== 'false';
const ENABLE_SNYK = process.env.ENABLE_SNYK === 'true' || process.argv.includes('--snyk');
const SNYK_SEVERITY_THRESHOLD = process.env.SNYK_SEVERITY_THRESHOLD || SEVERITY_THRESHOLD;
const SNYK_COMMAND = process.env.SNYK_COMMAND || 'snyk test --json';

const SEVERITY_LEVELS = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4
};

function runAudit() {
  console.log('🔍 Running npm audit...');
  try {
    const output = execSync('npm audit --json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(output);
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error) {
      const stdOut = /** @type {{ stdout?: string }} */ (error).stdout;
      if (typeof stdOut === 'string') {
        try {
          return JSON.parse(stdOut);
        } catch (parseError) {
          console.error('❌ Failed to parse npm audit output');
          throw parseError;
        }
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ npm audit execution failed:', message);
    throw error;
  }
}

function runSnykTest() {
  console.log('🔐 Running Snyk test...');
  try {
    const output = execSync(SNYK_COMMAND, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(output);
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error) {
      const stdOut = /** @type {{ stdout?: string }} */ (error).stdout;
      if (typeof stdOut === 'string') {
        try {
          return JSON.parse(stdOut);
        } catch (parseError) {
          console.error('❌ Failed to parse Snyk output');
          throw parseError;
        }
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Snyk execution failed:', message);
    throw error;
  }
}

function normalizeSummary(metadata) {
  const source = metadata && typeof metadata === 'object' ? metadata : {};
  const summary = source.vulnerabilities && typeof source.vulnerabilities === 'object' ? source.vulnerabilities : {};
  const toCount = key => {
    const value = summary[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };
  return {
    total: toCount('total'),
    info: toCount('info'),
    low: toCount('low'),
    moderate: toCount('moderate'),
    high: toCount('high'),
    critical: toCount('critical')
  };
}

function extractAuditFindings(auditData) {
  const vulnerabilities = auditData && typeof auditData === 'object' ? auditData.vulnerabilities : undefined;
  if (!vulnerabilities || typeof vulnerabilities !== 'object') {
    return [];
  }

  const thresholdLevel = SEVERITY_LEVELS[SEVERITY_THRESHOLD] || 2;
  const findings = [];

  for (const [name, raw] of Object.entries(vulnerabilities)) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const severity = typeof raw.severity === 'string' ? raw.severity : 'unknown';
    const severityLevel = SEVERITY_LEVELS[severity] ?? 0;
    if (severityLevel < thresholdLevel) {
      continue;
    }
    findings.push({
      source: 'npm audit',
      name,
      severity,
      title: typeof raw.title === 'string' ? raw.title : 'Unknown',
      url: typeof raw.url === 'string' ? raw.url : '',
      range: typeof raw.range === 'string' ? raw.range : '',
      via: Array.isArray(raw.via) ? raw.via : []
    });
  }
  return findings;
}

function extractSnykFindings(snykData, threshold = 'moderate') {
  const issues =
    snykData && snykData.issues && Array.isArray(snykData.issues.vulnerabilities)
      ? snykData.issues.vulnerabilities
      : [];
  const thresholdLevel = SEVERITY_LEVELS[threshold] || 2;

  return issues
    .filter(item => {
      const severity = item && typeof item.severity === 'string' ? item.severity : 'low';
      const mapped = severity === 'medium' ? 'moderate' : severity;
      const level = SEVERITY_LEVELS[mapped] || 0;
      return level >= thresholdLevel;
    })
    .map(item => ({
      source: 'snyk',
      id: item.id,
      package: item.packageName,
      version: item.version,
      severity: item.severity,
      title: item.title,
      url: item.url || (item.identifiers?.CVE?.[0] ?? ''),
      from: item.from,
      upgradePath: Array.isArray(item.upgradePath) ? item.upgradePath : [],
      isFixable: Boolean(item.isFixable || item.isUpgradable || item.isPatchable)
    }));
}

function buildReport(auditData, options = {}) {
  const summary = normalizeSummary(auditData?.metadata);
  const auditFindings = extractAuditFindings(auditData);
  const snykFindings = Array.isArray(options.snykFindings) ? options.snykFindings : [];
  const snykThreshold = options.snykThreshold;

  return {
    timestamp: new Date().toISOString(),
    summary,
    threshold: SEVERITY_THRESHOLD,
    thresholdExceeded: auditFindings.length > 0,
    vulnerabilities: auditFindings,
    snykFindings,
    snykThreshold
  };
}

function saveReport(report) {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `vulnerability-report-${timestamp}.json`;
  const filepath = path.join(REPORT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved: ${filepath}`);
  return filepath;
}

function formatFinding(index, finding) {
  const severityIcon =
    {
      critical: '🔴',
      high: '🟠',
      moderate: '🟡',
      medium: '🟡',
      low: '🟢',
      info: 'ℹ️'
    }[finding.severity] || '❓';

  const lines = [];
  lines.push(
    `${index + 1}. ${severityIcon} [${finding.severity?.toUpperCase() ?? 'UNKNOWN'}] ${finding.name || finding.package || 'unknown'}`
  );
  if (finding.title) {
    lines.push(`   ${finding.title}`);
  }
  if (finding.url) {
    lines.push(`   Details: ${finding.url}`);
  }
  if (finding.upgradePath && finding.upgradePath.length > 0) {
    lines.push(`   Suggested upgrade path: ${finding.upgradePath.join(' -> ')}`);
  }
  return lines.join('\n');
}

function displayReport(report) {
  console.log('\n📊 Vulnerability Scan Summary');
  console.log('='.repeat(60));

  const { summary, threshold, thresholdExceeded, vulnerabilities, snykFindings, snykThreshold } = report;

  console.log(`\nTotal vulnerabilities: ${summary.total}`);
  console.log(`  Info:     ${summary.info}`);
  console.log(`  Low:      ${summary.low}`);
  console.log(`  Moderate: ${summary.moderate}`);
  console.log(`  High:     ${summary.high}`);
  console.log(`  Critical: ${summary.critical}`);

  console.log(`\nThreshold: ${threshold} and above`);

  if (thresholdExceeded) {
    console.log(`\n⚠️ ${vulnerabilities.length} npm audit findings exceed the threshold:\n`);
    vulnerabilities.forEach((vuln, index) => {
      console.log(formatFinding(index, vuln));
      console.log('');
    });
  } else {
    console.log('\n✅ No npm audit findings exceeded the configured threshold');
  }

  if (snykFindings && snykFindings.length > 0) {
    console.log(`\n🔐 Snyk findings (threshold: ${snykThreshold ?? SNYK_SEVERITY_THRESHOLD}): ${snykFindings.length}`);
    snykFindings.forEach((finding, index) => {
      console.log(formatFinding(index, finding));
      console.log('');
    });
  }

  console.log('='.repeat(60));
}

function main() {
  try {
    const auditData = runAudit();
    let snykFindings;
    if (ENABLE_SNYK) {
      const snykData = runSnykTest();
      snykFindings = extractSnykFindings(snykData, SNYK_SEVERITY_THRESHOLD);
    }

    const report = buildReport(auditData, {
      snykFindings,
      snykThreshold: ENABLE_SNYK ? SNYK_SEVERITY_THRESHOLD : undefined
    });

    displayReport(report);
    saveReport(report);

    const snykExceeded = Array.isArray(snykFindings) && snykFindings.length > 0;
    if ((report.thresholdExceeded || snykExceeded) && EXIT_ON_VULNERABILITY) {
      console.log('\n❌ Vulnerabilities detected above the threshold. Please remediate.');
      console.log('Suggested fix: npm audit fix');
      process.exit(1);
    }

    console.log('\n✅ Vulnerability scan completed successfully\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('\n❌ Error occurred during vulnerability scanning:');
    console.error(message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runAudit,
  runSnykTest,
  extractSnykFindings,
  buildReport,
  saveReport,
  displayReport,
  main
};

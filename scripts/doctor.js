'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/** @type {{ version: string, engines?: { node?: string } }} */
const packageJson = require('../package.json');
const { collectDocsStatus } = require('./check-docs-consistency.js');
const { checkCertificate } = require('./check-tls-expiry.js');
const { runEnvCheck } = require('./check-env.js');

const PROJECT_ROOT = path.join(__dirname, '..');
const ICONS = {
  ok: '✔',
  warning: '⚠',
  error: '✖'
};

function makeResult(name, severity, message, details) {
  return details ? { name, severity, message, details } : { name, severity, message };
}

function checkNodeVersion() {
  const currentVersion = process.versions.node;
  const currentMajor = Number.parseInt(currentVersion.split('.')[0], 10);

  let requiredMajor = 18;
  const enginesNode = packageJson.engines?.node;
  if (typeof enginesNode === 'string') {
    const match = enginesNode.match(/(\d{2})/);
    if (match) {
      requiredMajor = Number.parseInt(match[1], 10);
    }
  }

  if (Number.isNaN(currentMajor)) {
    return makeResult('Node.js version', 'warning', `Unable to determine current Node.js version (${currentVersion}).`);
  }

  if (currentMajor < requiredMajor) {
    return makeResult('Node.js version', 'error', `Node.js v${currentVersion} detected. Require >= ${requiredMajor}.`);
  }

  return makeResult('Node.js version', 'ok', `Node.js v${currentVersion} satisfies >= ${requiredMajor}.`);
}

function checkDocumentation() {
  const status = collectDocsStatus();
  const missingLocales = status.filter(localeStatus => localeStatus.missing.length > 0);
  const incompleteSections = status.filter(localeStatus => localeStatus.operationsMissingSections.length > 0);

  if (missingLocales.length === 0 && incompleteSections.length === 0) {
    return makeResult('Documentation coverage', 'ok', 'All locales include required files and sections.');
  }

  const details = {
    missing: missingLocales,
    operationsMissingSections: incompleteSections
  };

  const hasErrors = missingLocales.length > 0;
  const severity = hasErrors ? 'error' : 'warning';

  const messageParts = [];
  if (missingLocales.length > 0) {
    messageParts.push(`Missing files in locales: ${missingLocales.map(item => item.locale).join(', ')}`);
  }
  if (incompleteSections.length > 0) {
    messageParts.push(
      `Operations guide missing sections in locales: ${incompleteSections.map(item => item.locale).join(', ')}`
    );
  }

  return makeResult('Documentation coverage', severity, messageParts.join(' | '), details);
}

function checkEnvFiles() {
  const envExamplePath = path.join(PROJECT_ROOT, '.env.example');
  const envPath = path.join(PROJECT_ROOT, '.env');

  const hasExample = fs.existsSync(envExamplePath);
  const hasEnv = fs.existsSync(envPath);

  if (!hasExample) {
    return makeResult('Environment files', 'error', 'Missing .env.example file.');
  }

  if (!hasEnv) {
    return makeResult('Environment files', 'warning', '.env not found. Create one based on .env.example.');
  }

  return makeResult('Environment files', 'ok', '.env and .env.example detected.');
}

function checkEnvironmentConfiguration() {
  try {
    const envCheck = runEnvCheck({ silent: true });
    const errors = envCheck.results.filter(item => item.status === 'error');
    const warnings = envCheck.results.filter(item => item.status === 'warning');

    const details = {
      errors: errors.map(item => ({
        titleEn: item.titleEn,
        detailEn: item.detailEn,
        titleJa: item.titleJa,
        detailJa: item.detailJa
      })),
      warnings: warnings.map(item => ({
        titleEn: item.titleEn,
        detailEn: item.detailEn,
        titleJa: item.titleJa,
        detailJa: item.detailJa
      }))
    };

    if (envCheck.errorCount > 0) {
      return makeResult(
        'Environment configuration',
        'error',
        `Detected ${envCheck.errorCount} error(s) and ${envCheck.warningCount} warning(s). Run "npm run check:env" for full report.`,
        details
      );
    }

    if (envCheck.warningCount > 0) {
      return makeResult(
        'Environment configuration',
        'warning',
        `Environment variables contain ${envCheck.warningCount} warning(s). Review "npm run check:env" output before deployment.`,
        details
      );
    }

    return makeResult('Environment configuration', 'ok', 'All required environment variables are configured.', details);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return makeResult('Environment configuration', 'error', `Failed to evaluate environment: ${message}`);
  }
}

function checkOperationsTemplate() {
  const templatePath = path.join(PROJECT_ROOT, 'docs', 'templates', 'operations-template.md');
  if (!fs.existsSync(templatePath)) {
    return makeResult('Operations template', 'error', 'docs/templates/operations-template.md is missing.');
  }

  return makeResult('Operations template', 'ok', 'docs/templates/operations-template.md available.');
}

function checkRepositoryStatus() {
  const gitPath = path.join(PROJECT_ROOT, '.git');
  if (!fs.existsSync(gitPath)) {
    return makeResult('Repository status', 'warning', '.git directory not found. Ensure you cloned the repository.');
  }

  return makeResult('Repository status', 'ok', 'Git metadata present.');
}

function checkTlsCertificate(options = {}) {
  const certificatePath = options.certificatePath || process.env.TLS_CERT_PATH;
  const thresholdDays = options.thresholdDays || Number(process.env.TLS_RENEW_THRESHOLD_DAYS) || 30;

  if (!certificatePath) {
    return makeResult('TLS certificate', 'warning', 'TLS_CERT_PATH not configured. Skipping certificate expiry check.');
  }

  try {
    const result = checkCertificate({
      certificatePath,
      thresholdDays
    });

    if (result.status === 'expired') {
      return makeResult('TLS certificate', 'error', `Certificate expired on ${result.validTo}`, result);
    }

    if (result.status === 'warning') {
      return makeResult(
        'TLS certificate',
        'warning',
        `Certificate expires in ${result.daysRemaining} days (valid until ${result.validTo})`,
        result
      );
    }

    return makeResult('TLS certificate', 'ok', `Certificate valid until ${result.validTo}`, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return makeResult('TLS certificate', 'error', `Failed to check certificate: ${message}`);
  }
}

function runDiagnostics(options = {}) {
  const { silent = false, checkTls = false, tlsCertificatePath, tlsThresholdDays, tlsRenewCommand } = options;

  const checks = [
    checkNodeVersion(),
    checkDocumentation(),
    checkEnvFiles(),
    checkEnvironmentConfiguration(),
    checkOperationsTemplate(),
    checkRepositoryStatus()
  ];

  if (checkTls) {
    checks.push(
      checkTlsCertificate({
        certificatePath: tlsCertificatePath,
        thresholdDays: tlsThresholdDays,
        renewCommand: tlsRenewCommand
      })
    );
  }

  const hasErrors = checks.some(check => check.severity === 'error');
  const hasWarnings = checks.some(check => check.severity === 'warning');

  const result = {
    checks,
    hasErrors,
    hasWarnings,
    hostname: os.hostname(),
    os: {
      platform: os.platform(),
      release: os.release()
    }
  };

  if (!silent) {
    printReport(result);
  }

  return result;
}

function printReport(result) {
  console.log('Qui Browser Doctor Report');
  console.log(`Host: ${result.hostname}`);
  console.log(`Platform: ${result.os.platform} ${result.os.release}`);
  console.log('');

  for (const check of result.checks) {
    const icon = ICONS[check.severity] || '';
    console.log(`${icon} ${check.name}: ${check.message}`);
    if (check.details) {
      console.log(`    details: ${JSON.stringify(check.details)}`);
    }
  }

  console.log('');
  if (result.hasErrors) {
    console.log('Doctor completed with errors. Resolve the issues above.');
  } else if (result.hasWarnings) {
    console.log('Doctor completed with warnings. Review the highlighted items.');
  } else {
    console.log('Doctor completed successfully. No issues detected.');
  }
}

if (require.main === module) {
  const result = runDiagnostics();
  process.exit(result.hasErrors ? 1 : 0);
}

module.exports = {
  runDiagnostics,
  checkTlsCertificate
};

'use strict';

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const REQUIRED_FILES = ['README.md', 'security.md', 'operations.md'];
const REQUIRED_OPERATION_SECTIONS = Array.from({ length: 10 }, (_, index) => index + 1);
const REPORT_FLAG = '--report=';

/**
 * @typedef {Object} LocaleStatus
 * @property {string} locale
 * @property {string[]} missing
 * @property {number[]} operationsMissingSections
 */

/**
 * Collect documentation status for each locale directory.
 * @returns {LocaleStatus[]}
 */
function collectDocsStatus() {
  if (!fs.existsSync(DOCS_DIR)) {
    throw new Error(`Docs directory not found: ${DOCS_DIR}`);
  }

  const entries = fs.readdirSync(DOCS_DIR, { withFileTypes: true });
  /** @type {LocaleStatus[]} */
  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const locale = entry.name;

    if (locale === 'templates') {
      continue;
    }

    const localeDir = path.join(DOCS_DIR, locale);
    const missing = [];
    let operationsMissingSections = [];

    for (const required of REQUIRED_FILES) {
      const candidate = path.join(localeDir, required);
      if (!fs.existsSync(candidate)) {
        missing.push(required);
        continue;
      }

      if (required === 'operations.md') {
        operationsMissingSections = validateOperationsSections(candidate);
      }
    }

    results.push({ locale, missing, operationsMissingSections });
  }

  return results;
}

/**
 * Validate that the operations guide includes all numbered sections 1-10.
 * @param {string} operationsPath
 * @returns {number[]} Missing section numbers
 */
function validateOperationsSections(operationsPath) {
  try {
    const content = fs.readFileSync(operationsPath, 'utf8');
    const foundSections = new Set();
    const sectionPattern = /^##\s*(\d+)\./gm;
    let match;

    while ((match = sectionPattern.exec(content)) !== null) {
      const sectionNumber = Number.parseInt(match[1], 10);
      if (!Number.isNaN(sectionNumber)) {
        foundSections.add(sectionNumber);
      }
    }

    return REQUIRED_OPERATION_SECTIONS.filter(section => !foundSections.has(section));
  } catch (error) {
    console.error(
      `Failed to validate operations guide at ${operationsPath}:`,
      error instanceof Error ? error.message : error
    );
    return REQUIRED_OPERATION_SECTIONS.slice();
  }
}

/**
 * Print human-readable report to stdout.
 * @param {LocaleStatus[]} status
 */
function printReport(status) {
  console.log('Qui Browser documentation consistency check');
  console.log(`Required files: ${REQUIRED_FILES.join(', ')}`);
  console.log('');

  let issues = 0;
  for (const { locale, missing, operationsMissingSections } of status) {
    if (missing.length === 0 && operationsMissingSections.length === 0) {
      console.log(`✔ ${locale}: complete`);
      continue;
    }

    if (missing.length > 0) {
      issues += missing.length;
      console.log(`✖ ${locale}: missing -> ${missing.join(', ')}`);
    } else {
      console.log(`⚠ ${locale}: all required files present`);
    }

    if (operationsMissingSections.length > 0) {
      issues += operationsMissingSections.length;
      console.log(`    Operations guide missing numbered sections: ${operationsMissingSections.join(', ')}`);
    }
  }

  console.log('');
  if (issues === 0) {
    console.log('All locales have the required documentation files.');
  } else {
    console.log(`Detected ${issues} documentation issues across locales.`);
  }
}

function main() {
  try {
    const status = collectDocsStatus();

    const hasIssues = status.some(item => item.missing.length > 0 || item.operationsMissingSections.length > 0);

    const reportPathArg = process.argv.find(arg => arg.startsWith(REPORT_FLAG));
    if (reportPathArg) {
      const outputPath = path.resolve(reportPathArg.slice(REPORT_FLAG.length));
      const payload = {
        generatedAt: new Date().toISOString(),
        requiredFiles: REQUIRED_FILES,
        requiredOperationSections: REQUIRED_OPERATION_SECTIONS,
        locales: status
      };
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
    }

    if (process.argv.includes('--json')) {
      console.log(
        JSON.stringify(
          {
            requiredFiles: REQUIRED_FILES,
            requiredOperationSections: REQUIRED_OPERATION_SECTIONS,
            locales: status
          },
          null,
          2
        )
      );
      process.exit(hasIssues ? 1 : 0);
      return;
    }

    printReport(status);
    process.exit(hasIssues ? 1 : 0);
  } catch (error) {
    console.error('Documentation consistency check failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  collectDocsStatus
};

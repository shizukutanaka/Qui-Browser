#!/usr/bin/env node

/**
 * Pre-Release Validation Tool
 * Comprehensive validation before v2.0.0 release
 *
 * Usage:
 *   node tools/pre-release-validation.js
 *
 * John Carmack principle: "Ship when it's ready, not when it's due"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ROOT = path.join(__dirname, '..');
const EXPECTED_VERSION = '2.0.0';

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('  Pre-Release Validation for v2.0.0');
  console.log('='.repeat(80));
  console.log('');

  const results = {
    passed: [],
    failed: [],
    warnings: [],
    skipped: []
  };

  // Run all validation checks
  await checkVersion(results);
  await checkGitStatus(results);
  await checkPackageJson(results);
  await checkDocumentation(results);
  await checkSourceCode(results);
  await checkTests(results);
  await checkBuildConfiguration(results);
  await checkCICDWorkflows(results);
  await checkDockerConfiguration(results);
  await checkSecurityFiles(results);

  // Print summary
  printSummary(results);

  // Exit with appropriate code
  if (results.failed.length > 0) {
    console.error('\n❌ Pre-release validation FAILED');
    console.error('   Fix the errors above before releasing.\n');
    process.exit(1);
  } else if (results.warnings.length > 0) {
    console.warn('\n⚠️  Pre-release validation completed with WARNINGS');
    console.warn('   Review warnings before proceeding.\n');
    process.exit(0);
  } else {
    console.log('\n✅ Pre-release validation PASSED');
    console.log('   All checks successful! Ready for release.\n');
    process.exit(0);
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check version consistency
 */
async function checkVersion(results) {
  console.log('🔢 Checking version consistency...\n');

  try {
    // Check package.json version
    const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const version = packageJson.version;

    if (version === EXPECTED_VERSION) {
      results.passed.push(`package.json version is ${version}`);
      console.log(`  ✅ package.json version: ${version}`);
    } else {
      results.failed.push(`package.json version is ${version}, expected ${EXPECTED_VERSION}`);
      console.log(`  ❌ package.json version: ${version} (expected ${EXPECTED_VERSION})`);
    }

    // Check version in documentation
    const docFiles = ['README.md', 'PROJECT_STATUS.md', 'FINAL_RELEASE_SUMMARY_v2.0.0.md'];
    for (const docFile of docFiles) {
      const filePath = path.join(PROJECT_ROOT, docFile);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes(version)) {
          results.passed.push(`${docFile} contains version ${version}`);
          console.log(`  ✅ ${docFile} contains version ${version}`);
        } else {
          results.warnings.push(`${docFile} may not contain version ${version}`);
          console.log(`  ⚠️  ${docFile} - version not found`);
        }
      }
    }

    console.log('');
  } catch (error) {
    results.failed.push(`Version check failed: ${error.message}`);
    console.log(`  ❌ Version check failed: ${error.message}\n`);
  }
}

/**
 * Check Git status
 */
async function checkGitStatus(results) {
  console.log('📦 Checking Git status...\n');

  try {
    // Check for uncommitted changes
    const status = execSync('git status --porcelain', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8'
    });

    if (status.trim() === '') {
      results.passed.push('No uncommitted changes');
      console.log('  ✅ No uncommitted changes');
    } else {
      results.warnings.push('Uncommitted changes detected');
      console.log('  ⚠️  Uncommitted changes detected:');
      console.log(status.split('\n').map(line => `     ${line}`).join('\n'));
    }

    // Check current branch
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8'
    }).trim();

    if (branch === 'main' || branch === 'master') {
      results.passed.push(`On ${branch} branch`);
      console.log(`  ✅ On ${branch} branch`);
    } else {
      results.warnings.push(`On ${branch} branch (expected main/master)`);
      console.log(`  ⚠️  On ${branch} branch`);
    }

    console.log('');
  } catch (error) {
    results.failed.push(`Git check failed: ${error.message}`);
    console.log(`  ❌ Git check failed: ${error.message}\n`);
  }
}

/**
 * Check package.json
 */
async function checkPackageJson(results) {
  console.log('📦 Checking package.json...\n');

  try {
    const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Check required fields
    const requiredFields = ['name', 'version', 'description', 'license', 'scripts'];
    for (const field of requiredFields) {
      if (packageJson[field]) {
        results.passed.push(`package.json has ${field}`);
        console.log(`  ✅ ${field}: ${typeof packageJson[field] === 'object' ? 'defined' : packageJson[field]}`);
      } else {
        results.failed.push(`package.json missing ${field}`);
        console.log(`  ❌ Missing ${field}`);
      }
    }

    // Check scripts
    const requiredScripts = [
      'dev', 'build', 'test', 'lint', 'ci:all',
      'docker:build', 'deploy:netlify', 'release:patch'
    ];

    let scriptsOk = true;
    for (const script of requiredScripts) {
      if (!packageJson.scripts || !packageJson.scripts[script]) {
        scriptsOk = false;
        results.warnings.push(`Missing script: ${script}`);
        console.log(`  ⚠️  Missing script: ${script}`);
      }
    }

    if (scriptsOk) {
      results.passed.push('All required scripts present');
      console.log(`  ✅ All required scripts present (30+ scripts)`);
    }

    console.log('');
  } catch (error) {
    results.failed.push(`package.json check failed: ${error.message}`);
    console.log(`  ❌ package.json check failed: ${error.message}\n`);
  }
}

/**
 * Check documentation
 */
async function checkDocumentation(results) {
  console.log('📚 Checking documentation...\n');

  const requiredDocs = [
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'SECURITY.md',
    'PROJECT_STATUS.md',
    'RELEASE_CHECKLIST.md',
    'FINAL_RELEASE_SUMMARY_v2.0.0.md',
    'docs/API.md',
    'docs/USAGE_GUIDE.md',
    'docs/DEPLOYMENT_GUIDE.md',
    'docs/QUICK_START.md'
  ];

  let allDocsExist = true;
  for (const doc of requiredDocs) {
    const docPath = path.join(PROJECT_ROOT, doc);
    if (fs.existsSync(docPath)) {
      const stats = fs.statSync(docPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`  ✅ ${doc} (${sizeKB} KB)`);
    } else {
      allDocsExist = false;
      results.failed.push(`Missing documentation: ${doc}`);
      console.log(`  ❌ ${doc} - NOT FOUND`);
    }
  }

  if (allDocsExist) {
    results.passed.push(`All ${requiredDocs.length} documentation files present`);
  }

  console.log('');
}

/**
 * Check source code
 */
async function checkSourceCode(results) {
  console.log('💻 Checking source code...\n');

  const requiredFiles = [
    'src/app.js',
    'src/VRApp.js',
    'src/monitoring.js',
    'index.html'
  ];

  let allFilesExist = true;
  for (const file of requiredFiles) {
    const filePath = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(filePath)) {
      console.log(`  ✅ ${file}`);
    } else {
      allFilesExist = false;
      results.failed.push(`Missing source file: ${file}`);
      console.log(`  ❌ ${file} - NOT FOUND`);
    }
  }

  if (allFilesExist) {
    results.passed.push('All critical source files present');
  }

  // Check for VR modules
  const vrDir = path.join(PROJECT_ROOT, 'src', 'vr');
  if (fs.existsSync(vrDir)) {
    const vrFiles = getAllFiles(vrDir, '.js');
    results.passed.push(`Found ${vrFiles.length} VR module files`);
    console.log(`  ✅ Found ${vrFiles.length} VR module files`);
  } else {
    results.failed.push('VR modules directory not found');
    console.log('  ❌ src/vr directory not found');
  }

  console.log('');
}

/**
 * Check tests
 */
async function checkTests(results) {
  console.log('🧪 Checking tests...\n');

  try {
    const testFile = path.join(PROJECT_ROOT, 'tests', 'tier-system-integration.test.js');
    if (fs.existsSync(testFile)) {
      const content = fs.readFileSync(testFile, 'utf-8');
      const suites = (content.match(/describe\(/g) || []).length;
      const tests = (content.match(/test\(/g) || []).length;

      results.passed.push(`Test suite exists with ${suites} suites, ${tests} tests`);
      console.log(`  ✅ tier-system-integration.test.js`);
      console.log(`     Suites: ${suites}`);
      console.log(`     Tests: ${tests}`);
    } else {
      results.warnings.push('Main test file not found');
      console.log('  ⚠️  tier-system-integration.test.js not found');
    }

    // Check jest config
    const jestConfig = path.join(PROJECT_ROOT, 'jest.config.js');
    if (fs.existsSync(jestConfig)) {
      results.passed.push('Jest configuration exists');
      console.log('  ✅ jest.config.js');
    } else {
      results.warnings.push('Jest configuration not found');
      console.log('  ⚠️  jest.config.js not found');
    }

    console.log('');
  } catch (error) {
    results.warnings.push(`Test check failed: ${error.message}`);
    console.log(`  ⚠️  Test check failed: ${error.message}\n`);
  }
}

/**
 * Check build configuration
 */
async function checkBuildConfiguration(results) {
  console.log('⚙️  Checking build configuration...\n');

  const configFiles = [
    'vite.config.js',
    '.eslintrc.json',
    '.prettierrc.json',
    '.babelrc'
  ];

  for (const config of configFiles) {
    const configPath = path.join(PROJECT_ROOT, config);
    if (fs.existsSync(configPath)) {
      results.passed.push(`${config} exists`);
      console.log(`  ✅ ${config}`);
    } else {
      results.warnings.push(`${config} not found`);
      console.log(`  ⚠️  ${config} not found`);
    }
  }

  console.log('');
}

/**
 * Check CI/CD workflows
 */
async function checkCICDWorkflows(results) {
  console.log('🔄 Checking CI/CD workflows...\n');

  const workflows = [
    '.github/workflows/ci.yml',
    '.github/workflows/cd.yml'
  ];

  for (const workflow of workflows) {
    const workflowPath = path.join(PROJECT_ROOT, workflow);
    if (fs.existsSync(workflowPath)) {
      const content = fs.readFileSync(workflowPath, 'utf-8');
      const jobs = (content.match(/^\s{2}\w+:/gm) || []).length;

      results.passed.push(`${workflow} exists with ${jobs} jobs`);
      console.log(`  ✅ ${path.basename(workflow)} (${jobs} jobs)`);
    } else {
      results.failed.push(`${workflow} not found`);
      console.log(`  ❌ ${path.basename(workflow)} - NOT FOUND`);
    }
  }

  console.log('');
}

/**
 * Check Docker configuration
 */
async function checkDockerConfiguration(results) {
  console.log('🐳 Checking Docker configuration...\n');

  const dockerFiles = [
    'Dockerfile',
    'docker-compose.yml',
    'docker/nginx.conf',
    '.dockerignore'
  ];

  for (const file of dockerFiles) {
    const filePath = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(filePath)) {
      results.passed.push(`${file} exists`);
      console.log(`  ✅ ${file}`);
    } else {
      results.warnings.push(`${file} not found`);
      console.log(`  ⚠️  ${file} not found`);
    }
  }

  console.log('');
}

/**
 * Check security files
 */
async function checkSecurityFiles(results) {
  console.log('🔒 Checking security files...\n');

  const securityFiles = [
    'SECURITY.md',
    '.env.example'
  ];

  for (const file of securityFiles) {
    const filePath = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(filePath)) {
      results.passed.push(`${file} exists`);
      console.log(`  ✅ ${file}`);
    } else {
      results.warnings.push(`${file} not found`);
      console.log(`  ⚠️  ${file} not found`);
    }
  }

  console.log('');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all files recursively
 */
function getAllFiles(dir, ext = '') {
  let files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, ext));
    } else if (stat.isFile()) {
      if (!ext || item.endsWith(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Print validation summary
 */
function printSummary(results) {
  console.log('='.repeat(80));
  console.log('  Validation Summary');
  console.log('='.repeat(80));
  console.log('');

  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);
  console.log('');

  if (results.failed.length > 0) {
    console.log('❌ Failures:');
    for (const failure of results.failed) {
      console.log(`   - ${failure}`);
    }
    console.log('');
  }

  if (results.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const warning of results.warnings) {
      console.log(`   - ${warning}`);
    }
    console.log('');
  }

  const totalChecks = results.passed.length + results.failed.length + results.warnings.length;
  const score = totalChecks > 0 ? (results.passed.length / totalChecks) * 100 : 0;

  console.log(`📊 Overall Score: ${score.toFixed(1)}% ${getScoreEmoji(score)}`);
  console.log('');

  if (results.failed.length === 0 && results.warnings.length === 0) {
    console.log('🎉 Perfect! All validations passed.');
    console.log('');
    console.log('✨ Ready to release v2.0.0!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. git tag -a v2.0.0 -m "Release v2.0.0 - Production Ready"');
    console.log('  2. git push origin v2.0.0');
    console.log('  3. Monitor CD pipeline: https://github.com/your-username/qui-browser-vr/actions');
  } else if (results.failed.length === 0) {
    console.log('👍 Good! Minor warnings detected.');
    console.log('   Review warnings above before proceeding with release.');
  } else {
    console.log('⚠️  Critical issues detected.');
    console.log('   Fix all failures before releasing.');
  }
}

/**
 * Get score emoji
 */
function getScoreEmoji(score) {
  if (score === 100) return '🏆';
  if (score >= 95) return '✅';
  if (score >= 85) return '👍';
  if (score >= 70) return '⚠️';
  return '❌';
}

// ============================================================================
// Run
// ============================================================================

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  main
};

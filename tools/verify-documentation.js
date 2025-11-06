#!/usr/bin/env node

/**
 * Documentation Verification Tool
 * Verifies all internal links, file references, and documentation completeness
 *
 * Usage:
 *   node tools/verify-documentation.js
 *
 * John Carmack principle: "Verify everything before release"
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ROOT = path.join(__dirname, '..');

const DOCUMENTATION_FILES = [
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
  'docs/BUILD_OPTIMIZATION_GUIDE.md',
  'docs/CI_CD_MONITORING_GUIDE.md',
  'docs/TESTING.md',
  'docs/ARCHITECTURE.md',
  'docs/FAQ.md',
  'docs/QUICK_START.md'
];

const REQUIRED_SECTIONS = {
  'README.md': [
    '# Qui Browser VR',
    '## 🚀 Features',
    '## 📦 Quick Start',
    '## 🏗️ Architecture',
    '## 📊 Performance Metrics',
    '## 🛠️ Development',
    '## 🧪 Testing',
    '## 🚢 Deployment',
    '## 📚 Documentation',
    '## 🤝 Contributing',
    '## 📞 Support',
    '## 📄 License'
  ],
  'PROJECT_STATUS.md': [
    '# Qui Browser VR - Project Status',
    '## 📊 Project Overview',
    '## 🎯 Development Goals Achievement',
    '## 🚀 Feature Completion Status',
    '## 📈 Performance Metrics',
    '## 🛠️ Technical Stack',
    '## 🚢 Deployment Options',
    '## 🧪 Testing Infrastructure',
    '## 📚 Documentation'
  ],
  'RELEASE_CHECKLIST.md': [
    '# Qui Browser VR v2.0.0 - Release Checklist',
    '## 📋 Pre-Release Checklist',
    '## 🚀 Release Process',
    '## 🔄 Rollback Plan',
    '## 📊 Success Metrics',
    '## ✅ Final Sign-Off'
  ]
};

// ============================================================================
// Main Function
// ============================================================================

function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('  Documentation Verification Tool');
  console.log('='.repeat(80));
  console.log('');

  const results = {
    filesChecked: 0,
    filesFound: 0,
    filesMissing: 0,
    linksChecked: 0,
    linksValid: 0,
    linksBroken: 0,
    sectionsChecked: 0,
    sectionsFound: 0,
    sectionsMissing: 0,
    errors: [],
    warnings: []
  };

  // Check documentation files exist
  console.log('📄 Checking documentation files...\n');
  for (const docFile of DOCUMENTATION_FILES) {
    results.filesChecked++;
    const filePath = path.join(PROJECT_ROOT, docFile);
    if (fs.existsSync(filePath)) {
      results.filesFound++;
      console.log(`✅ ${docFile}`);
    } else {
      results.filesMissing++;
      results.errors.push(`Missing file: ${docFile}`);
      console.log(`❌ ${docFile} - NOT FOUND`);
    }
  }

  console.log('');

  // Check required sections
  console.log('📑 Checking required sections...\n');
  for (const [fileName, sections] of Object.entries(REQUIRED_SECTIONS)) {
    const filePath = path.join(PROJECT_ROOT, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(`📖 ${fileName}:`);

    for (const section of sections) {
      results.sectionsChecked++;
      if (content.includes(section)) {
        results.sectionsFound++;
        console.log(`  ✅ ${section}`);
      } else {
        results.sectionsMissing++;
        results.warnings.push(`Missing section in ${fileName}: ${section}`);
        console.log(`  ⚠️  ${section} - NOT FOUND`);
      }
    }
    console.log('');
  }

  // Check internal links
  console.log('🔗 Checking internal documentation links...\n');
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

  for (const docFile of DOCUMENTATION_FILES) {
    const filePath = path.join(PROJECT_ROOT, docFile);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const fileDir = path.dirname(filePath);
    let match;

    while ((match = linkPattern.exec(content)) !== null) {
      const linkText = match[1];
      const linkTarget = match[2];

      // Skip external links
      if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) {
        continue;
      }

      // Skip anchor links
      if (linkTarget.startsWith('#')) {
        continue;
      }

      results.linksChecked++;

      // Remove anchor from target
      const targetPath = linkTarget.split('#')[0];
      const absolutePath = path.resolve(fileDir, targetPath);

      if (fs.existsSync(absolutePath)) {
        results.linksValid++;
        console.log(`  ✅ ${docFile} → ${linkTarget}`);
      } else {
        results.linksBroken++;
        results.errors.push(`Broken link in ${docFile}: ${linkTarget}`);
        console.log(`  ❌ ${docFile} → ${linkTarget} - BROKEN`);
      }
    }
  }

  console.log('');

  // Check critical files
  console.log('🔍 Checking critical project files...\n');
  const criticalFiles = [
    'package.json',
    'vite.config.js',
    'jest.config.js',
    '.eslintrc.json',
    '.prettierrc.json',
    'Dockerfile',
    'docker-compose.yml',
    'netlify.toml',
    'vercel.json',
    '.github/workflows/ci.yml',
    '.github/workflows/cd.yml',
    'src/app.js',
    'src/VRApp.js',
    'src/monitoring.js',
    'index.html',
    'public/service-worker.js'
  ];

  let criticalFilesFound = 0;
  for (const file of criticalFiles) {
    const filePath = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(filePath)) {
      criticalFilesFound++;
      console.log(`  ✅ ${file}`);
    } else {
      results.warnings.push(`Critical file missing: ${file}`);
      console.log(`  ⚠️  ${file} - NOT FOUND`);
    }
  }

  console.log('');

  // Check version consistency
  console.log('🔢 Checking version consistency...\n');
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const version = packageJson.version;
    console.log(`  Package version: ${version}`);

    // Check version in key documentation files
    const versionFiles = [
      'README.md',
      'PROJECT_STATUS.md',
      'FINAL_RELEASE_SUMMARY_v2.0.0.md'
    ];

    let versionConsistent = true;
    for (const file of versionFiles) {
      const filePath = path.join(PROJECT_ROOT, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes(version) || content.includes(`v${version}`)) {
          console.log(`  ✅ ${file} contains version ${version}`);
        } else {
          versionConsistent = false;
          results.warnings.push(`Version mismatch in ${file}: expected ${version}`);
          console.log(`  ⚠️  ${file} - version mismatch`);
        }
      }
    }

    if (versionConsistent) {
      console.log(`  ✅ Version ${version} is consistent across documentation`);
    }
  }

  console.log('');

  // Print summary
  printSummary(results);

  // Exit with appropriate code
  if (results.errors.length > 0) {
    console.error('\n❌ Documentation verification FAILED\n');
    process.exit(1);
  } else if (results.warnings.length > 0) {
    console.warn('\n⚠️  Documentation verification completed with WARNINGS\n');
    process.exit(0);
  } else {
    console.log('\n✅ Documentation verification PASSED\n');
    process.exit(0);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Print verification summary
 */
function printSummary(results) {
  console.log('='.repeat(80));
  console.log('  Verification Summary');
  console.log('='.repeat(80));
  console.log('');

  // Files
  console.log('📄 Documentation Files:');
  console.log(`   Checked: ${results.filesChecked}`);
  console.log(`   Found: ${results.filesFound} ✅`);
  console.log(`   Missing: ${results.filesMissing} ${results.filesMissing > 0 ? '❌' : '✅'}`);
  console.log('');

  // Sections
  console.log('📑 Required Sections:');
  console.log(`   Checked: ${results.sectionsChecked}`);
  console.log(`   Found: ${results.sectionsFound} ✅`);
  console.log(`   Missing: ${results.sectionsMissing} ${results.sectionsMissing > 0 ? '⚠️' : '✅'}`);
  console.log('');

  // Links
  console.log('🔗 Internal Links:');
  console.log(`   Checked: ${results.linksChecked}`);
  console.log(`   Valid: ${results.linksValid} ✅`);
  console.log(`   Broken: ${results.linksBroken} ${results.linksBroken > 0 ? '❌' : '✅'}`);
  console.log('');

  // Errors
  if (results.errors.length > 0) {
    console.log('❌ Errors:');
    for (const error of results.errors) {
      console.log(`   - ${error}`);
    }
    console.log('');
  }

  // Warnings
  if (results.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const warning of results.warnings) {
      console.log(`   - ${warning}`);
    }
    console.log('');
  }

  // Overall status
  const overallScore = calculateScore(results);
  console.log('📊 Overall Score:');
  console.log(`   ${overallScore.toFixed(1)}% ${getScoreEmoji(overallScore)}`);
  console.log('');

  if (overallScore === 100) {
    console.log('🎉 Perfect score! Documentation is complete and consistent.');
  } else if (overallScore >= 95) {
    console.log('✅ Excellent! Minor improvements possible.');
  } else if (overallScore >= 85) {
    console.log('👍 Good! Some issues need attention.');
  } else {
    console.log('⚠️  Needs improvement. Address errors and warnings.');
  }
}

/**
 * Calculate overall score
 */
function calculateScore(results) {
  let totalChecks = results.filesChecked + results.sectionsChecked + results.linksChecked;
  let totalPassed = results.filesFound + results.sectionsFound + results.linksValid;

  if (totalChecks === 0) return 0;
  return (totalPassed / totalChecks) * 100;
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
  main();
}

module.exports = {
  main
};

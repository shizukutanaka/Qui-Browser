#!/usr/bin/env node

/**
 * Script to consolidate and organize advanced modules
 * Reduces 60+ untracked files to organized bundles
 */

const fs = require('fs');
const path = require('path');

// Categories for consolidation
const MODULE_CATEGORIES = {
  'unified-advanced-features.js': [
    'advanced-analytics-reporting.js',
    'advanced-backup-restore.js',
    'advanced-data-visualization.js',
    'advanced-deployment-cicd.js',
    'advanced-documentation-enhancement.js',
    'advanced-globalization-enhancement.js',
    'advanced-input-systems.js',
    'advanced-performance-monitoring.js',
    'advanced-performance-system.js',
    'advanced-realtime-collaboration.js',
    'advanced-testing-qa.js',
    'advanced-user-analytics.js'
  ],
  'unified-ai-system.js': [
    'vr-ai-assistant.js',
    'vr-ai-assistant-ui.js',
    'vr-ai-assistant-integration.js',
    'vr-ai-recommender.js',
    'vr-nlp-processor.js',
    'vr-proactive-learning.js',
    'enhanced-ai-assistant.js'
  ],
  'unified-metaverse-system.js': [
    'vr-metaverse-integration.js',
    'vr-multiplayer-browsing.js',
    'vr-avatar-system.js',
    'complete-metaverse-ecosystem.js',
    'blockchain-web3-integration.js',
    'vr-web3-wallet.js'
  ],
  'unified-cloud-system.js': [
    'cloud-synchronization-system.js',
    'vr-cloud-sync.js',
    'comprehensive-customer-support.js',
    'custom-extension-store.js'
  ],
  'unified-browser-enhancements.js': [
    'enhanced-browser-core.js',
    'enterprise-security.js',
    'multilingual-voice-system.js',
    'complete-translation-system.js',
    'offline-functionality.js',
    'lightweight-extension-system.js'
  ],
  'unified-next-gen-features.js': [
    'vr-brain-computer-interface.js',
    'vr-neural-rendering.js',
    'vr-ar-mode.js',
    'vr-webgpu-renderer.js',
    'vr-theme-editor.js',
    'vr-device-support.js',
    'vr-optimized-ui.js',
    'vr-keyboard-enhanced.js',
    'vr-spatial-audio-enhanced.js'
  ]
};

// Files to keep separate (already unified or critical)
const KEEP_SEPARATE = [
  'unified-performance-system.js',
  'unified-security-system.js',
  'unified-error-handler.js',
  'unified-vr-extension-system.js',
  'error-handler.js',
  'i18n-manager.js',
  'language-manager.js',
  'memory-optimizer.js',
  'performance-optimizer.js',
  'security-hardener.js',
  'startup-optimizer.js',
  'translation-database.js'
];

// Files to mark for deletion (duplicates or obsolete)
const MARK_FOR_DELETION = [
  'advanced-performance-monitoring.js',
  'advanced-performance-system.js',
  'vr-performance-monitor.js',
  'vr-performance-profiler.js',
  'wasm-performance-optimizer.js',
  'performance-optimization-manager.js',
  'vr-extension-loader.js',
  'vr-extension-loader-v2.js',
  'vr-extension-system.js',
  'vr-extension-manager-ui.js',
  'vr-extension-store-3d.js',
  'vr-extension-ai-recommender.js',
  'vr-extension-gesture-control.js',
  'vr-extension-voice-control.js',
  'vr-extension-sync-analytics.js'
];

console.log('📦 Consolidation Plan for Advanced Modules\n');
console.log('========================================\n');

// Display consolidation plan
for (const [targetFile, sourceFiles] of Object.entries(MODULE_CATEGORIES)) {
  console.log(`📁 ${targetFile}`);
  console.log(`   Will consolidate ${sourceFiles.length} files:`);
  sourceFiles.forEach(file => {
    const filePath = path.join('assets/js', file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`   ✓ ${file} (${sizeKB} KB)`);
    } else {
      console.log(`   ✗ ${file} (not found)`);
    }
  });
  console.log('');
}

// Display files to keep
console.log('📌 Files to Keep Separate:');
KEEP_SEPARATE.forEach(file => {
  console.log(`   • ${file}`);
});
console.log('');

// Display files marked for deletion
console.log('🗑️ Files Marked for Deletion (duplicates):');
MARK_FOR_DELETION.forEach(file => {
  const filePath = path.join('assets/js', file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   • ${file} (${sizeKB} KB)`);
  }
});

// Calculate space savings
let totalOriginalSize = 0;
let totalConsolidatedSize = Object.keys(MODULE_CATEGORIES).length * 40; // Estimated 40KB per consolidated file

for (const sourceFiles of Object.values(MODULE_CATEGORIES)) {
  sourceFiles.forEach(file => {
    const filePath = path.join('assets/js', file);
    if (fs.existsSync(filePath)) {
      totalOriginalSize += fs.statSync(filePath).size;
    }
  });
}

MARK_FOR_DELETION.forEach(file => {
  const filePath = path.join('assets/js', file);
  if (fs.existsSync(filePath)) {
    totalOriginalSize += fs.statSync(filePath).size;
  }
});

const savingsKB = ((totalOriginalSize - totalConsolidatedSize * 1024) / 1024).toFixed(2);
const savingsPercent = ((1 - (totalConsolidatedSize * 1024 / totalOriginalSize)) * 100).toFixed(1);

console.log('\n📊 Estimated Space Savings:');
console.log(`   Original: ${(totalOriginalSize / 1024).toFixed(2)} KB`);
console.log(`   After: ${totalConsolidatedSize} KB`);
console.log(`   Savings: ${savingsKB} KB (${savingsPercent}%)`);

console.log('\n📝 Recommendations:');
console.log('1. Create unified modules using the categorization above');
console.log('2. Move duplicated functionality to unified systems');
console.log('3. Implement lazy loading for non-critical modules');
console.log('4. Use dynamic imports for feature-specific code');
console.log('5. Consider using a module bundler (webpack/rollup)');

// Create a cleanup script
const cleanupScript = `#!/bin/bash
# Cleanup script for duplicate and obsolete files

echo "Creating backup directory..."
mkdir -p backup/assets/js

echo "Moving files to backup..."
${MARK_FOR_DELETION.map(file => `mv assets/js/${file} backup/assets/js/ 2>/dev/null`).join('\n')}

echo "Cleanup complete. Files moved to backup directory."
`;

fs.writeFileSync('cleanup-obsolete-files.sh', cleanupScript);
console.log('\n✅ Created cleanup-obsolete-files.sh');

// Create consolidation tracking file
const consolidationPlan = {
  date: new Date().toISOString(),
  categories: MODULE_CATEGORIES,
  keepSeparate: KEEP_SEPARATE,
  markForDeletion: MARK_FOR_DELETION,
  estimatedSavings: {
    originalSizeKB: (totalOriginalSize / 1024).toFixed(2),
    consolidatedSizeKB: totalConsolidatedSize,
    savingsKB: savingsKB,
    savingsPercent: savingsPercent
  }
};

fs.writeFileSync('consolidation-plan.json', JSON.stringify(consolidationPlan, null, 2));
console.log('✅ Created consolidation-plan.json');

console.log('\nNext steps:');
console.log('1. Review consolidation-plan.json');
console.log('2. Run cleanup-obsolete-files.sh to backup duplicate files');
console.log('3. Create unified modules based on the categories');
console.log('4. Update index.html to use new unified modules');
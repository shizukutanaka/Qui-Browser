#!/bin/bash

echo "=== Qui Browser VR - Cleanup Script ==="
echo "Removing duplicate and obsolete files..."

# Create backup directory
mkdir -p backup/js-cleanup
echo "Created backup directory: backup/js-cleanup"

# Phase 1: Remove core folder duplicates
echo ""
echo "Phase 1: Removing core folder duplicates..."
mv assets/js/core/performance-optimizer.js backup/js-cleanup/ 2>/dev/null
mv assets/js/core/security-hardener.js backup/js-cleanup/ 2>/dev/null
mv assets/js/core/error-handler.js backup/js-cleanup/ 2>/dev/null
mv assets/js/core/i18n-manager.js backup/js-cleanup/ 2>/dev/null
mv assets/js/core/vr-webgpu-renderer.js backup/js-cleanup/ 2>/dev/null
mv assets/js/core/webxr-integration.js backup/js-cleanup/ 2>/dev/null
mv assets/js/core/vr-navigation.js backup/js-cleanup/ 2>/dev/null
mv assets/js/core/vr-settings-ui.js backup/js-cleanup/ 2>/dev/null
mv assets/js/core/browser-core.js backup/js-cleanup/ 2>/dev/null

# Phase 2: Remove integrated performance files
echo "Phase 2: Removing integrated performance files..."
mv assets/js/vr-performance-monitor.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-performance-profiler.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-performance-unified.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-performance-monitoring.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-performance-system.js backup/js-cleanup/ 2>/dev/null
mv assets/js/performance-optimization-manager.js backup/js-cleanup/ 2>/dev/null
mv assets/js/wasm-performance-optimizer.js backup/js-cleanup/ 2>/dev/null

# Phase 3: Remove integrated security files
echo "Phase 3: Removing integrated security files..."
mv assets/js/enterprise-security.js backup/js-cleanup/ 2>/dev/null

# Phase 4: Remove integrated error handler files
echo "Phase 4: Removing integrated error handler files..."
mv assets/js/vr-error-handler.js backup/js-cleanup/ 2>/dev/null

# Phase 5: Remove integrated VR extension files
echo "Phase 5: Removing integrated VR extension files..."
mv assets/js/vr-extension-loader.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-extension-loader-v2.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-extension-system.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-extension-manager-ui.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-extension-store-3d.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-extension-ai-recommender.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-extension-gesture-control.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-extension-voice-control.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-extension-sync-analytics.js backup/js-cleanup/ 2>/dev/null

# Phase 6: Remove duplicate accessibility files
echo "Phase 6: Removing duplicate accessibility files..."
mv assets/js/vr-accessibility-system.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-accessibility-enhanced.js backup/js-cleanup/ 2>/dev/null

# Phase 7: Remove duplicate language files
echo "Phase 7: Removing duplicate language files..."
mv assets/js/language-manager.js backup/js-cleanup/ 2>/dev/null

# Phase 8: Remove unused advanced files
echo "Phase 8: Removing unused advanced files..."
mv assets/js/advanced-analytics-reporting.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-backup-restore.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-data-visualization.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-deployment-cicd.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-documentation-enhancement.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-globalization-enhancement.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-input-systems.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-realtime-collaboration.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-testing-qa.js backup/js-cleanup/ 2>/dev/null
mv assets/js/advanced-user-analytics.js backup/js-cleanup/ 2>/dev/null

# Phase 9: Remove unused metaverse/blockchain files
echo "Phase 9: Removing unused metaverse/blockchain files..."
mv assets/js/blockchain-web3-integration.js backup/js-cleanup/ 2>/dev/null
mv assets/js/cloud-synchronization-system.js backup/js-cleanup/ 2>/dev/null
mv assets/js/complete-metaverse-ecosystem.js backup/js-cleanup/ 2>/dev/null
mv assets/js/complete-translation-system.js backup/js-cleanup/ 2>/dev/null
mv assets/js/comprehensive-customer-support.js backup/js-cleanup/ 2>/dev/null
mv assets/js/custom-extension-store.js backup/js-cleanup/ 2>/dev/null
mv assets/js/enhanced-ai-assistant.js backup/js-cleanup/ 2>/dev/null
mv assets/js/enhanced-browser-core.js backup/js-cleanup/ 2>/dev/null
mv assets/js/final-integration-system.js backup/js-cleanup/ 2>/dev/null
mv assets/js/lightweight-extension-system.js backup/js-cleanup/ 2>/dev/null

# Phase 10: Remove unused VR AI files
echo "Phase 10: Removing unused VR AI files..."
mv assets/js/vr-ai-assistant.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-ai-assistant-integration.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-ai-assistant-ui.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-ai-recommender.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-ar-mode.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-avatar-system.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-brain-computer-interface.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-cloud-sync.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-device-support.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-metaverse-integration.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-multiplayer-browsing.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-neural-rendering.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-nlp-processor.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-optimized-ui.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-proactive-learning.js backup/js-cleanup/ 2>/dev/null
mv assets/js/vr-web3-wallet.js backup/js-cleanup/ 2>/dev/null

# Phase 11: Remove other unused files
echo "Phase 11: Removing other unused files..."
mv assets/js/memory-optimizer.js backup/js-cleanup/ 2>/dev/null
mv assets/js/multilingual-voice-system.js backup/js-cleanup/ 2>/dev/null
mv assets/js/offline-functionality.js backup/js-cleanup/ 2>/dev/null
mv assets/js/startup-optimizer.js backup/js-cleanup/ 2>/dev/null
mv assets/js/translation-database.js backup/js-cleanup/ 2>/dev/null

echo ""
echo "=== Cleanup Complete ==="
echo "Files moved to: backup/js-cleanup/"
echo ""

# Count remaining files
REMAINING=$(ls assets/js/*.js 2>/dev/null | wc -l)
echo "Remaining JS files in assets/js: $REMAINING"

# Show unified systems
echo ""
echo "Unified systems preserved:"
ls -la assets/js/unified-*.js 2>/dev/null | awk '{print " - " $9}'

echo ""
echo "Done! Remember to:"
echo "1. Update index.html to remove references to deleted files"
echo "2. Test the application thoroughly"
echo "3. Remove backup folder after confirming everything works"
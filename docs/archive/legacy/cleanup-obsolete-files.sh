#!/bin/bash
# Cleanup script for duplicate and obsolete files

echo "Creating backup directory..."
mkdir -p backup/assets/js

echo "Moving files to backup..."
mv assets/js/advanced-performance-monitoring.js backup/assets/js/ 2>/dev/null
mv assets/js/advanced-performance-system.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-performance-monitor.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-performance-profiler.js backup/assets/js/ 2>/dev/null
mv assets/js/wasm-performance-optimizer.js backup/assets/js/ 2>/dev/null
mv assets/js/performance-optimization-manager.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-extension-loader.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-extension-loader-v2.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-extension-system.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-extension-manager-ui.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-extension-store-3d.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-extension-ai-recommender.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-extension-gesture-control.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-extension-voice-control.js backup/assets/js/ 2>/dev/null
mv assets/js/vr-extension-sync-analytics.js backup/assets/js/ 2>/dev/null

echo "Cleanup complete. Files moved to backup directory."

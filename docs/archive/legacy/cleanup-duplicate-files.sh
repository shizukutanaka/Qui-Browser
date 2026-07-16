#!/bin/bash

# Cleanup script for removing duplicate performance monitoring files
# These files have been unified into unified-performance-system.js

echo "Starting cleanup of duplicate performance monitoring files..."

# Files to remove (functionality now in unified-performance-system.js)
FILES_TO_REMOVE=(
  "assets/js/advanced-performance-monitoring.js"
  "assets/js/advanced-performance-system.js"
  "assets/js/vr-performance-monitor.js"
  "assets/js/vr-performance-profiler.js"
  "assets/js/wasm-performance-optimizer.js"
  "assets/js/performance-optimization-manager.js"
)

# Backup directory
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Move files to backup instead of deleting
for file in "${FILES_TO_REMOVE[@]}"; do
  if [ -f "$file" ]; then
    echo "Moving $file to backup..."
    mv "$file" "$BACKUP_DIR/"
  else
    echo "File not found: $file"
  fi
done

echo "Cleanup complete. Backup saved to: $BACKUP_DIR"
echo ""
echo "Files to keep and update:"
echo "- assets/js/performance-optimizer.js (core functionality)"
echo "- assets/js/vr-performance-unified.js (VR-specific optimizations)"
echo "- assets/js/unified-performance-system.js (NEW - unified system)"
echo ""
echo "Remember to update index.html to use the unified system!"
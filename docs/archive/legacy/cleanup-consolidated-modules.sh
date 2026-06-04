#!/bin/bash

# Cleanup Consolidated VR Modules
# These modules have been consolidated into unified systems

echo "🧹 Removing consolidated VR modules..."
echo "These files are now part of unified systems:"
echo ""

cd "assets/js"

# Files consolidated into VRUISystem
echo "→ VRUISystem consolidation:"
rm -f vr-ergonomic-ui.js && echo "  ✓ Removed vr-ergonomic-ui.js"
rm -f vr-settings-ui.js && echo "  ✓ Removed vr-settings-ui.js"
rm -f vr-text-renderer.js && echo "  ✓ Removed vr-text-renderer.js"
rm -f vr-theme-editor.js && echo "  ✓ Removed vr-theme-editor.js"

# Files consolidated into VRInputSystem
echo ""
echo "→ VRInputSystem consolidation:"
rm -f vr-gesture-controls.js && echo "  ✓ Removed vr-gesture-controls.js"
rm -f vr-gesture-macro.js && echo "  ✓ Removed vr-gesture-macro.js"
rm -f vr-gesture-scroll.js && echo "  ✓ Removed vr-gesture-scroll.js"
rm -f vr-hand-tracking.js && echo "  ✓ Removed vr-hand-tracking.js"
rm -f vr-input-optimizer.js && echo "  ✓ Removed vr-input-optimizer.js"
rm -f vr-keyboard.js && echo "  ✓ Removed vr-keyboard.js"

# Files consolidated into VRNavigationSystem
echo ""
echo "→ VRNavigationSystem consolidation:"
rm -f vr-bookmark-3d.js && echo "  ✓ Removed vr-bookmark-3d.js"
rm -f vr-navigation.js && echo "  ✓ Removed vr-navigation.js"
rm -f vr-spatial-navigation.js && echo "  ✓ Removed vr-spatial-navigation.js"
rm -f vr-tab-manager-3d.js && echo "  ✓ Removed vr-tab-manager-3d.js"

# Files consolidated into VRMediaSystem
echo ""
echo "→ VRMediaSystem consolidation:"
rm -f vr-spatial-audio.js && echo "  ✓ Removed vr-spatial-audio.js"
rm -f vr-spatial-audio-enhanced.js && echo "  ✓ Removed vr-spatial-audio-enhanced.js"
rm -f vr-video-player.js && echo "  ✓ Removed vr-video-player.js"
rm -f vr-webgpu-renderer.js && echo "  ✓ Removed vr-webgpu-renderer.js"

# Files consolidated into VRSystemMonitor
echo ""
echo "→ VRSystemMonitor consolidation:"
rm -f vr-battery-monitor.js && echo "  ✓ Removed vr-battery-monitor.js"
rm -f vr-network-monitor.js && echo "  ✓ Removed vr-network-monitor.js"
rm -f vr-usage-statistics.js && echo "  ✓ Removed vr-usage-statistics.js"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Removed 21 consolidated modules"
echo "Functionality now provided by 5 unified systems:"
echo "  - VRUISystem (vr-ui-system.js)"
echo "  - VRInputSystem (vr-input-system.js)"
echo "  - VRNavigationSystem (vr-navigation-system.js)"
echo "  - VRMediaSystem (vr-media-system.js)"
echo "  - VRSystemMonitor (vr-system-monitor.js)"

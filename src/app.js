/**
 * Qui Browser VR - Main Entry Point
 * Production-ready VR browser with Tier 1 optimizations
 *
 * Version: 2.0.0
 * Philosophy: John Carmack - Simple, necessary, performant
 */

import { VRApp } from './vr/VRApp.js';

// Global app instance
let vrApp = null;
// Interval id for the simple performance overlay, cleared on teardown.
let perfIntervalId = null;

/**
 * Initialize application
 */
async function initializeApp() {
  console.debug('====================================');
  console.debug('Qui Browser VR v2.0.0');
  console.debug('Optimized for Meta Quest 2/3');
  console.debug('====================================');

  // Check WebXR support. The landing page is viewable on any browser, so
  // a missing/unsupported WebXR runtime is logged rather than shown as a
  // blocking error overlay — users who actively click "Enter VR" still get
  // an explanatory message from the button handler in main.js.
  if (!navigator.xr) {
    console.warn('WebXR not supported. VR features disabled; landing page only.');
    return;
  }

  // Check for VR support
  const isVRSupported = await navigator.xr.isSessionSupported('immersive-vr');
  if (!isVRSupported) {
    console.warn('Immersive VR not supported on this device; landing page only.');
    return;
  }

  // Create container
  const container = document.getElementById('app-container');
  if (!container) {
    console.error('App container not found');
    return;
  }

  try {
    // Initialize VR application with all Tier 1 optimizations
    vrApp = new VRApp(container);

    // Setup performance monitoring UI
    setupPerformanceMonitor();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    console.debug('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    showError('Failed to initialize VR application. Check console for details.');
  }
}

/**
 * Setup performance monitoring display
 */
function setupPerformanceMonitor() {
  // Create performance display
  const perfDisplay = document.createElement('div');
  perfDisplay.id = 'performance-monitor';
  perfDisplay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #00ff00;
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    z-index: 1000;
    display: none;
  `;
  document.body.appendChild(perfDisplay);

  // Update performance stats every second. Stored so it can be cleared on
  // dispose/unload instead of running for the page lifetime.
  if (perfIntervalId) clearInterval(perfIntervalId);
  perfIntervalId = setInterval(() => {
    if (vrApp && perfDisplay.style.display === 'block') {
      const stats = vrApp.getPerformanceStats();
      perfDisplay.innerHTML = `
        <div>FPS: ${stats.fps}</div>
        <div>Frame Time: ${stats.frameTime}</div>
        <div>Memory: ${stats.memory}</div>
        <div>Draw Calls: ${stats.drawCalls}</div>
        <div>Triangles: ${stats.triangles.toLocaleString()}</div>
        <div>GPU: ${stats.programs} prog / ${stats.geometries} geo / ${stats.textures} tex</div>
        ${stats.ffrIntensity ? `<div>FFR: ${stats.ffrIntensity}</div>` : ''}
        ${stats.textureMemory ? `<div>Textures: ${stats.textureMemory}</div>` : ''}
        ${stats.pooledObjects ? `<div>Pooled Objects: ${stats.pooledObjects}</div>` : ''}
        ${stats.gcPrevented ? `<div>GC Prevented: ${stats.gcPrevented}</div>` : ''}
      `;
    }
  }, 1000);
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    switch(event.key) {
      case 'p':
      case 'P': {
        // Toggle rich PerformanceMonitor when available, otherwise fall back
        // to the simple overlay.
        if (vrApp && vrApp.perfMonitorUI) {
          vrApp.perfMonitorUI.toggle();
        } else {
          const perfDisplay = document.getElementById('performance-monitor');
          if (perfDisplay) {
            perfDisplay.style.display =
              perfDisplay.style.display === 'none' ? 'block' : 'none';
          }
        }
        break;
      }

      case 'f':
      case 'F':
        // Toggle FFR
        if (vrApp && vrApp.ffrSystem) {
          const enabled = !vrApp.ffrSystem.enabled;
          vrApp.ffrSystem.setEnabled(enabled);
          console.debug(`FFR ${enabled ? 'enabled' : 'disabled'}`);
        }
        break;

      case 'c':
      case 'C':
        // Cycle comfort presets
        if (vrApp && vrApp.comfortSystem) {
          const presets = ['sensitive', 'moderate', 'tolerant', 'off'];
          const current = vrApp.settings.motionSensitivity;
          const nextIndex = (presets.indexOf(current) + 1) % presets.length;
          const next = presets[nextIndex];
          vrApp.comfortSystem.setPreset(next);
          vrApp.updateSetting('motionSensitivity', next); // persist across reloads
          console.debug(`Comfort preset: ${next}`);
        }
        break;

      case 'Escape':
        // Emergency cleanup
        if (vrApp) {
          vrApp.dispose();
          vrApp = null;
          if (perfIntervalId) { clearInterval(perfIntervalId); perfIntervalId = null; }
          console.debug('Application disposed');
        }
        break;
    }
  });

  console.debug('Keyboard shortcuts:');
  console.debug('  P - Toggle performance monitor');
  console.debug('  F - Toggle Fixed Foveated Rendering');
  console.debug('  C - Cycle comfort presets');
  console.debug('  ESC - Emergency cleanup');
}

/**
 * Show error message
 */
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #ff0000;
    color: white;
    padding: 20px;
    border-radius: 10px;
    font-family: sans-serif;
    z-index: 2000;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
}

/**
 * Handle page visibility changes
 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && vrApp) {
    // Pause or reduce activity when page is hidden
    console.debug('Page hidden - reducing activity');
  } else if (vrApp) {
    // Resume when page is visible
    console.debug('Page visible - resuming activity');
  }
});

/**
 * Handle page unload
 */
window.addEventListener('beforeunload', () => {
  if (vrApp) {
    vrApp.dispose();
    vrApp = null;
  }
  if (perfIntervalId) { clearInterval(perfIntervalId); perfIntervalId = null; }
});

/**
 * Start application when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Export for debugging
window.QuiBrowser = {
  getApp: () => vrApp,
  getStats: () => vrApp ? vrApp.getPerformanceStats() : null,
  version: '2.0.0'
};
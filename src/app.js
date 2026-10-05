/**
 * Qui Browser VR - Main Entry Point
 * Production-ready VR browser with Tier 1 optimizations
 *
 * Version: 2.0.0
 * Philosophy: John Carmack - Simple, necessary, performant
 */

import { VRApp } from './vr/VRApp.js';
import { t } from './i18n/i18n.js';

// Global app instance
let vrApp = null;

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

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    console.debug('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    showError(t('app.error.initFailed'));
  }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'p':
      case 'P': {
        // Lazily construct the rich PerformanceMonitor dashboard on first
        // press, then toggle it.
        if (vrApp) {
          vrApp.togglePerfMonitor();
        }
        break;
      }

      case 'f':
      case 'F':
        // Toggle FFR
        if (vrApp && vrApp.ffrSystem) {
          const enabling = !vrApp.ffrSystem.enabled;
          enabling ? vrApp.ffrSystem.enable(0.5) : vrApp.ffrSystem.disable();
          console.debug(`FFR ${enabling ? 'enabled' : 'disabled'}`);
        }
        break;

      case 'c':
      case 'C':
        // Cycle comfort presets
        if (vrApp && vrApp.comfortSystem) {
          const presets = ['sensitive', 'moderate', 'tolerant', 'disabled'];
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
 * Handle page unload
 */
window.addEventListener('beforeunload', () => {
  if (vrApp) {
    vrApp.dispose();
    vrApp = null;
  }
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
  getStats: () => (vrApp ? vrApp.getPerformanceStats() : null),
  version: '2.0.0'
};

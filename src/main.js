/**
 * Qui Browser VR v2.0.0 - Main Entry Point
 * Production-ready VR browser application
 */

import { initializeMonitoring } from './monitoring.js';
import { applyTranslations, setLanguage, getLanguage } from './i18n/i18n.js';
import { applyAccessibility, togglePref, getPrefs } from './a11y/accessibility.js';

// Apply accessibility preferences (high-contrast / large-text / reduced-motion)
// as early as possible, then wire the toggle buttons.
applyAccessibility();
{
  const wire = (id, key) => {
    const btn = document.getElementById(id);
    if (!btn) {
      return;
    }
    btn.setAttribute('aria-pressed', String(!!getPrefs()[key]));
    btn.addEventListener('click', () => {
      const on = togglePref(key);
      btn.setAttribute('aria-pressed', String(on));
    });
  };
  wire('a11yContrast', 'highContrast');
  wire('a11yText', 'largeText');
}

// Localize the landing page as early as possible (module scripts run after the
// DOM is parsed), then wire the language toggle.
applyTranslations(document);
{
  const langBtn = document.getElementById('langToggle');
  if (langBtn) {
    const sync = () => {
      langBtn.textContent = getLanguage() === 'ja' ? 'EN' : '日本語';
    };
    sync();
    langBtn.addEventListener('click', () => {
      setLanguage(getLanguage() === 'ja' ? 'en' : 'ja', document);
      sync();
    });
  }
}

// Initialize observability in production builds only. web-vitals is bundled
// and runs out of the box; Sentry/analytics are opt-in (see vite.config.js)
// and degrade gracefully via try/catch when not installed/configured.
if (import.meta.env && import.meta.env.PROD) {
  initializeMonitoring().catch((e) => console.error('Monitoring init failed:', e));
}

// Catch async errors that escape their call-sites (e.g. failed fetch in a
// click handler) so they surface as console errors rather than silent drops.
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Hide loading screen after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
  }, 500);
});

// Import main application
import('./app.js').then(_module => {
  console.debug('Qui Browser VR v2.0.0 loaded successfully');

  // Check WebXR support
  if ('xr' in navigator) {
    navigator.xr.isSessionSupported('immersive-vr').then(supported => {
      if (supported) {
        const vrButton = document.getElementById('vrFloatingButton');
        if (vrButton) {
          vrButton.style.display = 'flex';
        }

        // FR-10.2: PWA immediate immersion.
        // When launched from the home screen (standalone mode) on a
        // device that supports VR, fire enter-vr automatically so the
        // user enters the experience without a manual click.  Quest
        // Browser treats the PWA launch as a user-gesture context, so
        // requestSession is permitted.  If the browser rejects it
        // (SecurityError on desktop) the user can still press the
        // button — this is a best-effort optimisation.
        const isStandalone =
                    window.matchMedia('(display-mode: standalone)').matches ||
                    window.navigator.standalone === true; // iOS Safari
        if (isStandalone) {
          console.debug('PWA standalone launch detected — auto-entering VR');
          // Small delay so VRApp finishes registering its enter-vr
          // listener before we fire the event.
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('enter-vr'));
          }, 200);
        }
      }
    });
  }
}).catch(error => {
  console.error('Failed to load application:', error);
  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    // Build the error UI with the DOM API so the (untrusted) error message
    // is inserted as text, never parsed as HTML (avoids XSS).
    const box = document.createElement('div');
    box.style.color = '#de350b';

    const heading = document.createElement('h2');
    heading.textContent = 'Failed to load application';

    const detail = document.createElement('p');
    detail.style.color = '#a0a0b8';
    detail.textContent = (error && error.message) ? String(error.message) : 'Unknown error';

    const reload = document.createElement('button');
    reload.textContent = 'Reload';
    reload.style.cssText = 'margin-top: 1rem; padding: 0.5rem 1rem; background: #0052cc; color: white; border: none; border-radius: 4px; cursor: pointer;';
    reload.addEventListener('click', () => location.reload());

    box.append(heading, detail, reload);
    loadingScreen.replaceChildren(box);
  }
});

// Show a non-blocking error message near the VR entry button (avoids alert()).
function showVRError(anchor, message) {
  const existing = document.getElementById('vr-error-toast');
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'vr-error-toast';
  toast.setAttribute('role', 'alert');
  toast.style.cssText = [
    'position:fixed', 'bottom:2rem', 'left:50%', 'transform:translateX(-50%)',
    'background:#1e1e2e', 'color:#f87171', 'padding:0.75rem 1.25rem',
    'border-radius:0.5rem', 'border:1px solid #f87171', 'font-size:0.9rem',
    'z-index:9999', 'max-width:90vw', 'text-align:center'
  ].join(';');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

// VR button handlers
document.addEventListener('DOMContentLoaded', () => {
  const enterVRButton = document.getElementById('enterVRButton');
  const vrFloatingButton = document.getElementById('vrFloatingButton');

  if (enterVRButton) {
    enterVRButton.addEventListener('click', async () => {
      try {
        if ('xr' in navigator) {
          const supported = await navigator.xr.isSessionSupported('immersive-vr');
          if (supported) {
            // VRApp will handle session creation
            window.dispatchEvent(new CustomEvent('enter-vr'));
          } else {
            showVRError(enterVRButton, 'WebXR VR is not supported on this device. Please use a VR headset.');
          }
        } else {
          showVRError(enterVRButton, 'WebXR is not available. Please use a WebXR-compatible browser.');
        }
      } catch (error) {
        console.error('Error entering VR:', error);
        showVRError(enterVRButton, 'Failed to enter VR mode. Check the browser console for details.');
      }
    });
  }

  if (vrFloatingButton) {
    vrFloatingButton.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('enter-vr'));
    });
  }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.debug('Service Worker registered:', registration);
        // Periodically check for updates so long-lived sessions
        // pick up new releases without a manual reload.
        setInterval(() => registration.update(), 60000);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Build Info
console.debug(`
╔══════════════════════════════════════════════════════════════╗
║                   Qui Browser VR v2.0.0                      ║
║                                                              ║
║  WebXR browser with 17 features (Tier 1-3)                   ║
║  • Japanese IME, Hand Tracking, Spatial Audio                ║
║  • Comfort system, KTX2 textures, Service Worker             ║
║  • Experimental: WebGPU, Multiplayer, AI                     ║
║                                                              ║
║  GitHub: github.com/shizukutanaka/qui-browser               ║
║  Docs: github.com/shizukutanaka/qui-browser/tree/main/docs  ║
║  License: MIT                                                ║
╚══════════════════════════════════════════════════════════════╝
`);

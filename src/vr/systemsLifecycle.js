/**
 * Subsystem construction (initializeSystems) and teardown (dispose).
 *
 * Extracted from VRApp — `app` is the VRApp instance. Construction is the
 * exact original order; subsystem deps are read/written on `app.*` so lazy
 * getters (captionSystem etc. via a11y coordinator) keep working.
 */

import * as THREE from 'three';
import { FFRSystem } from './rendering/FFRSystem.js';
import { ComfortSystem } from './comfort/ComfortSystem.js';
import { JapaneseIME, VRJapaneseKeyboard } from './input/JapaneseIME.js';
import { HandTracking } from './interaction/HandTracking.js';
import { HapticFeedback } from './interaction/HapticFeedback.js';
import { GazeInteraction } from './interaction/GazeInteraction.js';
import { CaptionSystem } from './accessibility/CaptionSystem.js';
import { SemanticDOM } from './accessibility/SemanticDOM.js';
import { SpatialAudio } from './audio/SpatialAudio.js';
import { WindowManager } from './browser/WindowManager.js';
import { ImmersiveVideo } from './media/ImmersiveVideo.js';
import { disposeMonitoring } from '../monitoring.js';
import { osReducedMotion, getPrefs, largeTextScale, prefersHighContrast } from '../a11y/accessibility.js';
import { t } from '../i18n/i18n.js';
import { showCaption } from './caption.js';

export async function initializeSystems(app) {
  const startTime = performance.now();

  // NFR-2: probe device capabilities first so downstream systems can
  // respect what the runtime actually supports.
  const compat = await app.deviceCompat.check();
  // Override targetFPS from device detection if not already user-specified.
  if (!app.settings._fpsOverridden) {
    app.settings.targetFPS = app.deviceCompat.targetFPS();
  }
  console.debug(`VRApp: Device tier=${compat.deviceTier}, targetFPS=${app.settings.targetFPS}`);

  // === TIER 1 SYSTEMS ===

  // 1. Fixed Foveated Rendering
  if (app.settings.enableFFR) {
    try {
      app.ffrSystem = new FFRSystem();
      console.debug('VRApp: FFR system ready');
    } catch (e) {
      console.error('VRApp: FFR init failed', e);
      app.showVRToast(t('vr.error.foveationUnavailable'), { type: 'warn' });
    }
  }

  // 2. Comfort System
  if (app.settings.enableComfort) {
    app.comfortSystem = new ComfortSystem(
      app.camera,
      app.renderer,
      { reduceMotion: osReducedMotion() }
    );
    app.comfortSystem.setPreset(app.settings.motionSensitivity);
    console.debug('VRApp: Comfort system initialized');
  }

  // === TIER 2 SYSTEMS ===

  // 5. Japanese IME — pass interactable hooks so the 3D keyboard keys can be
  // selected with a controller ray.
  app.japaneseIME = new JapaneseIME();
  app.vrKeyboard = new VRJapaneseKeyboard(app.scene, app.japaneseIME, {
    registerInteractable: (m, h) => app.registerInteractable(m, h),
    unregisterInteractable: (m) => app.unregisterInteractable(m),
    // Larger keys (bigger targets) for the large-text accessibility preference.
    scale: largeTextScale(getPrefs().largeText),
    onHoverCaption: (label) => {
      if (app.settings.enableGazeDwell) {
        showCaption(app, label);
      }
    },
    onCancel: () => {
      showCaption(app, t('vr.msg.keyboardCancelled'));
    },
    // Frecency-ranked history/bookmark suggestions while typing (gaze-dwell
    // typing is ~8-10 WPM, so jumping to a known destination after a couple
    // of characters is the single biggest text-entry speedup available).
    suggestionProvider: (query) => app.bookmarks.search(query, 4, Date.now())
  });
  console.debug('VRApp: Japanese IME ready');

  // 6. Hand Tracking
  app.handTracking = new HandTracking(app.scene);
  // WCAG 4.1.3: announce hand-tracking state changes so users who rely on
  // hand input know when it becomes unavailable. Brief flickers are common,
  // so each hand's announcement is debounced: only fire if the state holds
  // for 600 ms, preventing a storm of "lost"/"regained" captions.
  // Tracked on `this` (not a closure-local) so dispose() can clear a pending
  // timer — otherwise a flicker just before teardown fires this callback
  // 600 ms later against a disposed captionSystem (same teardown-leak class
  // as the toast auto-dismiss timers and the TTS utterance).
  app._handTrackingTimers = {};
  app.handTracking.onTrackingChange((hand, tracked) => {
    clearTimeout(app._handTrackingTimers[hand]);
    app._handTrackingTimers[hand] = setTimeout(() => {
      // Four explicit keys rather than composing "<hand> hand <state>":
      // word order and particles differ by language, so composition would
      // produce broken Japanese.
      showCaption(app, t(
        hand === 'left'
          ? (tracked ? 'vr.msg.leftHandTracked' : 'vr.msg.leftHandLost')
          : (tracked ? 'vr.msg.rightHandTracked' : 'vr.msg.rightHandLost')
      ));
    }, 600);
  });
  console.debug('VRApp: Hand tracking ready');

  // 6a. Haptic Feedback — wired to hand-tracking gesture callbacks in
  // onVRSessionStart() once a session and gamepads are available.
  try {
    app.hapticFeedback = new HapticFeedback();
    // Honour the persisted haptics preference so a user who turned haptics
    // off keeps that from startup, not just after re-toggling it live.
    app.hapticFeedback.setEnabled(app.settings.enableHaptics !== false);
    console.debug('VRApp: Haptic feedback ready');
  } catch (e) {
    console.error('VRApp: Haptic feedback init failed', e);
    app.showVRToast(t('vr.error.hapticUnavailable'), { type: 'warn' });
    // Set to null so notifyCrossModal() skips haptic gracefully
    app.hapticFeedback = null;
  }

  // 6b. Gaze-dwell interaction (FR-13.1, accessibility). Created always so it
  // can be toggled live from the settings panel; only active when enabled.
  app.gazeInteraction = new GazeInteraction(app.camera, {
    dwellTime: app.settings.gazeDwellTime,
    graceTime: app.settings.gazeGraceTime,
    // Honour the OS reduced-motion preference: static activation cue, no fade.
    reduceMotion: osReducedMotion(),
    // Honour high-contrast: full-opacity ring for visibility (WCAG 1.4.11).
    highContrast: prefersHighContrast()
  });
  app.gazeInteraction.setEnabled(app.settings.enableGazeDwell);
  console.debug('VRApp: Gaze-dwell interaction ready');

  // 6c. Semantic DOM overlay (2D / screen-reader accessibility, Phase 2).
  // A hidden ARIA-live region mirroring captions/toasts/settings state for
  // consumers outside the WebGL render (Quest dom-overlay accessibility
  // services, or assistive tech inspecting the page). Purely a redundant
  // announcement surface, so a failure here is console-only, not toast-worthy.
  try {
    app.semanticDOM = new SemanticDOM();
    console.debug('VRApp: Semantic DOM overlay ready');
  } catch (e) {
    console.error('VRApp: Semantic DOM overlay init failed', e);
    app.semanticDOM = null;
  }

  // 6d. In-VR captions (FR-13.1, accessibility). Created always so it can be
  // toggled live; only renders when enabled and lines are present.
  // Honour the user's accessibility preferences so low-vision users get
  // bigger, higher-contrast captions (reuses the same signals as the 2D layer).
  app.captionSystem = new CaptionSystem(app.camera, {
    scale: app.settings.captionScale,
    highContrast: prefersHighContrast(),
    lineDuration: app.settings.captionDuration * 1000,
    verticalOffset: app.settings.captionHeight,
    onShow: (text) => app.semanticDOM?.announceCaption(text)
  });
  app.captionSystem.setEnabled(app.settings.enableCaptions);
  console.debug('VRApp: Caption system ready');

  // 6e. Live-subscribe to OS accessibility signal changes (WCAG 2.3.3 /
  // 1.4.11). osReducedMotion()/prefersHighContrast() were otherwise only
  // read once, at each subsystem's construction above — an OS-level
  // preference toggled after the page has already loaded (e.g. from the
  // headset's system Quick Settings, without reloading the tab) would
  // never reach comfortSystem/gazeInteraction/captionSystem for the rest
  // of the page's lifetime, including across VR session enter/exit.
  setupOSAccessibilityListeners(app);

  // 7. Spatial Audio
  try {
    app.spatialAudio = new SpatialAudio();
    // Apply the persisted master-volume preference at startup so a user who
    // lowered/muted audio keeps that on the next load (not just live).
    app.spatialAudio.setMasterVolume((app.settings.masterVolume ?? 100) / 100);
    await loadAudioAssets(app);
    console.debug('VRApp: Spatial audio initialized');
  } catch (e) {
    console.error('VRApp: Spatial audio init failed', e);
    app.showVRToast(t('vr.error.spatialAudioUnavailable'), { type: 'warn' });
  }

  // 12. DevTools (development builds only; hidden until toggled with F12).
  // Dynamically imported so it is dropped from production bundles.
  if (import.meta.env.DEV) {
    const { DevTools } = await import('../dev/DevTools.js');
    app.devTools = new DevTools(this);
    app.devTools.initialize();
    console.debug('VRApp: DevTools ready (F12 to toggle)');
  }

  const loadTime = performance.now() - startTime;
  console.debug(`VRApp: All systems initialized in ${loadTime.toFixed(1)}ms`);
}

export function dispose(app) {
  console.debug('VRApp: Disposing...');

  // Stop render loop
  app.renderer.setAnimationLoop(null);

  // Remove WebGL context-loss listeners so a late event after teardown
  // doesn't fire a notification or try to restart the loop on a freed
  // renderer. Guard each side: setupRenderer() may not have run in a test.
  if (app.renderer && app.renderer.domElement) {
    if (app._onWebGLContextLost) {
      app.renderer.domElement.removeEventListener('webglcontextlost', app._onWebGLContextLost);
    }
    if (app._onWebGLContextRestored) {
      app.renderer.domElement.removeEventListener('webglcontextrestored', app._onWebGLContextRestored);
    }
  }
  app._onWebGLContextLost = null;
  app._onWebGLContextRestored = null;
  app._renderBound = null;

  // Detach the window resize listener and drop any pending trailing-edge
  // call so the debounced callback can't fire on a freed renderer.
  if (app._onWindowResize) {
    window.removeEventListener('resize', app._onWindowResize);
    if (typeof app._onWindowResize.cancel === 'function') {
      app._onWindowResize.cancel();
    }
    app._onWindowResize = null;
  }

  // Detach the OS accessibility signal (matchMedia) listeners so a change
  // after teardown doesn't touch already-disposed subsystems.
  if (app._osMotionMQ && app._onOSReducedMotionChange) {
    app._osMotionMQ.removeEventListener('change', app._onOSReducedMotionChange);
  }
  if (app._osContrastMQ && app._onOSContrastChange) {
    app._osContrastMQ.removeEventListener('change', app._onOSContrastChange);
  }
  if (app._osForcedColorsMQ && app._onOSContrastChange) {
    app._osForcedColorsMQ.removeEventListener('change', app._onOSContrastChange);
  }
  app._osMotionMQ = null;
  app._osContrastMQ = null;
  app._osForcedColorsMQ = null;
  app._onOSReducedMotionChange = null;
  app._onOSContrastChange = null;

  // Clear pending toast auto-dismiss timers so their callbacks don't fire
  // against a torn-down VRApp (app.camera nulled, GPU resources already
  // freed below). Without this the timer holds a closure over `this` and
  // surfaces as a console error or a test-leak warning after teardown.
  if (app._toastTimers) {
    app._toastTimers.forEach((t) => clearTimeout(t));
    app._toastTimers.clear();
  }

  // Clear pending hand-tracking debounce timers for the same reason: a hand
  // flicker just before teardown would otherwise fire its "hand lost/tracked"
  // caption 600 ms later against a disposed captionSystem.
  if (app._handTrackingTimers) {
    Object.values(app._handTrackingTimers).forEach((t) => clearTimeout(t));
    app._handTrackingTimers = {};
  }

  // Remove global listeners and DOM nodes added during setup
  if (app.onEnterVRRequest) {
    window.removeEventListener('enter-vr', app.onEnterVRRequest);
    app.onEnterVRRequest = null;
  }
  if (app.onDocumentVisibilityChange) {
    document.removeEventListener('visibilitychange', app.onDocumentVisibilityChange);
    app.onDocumentVisibilityChange = null;
  }
  if (app.vrButton && app.vrButton.parentNode) {
    app.vrButton.parentNode.removeChild(app.vrButton);
  }

  // Dispose systems
  if (app.comfortSystem) {
    app.comfortSystem.dispose();
  }
  if (app.ffrSystem) {
    app.ffrSystem.dispose();
  }
  if (app.vrKeyboard) {
    app.vrKeyboard.dispose(); app.vrKeyboard = null;
  } else if (app.japaneseIME) {
    app.japaneseIME.dispose(); app.japaneseIME = null;
  }
  if (app.handTracking) {
    app.handTracking.dispose();
  }
  if (app.hapticFeedback) {
    app.hapticFeedback.enabled = false; app.hapticFeedback = null;
  }
  if (app.gazeInteraction) {
    app.gazeInteraction.dispose();
  }
  if (app.captionSystem) {
    app.captionSystem.dispose();
  }
  if (app.semanticDOM) {
    app.semanticDOM.dispose();
  }
  if (app.spatialAudio) {
    app.spatialAudio.dispose();
  }
  if (app.windowManager) {
    app.windowManager.dispose();
  }
  if (app.layersSystem) {
    app.layersSystem.dispose(); app.layersSystem = null;
  }
  if (app.bookmarkPanel) {
    app.bookmarkPanel.dispose(); app.bookmarkPanel = null;
  }
  if (app.immersiveVideo) {
    app.immersiveVideo.dispose(); app.immersiveVideo = null;
  }
  if (app.tabManager) {
    app.tabManager.dispose();
  } else if (app.webPanel) {
    app.webPanel.dispose();
  }
  if (app.devTools) {
    app.devTools.dispose();
  }
  if (app._homePanelTexture) {
    app._homePanelTexture.dispose();
  }
  if (app._panelTextures) {
    app._panelTextures.forEach((t) => t.dispose());
  }
  // Dispose the shared button geometries once. The scene.traverse below would
  // also reach them via the button meshes, but disposing here keeps the cache
  // authoritative and BufferGeometry.dispose() is idempotent.
  if (app._sharedGeometries) {
    app._sharedGeometries.forEach((g) => g.dispose());
    app._sharedGeometries.clear();
  }

  // Dispose Three.js
  app.renderer.dispose();
  app.scene.traverse(object => {
    if (object.geometry) {
      object.geometry.dispose();
    }
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(m => m.dispose());
      } else {
        object.material.dispose();
      }
    }
  });

  // Tear down monitoring side-effects (intervals + event listeners).
  // Called last so any final metrics can still be reported above.
  try {
    disposeMonitoring();
  } catch (_) { /* best-effort teardown; ignore */ }

  console.debug('VRApp: Disposed');
}


export function setupOSAccessibilityListeners(app) {
  if (typeof matchMedia === 'undefined') {
    return;
  }

  app._osMotionMQ = matchMedia('(prefers-reduced-motion: reduce)');
  app._onOSReducedMotionChange = (e) => {
    if (app.comfortSystem) {
      app.comfortSystem.setReducedMotion(e.matches);
    }
    if (app.gazeInteraction) {
      app.gazeInteraction.setReducedMotion(e.matches);
    }
  };
  app._osMotionMQ.addEventListener('change', app._onOSReducedMotionChange);

  // osHighContrast() ORs prefers-contrast and forced-colors, so either query
  // changing can flip the effective decision; both share the same handler.
  app._osContrastMQ = matchMedia('(prefers-contrast: more)');
  app._osForcedColorsMQ = matchMedia('(forced-colors: active)');
  app._onOSContrastChange = () => {
    const hc = prefersHighContrast();
    if (app.gazeInteraction) {
      app.gazeInteraction.setHighContrast(hc);
    }
    if (app.captionSystem) {
      app.captionSystem.setHighContrast(hc);
    }
  };
  app._osContrastMQ.addEventListener('change', app._onOSContrastChange);
  app._osForcedColorsMQ.addEventListener('change', app._onOSContrastChange);
}

async function loadAudioAssets(app) {
  if (!app.spatialAudio) {
    return;
  }

  const PROCEDURAL = {
    click:   { freq: 880, duration: 0.06, decay: 45 },
    hover:   { freq: 620, duration: 0.045, decay: 60, gain: 0.5 },
    success: { freq: 520, endFreq: 784, duration: 0.14, decay: 12 },
    error:   { freq: 200, duration: 0.16, decay: 10 }
  };

  for (const [name, cfg] of Object.entries(PROCEDURAL)) {
    app.spatialAudio.registerProceduralBuffer(name, cfg);
    if (!app.spatialAudio.sources.has(name)) {
      app.spatialAudio.createSource(name, { volume: 0.6 });
    }
  }
}

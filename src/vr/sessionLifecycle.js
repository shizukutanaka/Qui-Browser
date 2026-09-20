/**
 * WebXR session lifecycle: per-session enable/disable of FFR, WebXR Layers,
 * hand tracking and immersive video, plus visibility-change handling.
 *
 * Extracted from VRApp — `app` is the VRApp instance; all subsystems are read
 * lazily at event time (they are constructed in initializeSystems(), which
 * runs before any session can start).
 */

import { LayersSystem } from './rendering/LayersSystem.js';
import { t } from '../i18n/i18n.js';

export async function onVRSessionStart(app) {
  console.debug('VRApp: VR session started');
  app.isVREnabled = true;

  // Get XR session
  const session = app.renderer.xr.getSession();

  // Headset removed / system menu shown / session blurred: the DOM
  // 'visibilitychange' wired in setupVR() does NOT fire for this while an
  // immersive session is presenting — XRSession.visibilityState
  // ('hidden' | 'visible-blurred') is the authoritative signal. Pause the
  // immersive video so audio doesn't keep playing to an empty headset.
  if (session) {
    app.onXRVisibilityChange = () => {
      if (session.visibilityState !== 'visible'
            && app.immersiveVideo && app.immersiveVideo.playing) {
        app.immersiveVideo.togglePause();
      }
    };
    session.addEventListener('visibilitychange', app.onXRVisibilityChange);
  }

  // Initialize FFR for this session
  const gl = app.renderer.getContext();
  if (app.ffrSystem && session) {
    try {
      await app.ffrSystem.initialize(session, gl);
      app.ffrSystem.enable(0.5);
      console.debug('VRApp: FFR enabled for session');
    } catch (e) {
      console.error('VRApp: FFR session init failed', e);
      app.showVRToast(t('vr.error.foveationUnavailable'), { type: 'warn' });
      app.ffrSystem = null;
    }
  }

  // FR-1.5: WebXR Layers for sharp browser-panel text.
  // Initialise the binding and, if supported, attach a quad layer to every
  // open WebPanel so the chrome bar renders at native display resolution.
  if (app.settings.enableWebPanel && session) {
    try {
      app.layersSystem = new LayersSystem();
      const layersOk = app.layersSystem.initialize(session, gl);
      if (layersOk) {
        app._attachLayersToPanels(session);
      }
    } catch (e) {
      console.error('VRApp: WebXR Layers init failed', e);
      app.showVRToast(t('vr.error.layersUnavailable'), { type: 'warn' });
      app.layersSystem = null;
    }
  }

  // Update comfort system FOV baseline for VR (reset to device-appropriate value).
  if (app.comfortSystem) {
    app.comfortSystem.settings.fov.baseFOV = 90;
  }

  // Initialize hand tracking
  if (app.handTracking && session) {
    await app.handTracking.initialize(session);

    // Register gesture callbacks
    app.handTracking.onGesture('pinch', (hand, _gesture) => {
      console.debug(`${hand} hand pinch detected`);
      // Play spatial sound at pinch position
      if (app.spatialAudio) {
        const pos = app.handTracking.getPinchPosition(hand);
        if (pos) {
          app.spatialAudio.play('click', 'click', pos);
        }
      }
      // Haptic confirmation on pinch (lightweight click feel).
      if (app.hapticFeedback) {
        app.hapticFeedback.playPattern(hand, 'click');
      }
    });

    app.handTracking.onGesture('grab', (hand) => {
      if (app.hapticFeedback) {
        app.hapticFeedback.playPattern(hand, 'impact');
      }
    });

    app.handTracking.onGesture('point', (hand, _gesture) => {
      console.debug(`${hand} hand pointing`);
    });
  }

  // Adjust render settings for VR
  app.renderer.setPixelRatio(1); // Don't use device pixel ratio in VR

  // WCAG 4.1.3: announce that the VR environment is ready so caption-reliant
  // users know the session started without relying on the visual transition.
  if (app.captionSystem && app.captionSystem.enabled) {
    app.captionSystem.show(t('vr.msg.vrReady'));
  }
}

export function onVRSessionEnd(app) {
  console.debug('VRApp: VR session ended');
  app.isVREnabled = false;

  // Disable FFR
  if (app.ffrSystem) {
    app.ffrSystem.disable();
  }

  // Restore desktop FOV baseline when leaving VR.
  if (app.comfortSystem) {
    app.comfortSystem.settings.fov.baseFOV = app.camera.fov || 90;
  }

  // FR-1.5: detach layers from panels and dispose binding.
  if (app.layersSystem) {
    const panels = app.tabManager
      ? app.tabManager.tabs
      : (app.webPanel ? [app.webPanel] : []);
    for (const panel of panels) {
      // false: don't re-commit render state per panel — dispose() below
      // clears the whole stack, and updateRenderState() on an ending
      // session throws.
      panel.disableLayerMode(false);
    }
    app.layersSystem.dispose();
    app.layersSystem = null;
  }

  // The immersive video only makes sense inside the session; tear it down with
  // it so audio/GPU/sphere don't outlive the context that justified them.
  if (app.immersiveVideo) {
    app.immersiveVideo.stop();
  }

  // Hand models/joint meshes are session-scoped: initialize() rebuilds them
  // unconditionally on the next onVRSessionStart() without ever removing the
  // previous session's leftHand/rightHand groups from the scene. Without this,
  // every VR re-entry (headset removed, system menu, re-enter) leaks a full
  // set of 50 joint meshes as permanent, frozen "ghost hands".
  if (app.handTracking) {
    app.handTracking.dispose();
  }

  // The XRSession is discarded on end (its visibilitychange listener dies with
  // it); just drop our reference so a stale closure can't be reused.
  app.onXRVisibilityChange = null;

  // Restore render settings
  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}


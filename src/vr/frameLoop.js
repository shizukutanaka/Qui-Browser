import * as THREE from 'three';

/**
 * The frame loop: staged boot (renderer → scene → camera → VR → systems), the
 * per-frame update dispatch, and the renderer callback. Extracted from VRApp.
 */


export async function initialize(app) {
  console.debug('VRApp: Initializing Qui Browser VR v2.0.0');

  // Setup Three.js
  app.setupRenderer();
  app.setupScene();
  app.setupCamera();

  // Setup VR before the (potentially long) async system init so the
  // landing-page "Enter VR" buttons are wired immediately — otherwise an
  // 'enter-vr' event dispatched during initializeSystems() is dropped.
  app.setupVR();

  // Initialize Tier 1 optimizations
  await app.initializeSystems();

  // Note: the service worker is registered once from src/main.js for all
  // device types; VRApp no longer registers it to avoid a duplicate.

  // Start render loop. Cache the bound callback so the WebGL
  // context-restored handler can re-arm it with the same function reference.
  app._renderBound = app.render.bind(app);
  app.renderer.setAnimationLoop(app._renderBound);

  console.debug('VRApp: Initialization complete');
}

export function render(app, timestamp, xrFrame) {
  app.frameCount++;

  // Single frame clock: all systems share one dt (capped at 50 ms so a tab
  // resuming from background doesn't produce an enormous delta).
  const frameStart = performance.now();
  const dt = app._lastRenderTime
    ? Math.min((frameStart - app._lastRenderTime) / 1000, 0.05)
    : 0.016;
  app._lastRenderTime = frameStart;

  // Update systems
  updateSystems(app, timestamp, xrFrame, dt);

  // Render scene
  app.renderer.render(app.scene, app.camera);

  // Track performance
  const frameTime = performance.now() - frameStart;
  app.updatePerformanceMonitor(frameTime);

  // Dynamic quality adjustment (every 60 frames)
  if (app.frameCount % 60 === 0) {
    app.adjustQuality();
  }
}


export function updateSystems(app, timestamp, xrFrame, dt) {
  // Update comfort system (vignette, FOV)
  if (app.comfortSystem && app.settings.enableComfort) {
    app.comfortSystem.update(dt);
  }

  // Update FFR based on performance and predicted gaze (FR-4.2).
  if (app.ffrSystem && app.isVREnabled) {
    // Use the shared frame dt — no per-system timer needed.
    app.ffrSystem.trackHeadPose(app.camera.quaternion, dt);
    app.ffrSystem.updatePredictedGazeFoveation();

    // Also coarse-adjust based on frame-budget pressure.
    const targetFrameTime = 1000 / app.settings.targetFPS;
    if (app.performanceMonitor.frameTime > targetFrameTime) {
      app.ffrSystem.adjustIntensity(0.01);
    } else {
      app.ffrSystem.adjustIntensity(-0.01);
    }
  }

  // Update hand tracking
  if (app.handTracking && xrFrame) {
    const referenceSpace = app.renderer.xr.getReferenceSpace();
    app.handTracking.update(xrFrame, referenceSpace);
  }

  // Refresh gamepad list for haptic routing (safe no-op when no gamepads).
  if (app.hapticFeedback) {
    app.hapticFeedback.update();
  }

  // Update spatial audio listener position
  if (app.spatialAudio) {
    app.spatialAudio.updateListenerFromCamera(app.camera);
  }

  // FR-1.5: per-frame quad-layer canvas blit (only when dirty).
  if (app.layersSystem && app.layersSystem.isSupported && xrFrame) {
    const refSpace = app.renderer.xr.getReferenceSpace();
    const pose = refSpace ? xrFrame.getViewerPose(refSpace) : null;
    const views = pose ? pose.views : [];
    if (views.length > 0) {
      const panels = app.tabManager
        ? app.tabManager.tabs
        : (app.webPanel ? [app.webPanel] : []);
      for (const panel of panels) {
        panel.updateLayer(xrFrame, views);
      }
    }
  }

  // Update locomotion input (snap turn), face-button actions, teleport, and hover.
  app.updateLocomotion(dt);
  app.updateButtonInput();
  app.updateTeleport();
  app.updateHover();

  // FR-13.1: gaze-dwell selection (hands-free). dt is seconds; pass ms.
  if (app.gazeInteraction && app.gazeInteraction.enabled) {
    const activated = app.gazeInteraction.update(app.interactables, dt * 1000);
    if (activated) {
      // Parity with controller/pinch selection: confirm a hands-free gaze
      // activation on the non-visual channels too — a haptic click on any held
      // controller and a spatial click — so it isn't signalled by sight alone.
      if (app.hapticFeedback) {
        app.hapticFeedback.playPatternBothHands('click');
      }
      if (app.spatialAudio) {
        const pos = activated.getWorldPosition(new THREE.Vector3());
        app.spatialAudio.play('click', 'click', pos);
      }
    }
  }

  // FR-13.1: age out in-VR captions.
  if (app.captionSystem && app.captionSystem.enabled) {
    app.captionSystem.update(dt * 1000);
  }

  // Spatial window management: keep the active panel followed/billboarded.
  if (app.windowManager && (app.windowManager.followMode || app.windowManager.isGrabbing)) {
    // The managed target is TabManager's rootGroup, which does not change
    // with the active tab — so this only has to cover the case where the
    // browser window was built after the manager.
    app._attachManagedWindow();
    app.windowManager.update(dt * 1000);
  }

  // Keep the immersive video sphere centred on the head while it plays.
  if (app.immersiveVideo) {
    app.immersiveVideo.update(dt);
  }
}

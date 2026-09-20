/**
 * Initialization stages: renderer construction, scene assembly, camera rig,
 * XR controllers, and VR button/session wiring.
 *
 * Extracted from VRApp — each function takes `app` (the VRApp instance) and
 * stores what it builds on `app.*`; event handlers are saved as `app._onX`
 * fields so dispose() can remove them exactly as before.
 */

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { debounce } from '../utils/debounce.js';
import { VRControllerInput } from './input/VRControllerInput.js';
import { WindowManager } from './browser/WindowManager.js';
import { createHomeEnvironment } from './homeEnvironment.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { ImmersiveVideo } from './media/ImmersiveVideo.js';
import { t } from '../i18n/i18n.js';
import { onTeleportStart } from './interaction/inputRouting.js';
import { onVRSessionStart } from './sessionLifecycle.js';
import { notifyCrossModal, controllerDisconnectMessage, controllerReconnectMessage, webglContextLostMessage, webglContextRestoredMessage } from './accessibility/crossModal.js';

export function setupRenderer(app) {
  app.renderer = new THREE.WebGLRenderer({
    antialias: false,  // Disabled for performance (use FXAA/TAA instead)
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
    stencil: false  // Disabled if not needed
  });

  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  app.renderer.setSize(window.innerWidth, window.innerHeight);
  app.renderer.shadowMap.enabled = false; // Expensive, disable by default
  app.renderer.xr.enabled = true;

  // Optimization: Use logarithmic depth buffer for better precision
  app.renderer.logarithmicDepthBuffer = true;

  app.container.appendChild(app.renderer.domElement);

  // WebGL context loss handling.
  //
  // On Quest the GPU context can be reclaimed when the system menu opens,
  // the headset sleeps, another XR app takes over, or memory pressure forces
  // a reset. Without `preventDefault()` on the lost event, Three.js cannot
  // restore the context — the user sees a frozen / black scene with no
  // explanation. Stopping the animation loop while the context is gone
  // avoids per-frame WebGL errors that would otherwise spam the console.
  //
  // Listeners are stored on `this` so dispose() can remove them, and so
  // setupRenderer() can be re-called safely in tests / hot reload.
  app._onWebGLContextLost = (event) => {
    event.preventDefault(); // critical — without this, restore never fires
    console.warn('VRApp: WebGL context lost; pausing render loop until restored');
    if (app.renderer) {
      app.renderer.setAnimationLoop(null);
    }
    // notifyCrossModal handles missing subsystems gracefully (early in init
    // the captions/haptic may not yet exist).
    notifyCrossModal(app.hapticFeedback, app.captionSystem, webglContextLostMessage(), 'warn');
  };
  app._onWebGLContextRestored = () => {
    console.debug('VRApp: WebGL context restored; resuming render loop');
    if (app.renderer && app._renderBound) {
      app.renderer.setAnimationLoop(app._renderBound);
    }
    notifyCrossModal(app.hapticFeedback, app.captionSystem, webglContextRestoredMessage(), 'info');
  };
  app.renderer.domElement.addEventListener('webglcontextlost',     app._onWebGLContextLost, false);
  app.renderer.domElement.addEventListener('webglcontextrestored', app._onWebGLContextRestored, false);

  // Window resize / DPI change.
  //
  // setSize() and camera.aspect were only set once at construction, so the
  // 2D / desktop preview (before entering VR) stretched on a window resize,
  // an orientation change, or a DPI shift (e.g. dragging across displays).
  // While an immersive XR session is active Three.js drives sizing through
  // the xr binding; outside that, we own it.
  //
  // The handler is debounced (150 ms quiet window) per the JP dev community
  // resize-event guidance — browsers can fire dozens of events per drag,
  // and reallocating the drawing buffer on each one is wasteful. The pending
  // trailing-edge call is dropped on dispose() so it can't fire on a freed
  // renderer.
  app._onWindowResize = debounce(() => {
    // Skip while presenting — WebXR owns the framebuffer size in that mode.
    if (app.renderer.xr && app.renderer.xr.isPresenting) {
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    app.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    app.renderer.setSize(w, h);
    if (app.camera) {
      app.camera.aspect = w / h;
      app.camera.updateProjectionMatrix();
    }
  }, 150);
  window.addEventListener('resize', app._onWindowResize);

  console.debug('VRApp: Renderer initialized');
}

export function setupScene(app) {
  app.scene = new THREE.Scene();
  app.scene.background = new THREE.Color(0x111111); // Dark for battery savings

  // Simple ambient light (cheap)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  app.scene.add(ambientLight);

  // Single directional light (for basic shading)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight.position.set(5, 10, 5);
  app.scene.add(directionalLight);

  // Default home environment so entering VR shows a grounded space (and a
  // static rest frame) rather than an empty void.
  app.homeEnvironment = app.createHomeEnvironment();
  app.scene.add(app.homeEnvironment);

  // Immersive 360°/180° video player. Lightweight until play() is called
  // (no video element or sphere is created up front), so it is always
  // available and launched on demand from the settings panel.
  app.immersiveVideo = new ImmersiveVideo(app.scene, app.camera, app.renderer, {
    registerInteractable: (m, h) => app.registerInteractable(m, h),
    unregisterInteractable: (m) => app.unregisterInteractable(m),
    onError: (msg) => app.showVRToast(msg, { type: 'error' }),
    onPlaybackChange: (state) => {
      // Guard: session-end cleanup calls stop() with isVREnabled=false; those
      // are not user-initiated actions and should not produce status messages.
      if (!app.isVREnabled) {
        return;
      }
      if (app.captionSystem && app.captionSystem.enabled) {
        let label;
        if (state === 'playing') {
          label = t('vr.msg.videoPlaying');
        } else if (state === 'stopped') {
          label = t('vr.msg.videoStopped');
        } else {
          label = t('vr.msg.videoPaused');
        }
        app.captionSystem.show(label);
      }
    },
    onHoverCaption: (label) => {
      if (app.captionSystem?.enabled && app.settings.enableGazeDwell) {
        app.captionSystem.show(label);
      }
    }
  });

  // In-VR settings panel (toggle buttons wired to the persisted settings).
  app.settingsPanel = createSettingsPanel(app);
  app.scene.add(app.settingsPanel);

  // FR-1.1/1.3: in-VR web browsing with tabs (each tab is a WebPanel).
  if (app.settings.enableWebPanel) {
    app._buildBrowsingSystems();
  }

  console.debug('VRApp: Scene created');
}

export function setupCamera(app) {
  app.camera = new THREE.PerspectiveCamera(
    90,  // FOV - will be adjusted by comfort system
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  app.camera.position.set(0, 1.6, 3); // Average eye height

  // Nest the camera in a player rig so the user can be moved/turned as a unit
  // (WebXR positions the headset relative to this rig's transform).
  app.playerRig = new THREE.Group();
  app.playerRig.name = 'playerRig';
  app.playerRig.add(app.camera);
  app.scene.add(app.playerRig);

  // Spatial window management for the in-VR browser panel (head-lock follow,
  // billboard, distance). Attached to the active tab's group when present.
  if (app.settings.enableWebPanel) {
    app.windowManager = new WindowManager(app.camera, {
      distance: app.settings.windowDistance
    });
    app._attachManagedWindow();
    app.windowManager.setFollow(app.settings.enableWindowFollow);
  }
}

export function setupControllers(app) {
  const factory = new XRControllerModelFactory();

  // Profile-aware, dead-zone-filtered controller input.
  app.controllerInput = new VRControllerInput({
    deadZone: app.settings.controllerDeadZone
  });

  // Shared ray line geometry (pointing down -Z from the controller).
  const rayGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);

  for (let i = 0; i < 2; i++) {
    const controller = app.renderer.xr.getController(i);
    const ray = new THREE.Line(
      rayGeometry,
      new THREE.LineBasicMaterial({ color: 0x44aaff })
    );
    ray.name = 'pointerRay';
    ray.scale.z = 5;
    controller.add(ray);
    controller.addEventListener('selectstart', () => app.onControllerSelect(controller, true));
    controller.addEventListener('selectend', () => app.onControllerSelect(controller, false));
    // Keep the live XRInputSource so we can read per-frame gamepad state.
    controller.addEventListener('connected', (e) => {
      // Distinguish initial session-start connect (inputSource undefined) from
      // mid-session reconnect after a disconnect (inputSource was set to null).
      const wasDisconnected = controller.userData.inputSource === null;
      controller.userData.inputSource = e.data;
      const name = app.controllerInput.getDeviceName(e.data);
      console.debug(`VRApp: Controller connected — ${name}`);
      if (wasDisconnected) {
        const hand = e.data?.handedness;
        const msg = controllerReconnectMessage(hand);
        app.showVRToast(msg, { type: 'info' });
      }
    });
    controller.addEventListener('disconnected', () => {
      const hand = controller.userData.inputSource?.handedness;
      const msg = controllerDisconnectMessage(hand);
      app.showVRToast(msg, { type: 'warn' });
      if (controller.userData.inputSource) {
        app.controllerInput.forget(controller.userData.inputSource);
      }
      controller.userData.inputSource = null;
      app._cancelTeleportIfAimedBy(controller);
    });
    app.playerRig.add(controller);
    app.controllers.push(controller);

    // Teleport: squeeze (grip) to aim, release to move.
    controller.addEventListener('squeezestart', () => onTeleportStart(app, controller));
    controller.addEventListener('squeezeend', () => app.onTeleportEnd());

    const grip = app.renderer.xr.getControllerGrip(i);
    grip.add(factory.createControllerModel(grip));
    app.playerRig.add(grip);
    app.controllerGrips.push(grip);
  }

  // Teleport target marker (flat ring on the floor), hidden until aiming.
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.28, 32),
    new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  app.scene.add(marker);
  app.teleport.marker = marker;

  console.debug('VRApp: Controllers ready');
}

export function setupVR(app) {
  // Add VR button to page
  const vrButton = VRButton.createButton(app.renderer);
  document.body.appendChild(vrButton);
  app.vrButton = vrButton;

  // Wire the landing-page "Enter VR" buttons (which dispatch a global
  // 'enter-vr' event) to the WebXR session request. Without this the
  // landing-page buttons dispatch an event that nothing handles.
  app.onEnterVRRequest = () => vrButton.click();
  window.addEventListener('enter-vr', app.onEnterVRRequest);

  // Pause immersive video when the tab/headset is hidden (e.g. headset removed).
  // Pause-only: do not auto-resume on re-show (gesture-gated autoplay is unreliable
  // and a removed headset signals intentional stop; tap HUD Play to continue).
  app.onDocumentVisibilityChange = () => {
    if (document.hidden && app.immersiveVideo && app.immersiveVideo.playing) {
      app.immersiveVideo.togglePause();
    }
  };
  document.addEventListener('visibilitychange', app.onDocumentVisibilityChange);

  // Controllers (ray pointer + rendered models) parented to the player rig.
  setupControllers(app);

  // Listen for VR session events
  app.renderer.xr.addEventListener('sessionstart', () => {
    onVRSessionStart(app);
  });

  app.renderer.xr.addEventListener('sessionend', () => {
    app.onVRSessionEnd();
  });
}


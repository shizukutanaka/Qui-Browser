/**
 * VR Application Main Controller
 * Integrates all Tier 1 optimizations for production-ready performance
 *
 * John Carmack principle: Systems integration is where performance lives or dies
 */

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

// Tier 1 Optimizations
import { FFRSystem } from './rendering/FFRSystem.js';
import { ComfortSystem, resolveComfortPreset, fireTeleportFeedback } from './comfort/ComfortSystem.js';
import { debounce } from '../utils/debounce.js';

// Tier 2 Features
import { JapaneseIME, VRJapaneseKeyboard } from './input/JapaneseIME.js';
import { VRControllerInput } from './input/VRControllerInput.js';
import { HandTracking } from './interaction/HandTracking.js';
import { HapticFeedback } from './interaction/HapticFeedback.js';
import { GazeInteraction } from './interaction/GazeInteraction.js';
import { CaptionSystem } from './accessibility/CaptionSystem.js';
import { AccessibilityCoordinator } from './accessibility/AccessibilityCoordinator.js';
import { SemanticDOM } from './accessibility/SemanticDOM.js';
import { notifyCrossModal, controllerDisconnectMessage, controllerReconnectMessage, webglContextLostMessage, webglContextRestoredMessage } from './accessibility/crossModal.js';
import { osReducedMotion, getPrefs, largeTextScale, prefersHighContrast } from '../a11y/accessibility.js';
import { t } from '../i18n/i18n.js';
import { normalizeProxyUrl, hostnameCaption } from './browser/urlDisplay.js';
import { showVRToast } from './ui/vrToast.js';
import { controllerRay } from './ui/canvasMesh.js';
import { isWorldVisible, updateLocomotion, updateButtonInput, snapTurn, updateTeleport, onControllerSelect } from './interaction/inputRouting.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { SpatialAudio } from './audio/SpatialAudio.js';

import { WindowManager, resolveWindowDistance, firePanelGrabFeedback } from './browser/WindowManager.js';
import { buildBrowsingSystems } from './browser/browsingSystems.js';
import { ImmersiveVideo } from './media/ImmersiveVideo.js';
import { detectVideoFormat } from './media/videoProjection.js';

import { BookmarkStore } from '../utils/BookmarkStore.js';
import { loadPersistedSettings, saveSettings, updateSetting } from '../utils/settingsStore.js';
import { createHomeEnvironment } from './homeEnvironment.js';
import { onVRSessionStart, onVRSessionEnd } from './sessionLifecycle.js';
import { DeviceCompatibility } from '../utils/DeviceCompatibility.js';
import { disposeMonitoring } from '../monitoring.js';
import { settingsButtonCaption, shouldAnnounceSettingsButton } from './settingsStepper.js';


export class VRApp {
  constructor(container) {
    this.container = container || document.body;
    this.isVREnabled = false;
    this.frameCount = 0;

    // Core Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Tier 1 systems
    this.ffrSystem = null;
    this.comfortSystem = null;

    // Tier 2 systems
    this.japaneseIME = null;
    this.vrKeyboard = null;
    this.handTracking = null;
    // captionSystem/hapticFeedback/gazeInteraction are homed on
    // AccessibilityCoordinator (Phase 3 extraction,
    // docs/OUTSTANDING_ISSUES.md item C-1) but exposed via the
    // getters/setters below so every existing call site keeps working
    // unchanged.
    this.a11y = new AccessibilityCoordinator();
    this.spatialAudio = null;

    // Tier 3 systems (opt-in)
    this.webPanel = null;
    this.tabManager = null;
    this.windowManager = null;
    this.bookmarkPanel = null;
    this.devTools = null;
    this.homeEnvironment = null;
    this.layersSystem = null;

    // FR-1.4: persistent bookmarks & history store (localStorage-backed).
    this.bookmarks = new BookmarkStore();

    // NFR-2: device compatibility probe (async; result available after
    // initializeSystems resolves).
    this.deviceCompat = new DeviceCompatibility();

    // Player rig (camera + controllers) — the movable reference for locomotion
    // and the correct parent for snap/teleport turning.
    this.playerRig = null;
    this.controllers = [];
    this.controllerGrips = [];
    this.controllerInput = null; // VRControllerInput instance (created in setupControllers)
    this.floorMesh = null;
    this.teleport = { active: false, controller: null, marker: null, target: null, valid: false };
    this._grabController = null; // controller currently dragging a panel's move bar
    this.interactables = []; // meshes registered with select/hover handlers
    this.settingsPanel = null;
    this.immersiveVideo = null; // 360°/180° video player (created in initializeSystems)
    this._panelTextures = []; // CanvasTextures to dispose on teardown
    // Shared PlaneGeometry instances for settings-panel buttons, keyed by
    // "wxh". Reusing one geometry per size avoids allocating a fresh GPU
    // vertex buffer for every button (a common Three.js memory/perf pitfall —
    // identical geometries should be shared, not duplicated). Disposed once on
    // teardown; BufferGeometry.dispose() is idempotent so the scene.traverse
    // teardown disposing them again is harmless.
    this._sharedGeometries = new Map();
    // Outstanding showVRToast() auto-dismiss timers. Tracked so dispose() can
    // clear them and stop a delayed callback from touching a torn-down VRApp
    // (this.camera nulled, GPU resources already freed). Each timer self-
    // removes from the Set when it fires normally.
    this._toastTimers = new Set();

    // Performance monitoring
    this.performanceMonitor = {
      fps: 90,
      frameTime: 0,
      memoryUsed: 0,
      drawCalls: 0,
      triangles: 0
    };

    // Settings
    this.settings = {
      targetFPS: 90,        // Quest 2 target
      motionSensitivity: 'moderate',
      enableFFR: true,
      enableComfort: true,
      // Teleport locomotion (squeeze/grip to aim, release to move). Needs a
      // floor (provided by the home environment) and controllers.
      enableTeleport: true,
      // Snap turn on the right thumbstick (comfortable rotation in XR).
      enableSnapTurn: true,
      snapTurnAngle: 30, // degrees per snap
      // Smooth (continuous) locomotion on the left thumbstick. OFF by default —
      // it is the main sickness trigger; the comfort vignette engages while it
      // is active. Teleport remains the comfortable default.
      enableSmoothMove: false,
      smoothMoveSpeed: 1.8, // metres/second
      // Controller input options.
      controllerDeadZone: 0.15, // axis dead zone (fraction of full travel)
      southpaw: false,          // swap left/right controller roles for left-handed users
      // FR-13.1: gaze-dwell selection (hands-free accessibility). Look at an
      // interactable for gazeDwellTime ms to activate it. OFF by default.
      enableGazeDwell: false,
      gazeDwellTime: 1500,  // ms — time eyes must rest on target to activate
      // WCAG 2.2.1 Timing Adjustable: users with tremor / nystagmus need a longer
      // forgiveness window; precision users may want a shorter one.  Exposed as a
      // live stepper so the gaze-dwell path is tunable from inside VR.
      gazeGraceTime: 300,   // ms — off-target slip tolerated before dwell resets
      // FR-2.6: controller haptics on interactions (select, teleport, grab,
      // voice, etc.). ON by default, but users with sensory/tactile sensitivity
      // can turn all haptics off from the settings panel (accessibility).
      enableHaptics: true,
      // FR-13.1: in-VR captions/subtitles for recognized speech & system
      // events (accessibility). OFF by default.
      enableCaptions: false,
      // How long (seconds) each caption line stays on screen. WCAG 2.2.1
      // Timing Adjustable: exposed as a stepper in the VR settings panel so
      // slow readers and cognitive-disability users can extend the hold time.
      captionDuration: 5,
      // Text-size multiplier for captions. WCAG 1.4.4 Resize Text: users must
      // be able to resize text up to 200 % without losing content. The default
      // is derived from the OS large-text preference at session start; exposing
      // it as a live stepper lets low-vision users tune it from inside VR.
      captionScale: 1.0,
      // Caption panel height in the camera's local space (metres, negative =
      // below eye level). XAUR requires caption position customization; VR
      // eye-tracking subtitle studies show the comfortable height varies
      // widely per user. Live stepper in the settings panel.
      captionHeight: -0.55,
      // Master spatial-audio volume as a percentage (0 = muted, 100 = full).
      // Wired to SpatialAudio.setMasterVolume via a settings-panel stepper so
      // users can lower or mute audio (audio-sensitivity / preference).
      masterVolume: 100,

      // FR-1.1: in-VR browsing. Default ON as of Session 74 — this is the
      // product's core loop, and every measured reason for the old false
      // default was dismantled deliberately: the reader exists (S61), the
      // failure screen names the cause and the fix (#50), the companion proxy
      // exists (#45) and is settable from inside VR (#54), and this toggle
      // applies live with one tap (#47). First run shows one blank tab with
      // "Enter a URL to navigate" — an honest state, not an error. A user who
      // turns it off keeps that choice (persisted settings win over defaults).
      enableWebPanel: true,
      // Optional companion proxy (proxy/server.js). Empty = direct fetch only,
      // which reaches CORS-enabled origins only — measured: no general site
      // sends Access-Control-Allow-Origin on its HTML. See docs/PROXY.md.
      readerProxyUrl: '',
      // Default search engine for non-URL input in the address bar
      // (key into urlResolver.SEARCH_ENGINES: duckduckgo|google|bing|ecosia).
      searchEngine: 'duckduckgo',
      // Spatial window management (parity with Wolvic/Quest browser): head-lock
      // follow keeps the active panel centred in view. OFF by default.
      enableWindowFollow: false,
      windowDistance: 2.0, // metres
      // Curved-screen mode for the browser content area (Quest-style). OFF.
      enableCurvedPanel: false,
      // Accessibility preferences mirrored here so the in-VR settings panel can
      // read/toggle them.  The a11y module is the authoritative store (it persists
      // separately); these keys are re-synced from it at startup so a change made
      // via the 2D landing page is never shadowed by a stale VRApp persisted copy.
      highContrast: getPrefs().highContrast
    };

    // Merge any persisted user overrides (settings survive reloads).
    const persisted = this.loadPersistedSettings();
    Object.assign(this.settings, persisted);
    // Re-sync the a11y mirror: the a11y module's own storage always wins over the
    // VRApp persisted copy so changes made outside VR (2D landing page) are honoured.
    this.settings.highContrast = getPrefs().highContrast;
    // Seed captionScale from the OS large-text preference when the user has
    // never explicitly set it in VR (persisted value takes precedence).
    if (!persisted.captionScale) {
      this.settings.captionScale = largeTextScale(getPrefs().largeText, 1.4);
    }

    // Accessibility: if the OS signals prefers-reduced-motion and the user has
    // not explicitly chosen a comfort preset, default to the most protective
    // one ('sensitive') rather than 'moderate'. An explicit persisted choice
    // (merged above) always wins.
    this.settings.motionSensitivity = resolveComfortPreset({
      reducedMotion: osReducedMotion(),
      persisted: persisted.motionSensitivity
    });

    // Accessibility: if the OS largeText preference is set and the user has not
    // explicitly chosen a panel distance, move the panel closer (1.2 m instead
    // of 2.0 m). Angular text size = physical_size / distance, so a 40% closer
    // panel gives a 67% angular size gain — the biggest legibility improvement
    // available without changing font sizes. An explicit persisted choice wins.
    this.settings.windowDistance = resolveWindowDistance({
      largeText: getPrefs().largeText,
      persisted: persisted.windowDistance
    });

    this.initialize();
  }

  // captionSystem/hapticFeedback/gazeInteraction now live on this.a11y
  // (AccessibilityCoordinator), but are exposed here as plain-looking
  // properties so every existing read/write call site in this file
  // (construction, settings-panel closures, dispose,
  // notifyCrossModal/fireTeleportFeedback/etc. calls, the per-frame
  // gaze-dwell poll in updateSystems()) keeps working exactly as before
  // the extraction.
  get captionSystem() {
    return this.a11y.captionSystem;
  }
  set captionSystem(value) {
    this.a11y.captionSystem = value;
  }

  get hapticFeedback() {
    return this.a11y.hapticFeedback;
  }
  set hapticFeedback(value) {
    this.a11y.hapticFeedback = value;
  }

  get gazeInteraction() {
    return this.a11y.gazeInteraction;
  }
  set gazeInteraction(value) {
    this.a11y.gazeInteraction = value;
  }

  /**
   * Load persisted settings overrides from localStorage. Returns {} when none
   * exist or storage is unavailable. Only known keys are accepted so stale or
   * malformed entries cannot inject arbitrary fields.
   */
  loadPersistedSettings() {
    return loadPersistedSettings(this.settings);
  }

  /**
   * Persist the current settings to localStorage. Safe to call from setting
   * toggles/UI; no-ops when storage is unavailable.
   */
  saveSettings() {
    return saveSettings(this.settings);
  }

  /**
   * Update a single setting and persist. Returns the new value.
   */
  updateSetting(key, value) {
    return updateSetting(this.settings, key, value);
  }

  /**
   * Initialize VR application
   */
  async initialize() {
    console.debug('VRApp: Initializing Qui Browser VR v2.0.0');

    // Setup Three.js
    this.setupRenderer();
    this.setupScene();
    this.setupCamera();

    // Setup VR before the (potentially long) async system init so the
    // landing-page "Enter VR" buttons are wired immediately — otherwise an
    // 'enter-vr' event dispatched during initializeSystems() is dropped.
    this.setupVR();

    // Initialize Tier 1 optimizations
    await this.initializeSystems();

    // Note: the service worker is registered once from src/main.js for all
    // device types; VRApp no longer registers it to avoid a duplicate.

    // Start render loop. Cache the bound callback so the WebGL
    // context-restored handler can re-arm it with the same function reference.
    this._renderBound = this.render.bind(this);
    this.renderer.setAnimationLoop(this._renderBound);

    console.debug('VRApp: Initialization complete');
  }

  /**
   * Setup WebGL renderer
   */
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,  // Disabled for performance (use FXAA/TAA instead)
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      stencil: false  // Disabled if not needed
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false; // Expensive, disable by default
    this.renderer.xr.enabled = true;

    // Optimization: Use logarithmic depth buffer for better precision
    this.renderer.logarithmicDepthBuffer = true;

    this.container.appendChild(this.renderer.domElement);

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
    this._onWebGLContextLost = (event) => {
      event.preventDefault(); // critical — without this, restore never fires
      console.warn('VRApp: WebGL context lost; pausing render loop until restored');
      if (this.renderer) {
        this.renderer.setAnimationLoop(null);
      }
      // notifyCrossModal handles missing subsystems gracefully (early in init
      // the captions/haptic may not yet exist).
      notifyCrossModal(this.hapticFeedback, this.captionSystem, webglContextLostMessage(), 'warn');
    };
    this._onWebGLContextRestored = () => {
      console.debug('VRApp: WebGL context restored; resuming render loop');
      if (this.renderer && this._renderBound) {
        this.renderer.setAnimationLoop(this._renderBound);
      }
      notifyCrossModal(this.hapticFeedback, this.captionSystem, webglContextRestoredMessage(), 'info');
    };
    this.renderer.domElement.addEventListener('webglcontextlost',     this._onWebGLContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this._onWebGLContextRestored, false);

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
    this._onWindowResize = debounce(() => {
      // Skip while presenting — WebXR owns the framebuffer size in that mode.
      if (this.renderer.xr && this.renderer.xr.isPresenting) {
        return;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(w, h);
      if (this.camera) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
    }, 150);
    window.addEventListener('resize', this._onWindowResize);

    console.debug('VRApp: Renderer initialized');
  }

  /**
   * Setup scene
   */
  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111); // Dark for battery savings

    // Simple ambient light (cheap)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Single directional light (for basic shading)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);

    // Default home environment so entering VR shows a grounded space (and a
    // static rest frame) rather than an empty void.
    this.homeEnvironment = this.createHomeEnvironment();
    this.scene.add(this.homeEnvironment);

    // Immersive 360°/180° video player. Lightweight until play() is called
    // (no video element or sphere is created up front), so it is always
    // available and launched on demand from the settings panel.
    this.immersiveVideo = new ImmersiveVideo(this.scene, this.camera, this.renderer, {
      registerInteractable: (m, h) => this.registerInteractable(m, h),
      unregisterInteractable: (m) => this.unregisterInteractable(m),
      onError: (msg) => this.showVRToast(msg, { type: 'error' }),
      onPlaybackChange: (state) => {
        // Guard: session-end cleanup calls stop() with isVREnabled=false; those
        // are not user-initiated actions and should not produce status messages.
        if (!this.isVREnabled) {
          return;
        }
        if (this.captionSystem && this.captionSystem.enabled) {
          let label;
          if (state === 'playing') {
            label = t('vr.msg.videoPlaying');
          } else if (state === 'stopped') {
            label = t('vr.msg.videoStopped');
          } else {
            label = t('vr.msg.videoPaused');
          }
          this.captionSystem.show(label);
        }
      },
      onHoverCaption: (label) => {
        if (this.captionSystem?.enabled && this.settings.enableGazeDwell) {
          this.captionSystem.show(label);
        }
      }
    });

    // In-VR settings panel (toggle buttons wired to the persisted settings).
    this.settingsPanel = this.createSettingsPanel();
    this.scene.add(this.settingsPanel);

    // FR-1.1/1.3: in-VR web browsing with tabs (each tab is a WebPanel).
    if (this.settings.enableWebPanel) {
      this._buildBrowsingSystems();
    }

    console.debug('VRApp: Scene created');
  }

  // Context object handed to the ui/settingsButtons factories — keeps them
  // module-pure while reusing this instance's caches, registry and settings.
  _btnCtx() {
    return {
      geoCache: this._sharedGeometries,
      texPool: this._panelTextures,
      register: (m, h) => this.registerInteractable(m, h),
      settings: this.settings,
      updateSetting: (k, v) => this.updateSetting(k, v),
      announce: (...a) => this._announceSettingsButton(...a),
      toggleSection: (id) => this._toggleSettingsSection(id)
    };
  }


  /**
   * Show a brief heads-up notification inside VR.  Creates a canvas-textured
   * plane attached to the camera so it stays in view, then auto-removes it.
   *
   * Silently no-ops outside a VR session (the 2D landing page has its own
   * styled toast in main.js).
   *
   * @param {string} message
   * @param {object} [opts]
   * @param {'error'|'warn'|'info'} [opts.type='error']
   * @param {number} [opts.duration=4000]  milliseconds before auto-dismiss
   */
  showVRToast(message, opts = {}) {
    return showVRToast(this, message, opts);
  }

  /**
   * Build a canvas-textured action button (no on/off state). Selecting it runs
   * the supplied callback. Used for one-shot actions like opening a panel.
   * Returns the button mesh (already registered as interactable).
   */
  /**
   * Build the in-VR browsing systems: tabs, the active WebPanel, the
   * bookmark/history panel and the window manager.
   *
   * Extracted from `initializeSystems()` so it can be called at RUNTIME. It
   * used to live inline there, and `initializeSystems()` runs exactly once from
   * the constructor — so the `enableWebPanel` toggle added in Session 51 could
   * do nothing but say "reload required". In VR that instruction means take the
   * headset off, reload the page, put it back on and re-enter. The whole
   * browsing feature area was gated behind that, which is why it stayed
   * unreachable in practice regardless of what the default was.
   *
   * Idempotent: calling it twice is a no-op, so a double toggle cannot build
   * two sets of panels fighting over the same interactables.
   */
  _buildBrowsingSystems() {
    return buildBrowsingSystems(this);
  }

  /**
   * Tear the browsing systems down and release everything they registered.
   *
   * Symmetric with `_buildBrowsingSystems()`. Interactables must be
   * unregistered or a ray keeps hitting meshes that are no longer in the scene
   * — the ghost-target failure mode fixed for hand models in Session 49 and for
   * native quad layers in Session 52.
   */
  _teardownBrowsingSystems() {
    if (this.windowManager) {
      this.windowManager.detach();
    }
    if (this.bookmarkPanel) {
      this.bookmarkPanel.dispose();
      this.bookmarkPanel = null;
    }
    if (this.tabManager) {
      this.tabManager.dispose();
      this.tabManager = null;
    } else if (this.webPanel) {
      this.webPanel.dispose();
    }
    this.webPanel = null;
  }

  /**
   * Apply the `enableWebPanel` toggle immediately.
   *
   * Previously this only fired a "reload required" toast — the setting was
   * persisted but nothing happened until the page was reloaded, which in a
   * headset is a hostile thing to ask. Now it builds or tears down the browsing
   * systems in place, and confirms cross-modally (WCAG 4.1.3) so a
   * caption-reliant user knows the panel appeared or went away.
   *
   * @param {boolean} enabled
   */
  _onWebPanelToggleChanged(enabled) {
    const on = enabled === undefined ? !!this.settings.enableWebPanel : !!enabled;
    if (on) {
      this._buildBrowsingSystems();
      this._attachManagedWindow();
    } else {
      this._teardownBrowsingSystems();
    }
    this.showVRToast(
      t(on ? 'vr.msg.webPanelOn' : 'vr.msg.webPanelOff'),
      { type: 'info' }
    );
  }


  /**
   * Expand / collapse one settings section and rebuild the panel.
   *
   * The panel's height and every row position depend on which sections are
   * open, so this rebuilds rather than hiding meshes in place: leaving stale
   * interactables registered at their old positions is how a panel ends up
   * with invisible controls that still take clicks.
   *
   * @param {string} sectionId
   */
  _toggleSettingsSection(sectionId) {
    // Tab semantics: selecting always selects. Exactly one section is shown, so
    // the panel's height is bounded by `1 tab row + largest section` and adding
    // a 25th control can only grow it by its own section. Re-selecting the
    // active tab is a no-op rather than collapsing to an empty panel, which is
    // what a tab affordance leads a user to expect.
    const current = this.settings.openSettingsSections || [];
    if (current.length === 1 && current[0] === sectionId) {
      return;
    }
    this.updateSetting('openSettingsSections', [sectionId]);
    this._rebuildSettingsPanel();
    if (this.captionSystem && this.captionSystem.enabled) {
      this.captionSystem.show(`${t(sectionId)}: ${t('vr.msg.sectionOpen')}`);
    }
  }

  /** Tear down and rebuild the settings panel in place, preserving visibility. */
  _rebuildSettingsPanel() {
    if (!this.settingsPanel) {
      return;
    }
    const wasVisible = this.settingsPanel.visible;
    const parent = this.settingsPanel.parent;
    this._disposeSettingsPanel();
    this.settingsPanel = this.createSettingsPanel();
    this.settingsPanel.visible = wasVisible;
    (parent || this.scene).add(this.settingsPanel);
  }


  /**
   * Repaint all settings-panel buttons in their idle (non-hover) state.
   * Called after appearance-affecting settings change (e.g. high-contrast) so
   * the whole panel updates atomically rather than one button at a time.
   */
  _redrawSettingsPanel() {
    if (this._settingsPanelDrawers) {
      this._settingsPanelDrawers.forEach(fn => fn && fn());
    }
  }

  /**
   * Speak a settings-button caption for non-visual users. Two call contexts:
   *
   *  - hover (force=false): only while gaze-dwell is on, so a controller user
   *    sweeping the ray across many buttons isn't flooded with captions.
   *  - select  (force=true): a deliberate activation, so it's announced whenever
   *    captions are on — this is the confirmation a gaze user would otherwise
   *    miss, since the gaze ray stays on the same button after it fires and
   *    onHover does not re-run to report the new value.
   *
   * No-ops when captions are disabled or unavailable.
   *
   * @param {'toggle'|'stepper'|'cycle'|'action'} type
   * @param {string} label
   * @param {*} value
   * @param {object} [opts]   forwarded to settingsButtonCaption (stepper format)
   * @param {boolean} [force] announce even when gaze-dwell is off (for select)
   */
  _announceSettingsButton(type, label, value, opts = {}, force = false) {
    const captionsEnabled = !!(this.captionSystem && this.captionSystem.enabled);
    if (!shouldAnnounceSettingsButton({
      captionsEnabled, gazeDwell: this.settings.enableGazeDwell, force
    })) {
      return;
    }
    this.captionSystem.show(settingsButtonCaption(type, label, value, opts));
  }

  /**
   * enableWebPanel gates the one-shot construction of tabManager/webPanel/
   * bookmarkPanel/windowManager inside initializeSystems(), which runs exactly
   * once (from the constructor). Flipping the persisted setting here cannot
   * retroactively construct those subsystems, so — unlike every other toggle
   * in this panel, which takes effect immediately — this one only takes
   * effect on the next page load. Telling the user that explicitly (WCAG
   * 4.1.3) avoids a toggle that silently appears to do nothing.
   */

  /**
   * Ask for the reader-proxy base URL on the VR keyboard and apply it live.
   *
   * Prefills the current value so editing beats retyping; empty input clears
   * the proxy (back to direct fetch). Valid input is persisted (FR-9.1),
   * pushed to every open tab immediately — the same applies-now discipline as
   * the enableWebPanel toggle — and confirmed cross-modally (WCAG 4.1.3).
   * Invalid input changes nothing and says so.
   */
  _requestReaderProxyInput() {
    const prefill = this.settings.readerProxyUrl || 'http://';
    this._requestVRKeyboardInput(prefill, (typed) => {
      const out = normalizeProxyUrl(typed);
      if (!out.ok) {
        this.showVRToast(t('vr.error.proxyInvalid'), { type: 'warn' });
        return;
      }
      this.updateSetting('readerProxyUrl', out.value);
      if (this.tabManager) {
        this.tabManager.setReaderProxyUrl(out.value);
      } else if (this.webPanel && this.webPanel.setReaderProxyUrl) {
        this.webPanel.setReaderProxyUrl(out.value);
      }
      this.showVRToast(
        t(out.value ? 'vr.msg.proxySet' : 'vr.msg.proxyCleared'),
        { type: 'info' }
      );
    }, t('vr.prompt.proxyUrl'));
  }

  /**
   * Clear all persisted browsing history (privacy). Fires a cross-modal
   * confirmation (caption + haptic + toast + semantic DOM) via showVRToast so
   * the destructive action is acknowledged on every channel (WCAG 4.1.3). If a
   * bookmark/history panel is open, refresh it so the cleared list shows.
   */
  _clearBrowsingHistory() {
    this.bookmarks.clearHistory();
    if (this.bookmarkPanel && this.bookmarkPanel.visible) {
      this.bookmarkPanel._draw();
    }
    this.showVRToast(t('vr.msg.historyCleared'), { type: 'info' });
  }

  /**
   * Build the in-VR settings panel: a backing quad plus toggle buttons wired to
   * the runtime settings (all effects are immediate and safe).
   */
  createSettingsPanel() {
    return createSettingsPanel(this);
  }

  /**
   * Build a lightweight default environment: gradient sky dome, floor with a
   * reference grid, and a welcome panel. Kept cheap for Quest-class GPUs
   * (basic materials, no shadows). Returns a Group added to the scene.
   */
  createHomeEnvironment() {
    const { env, floor, panelTex } = createHomeEnvironment({
      registerInteractable: (o, h) => this.registerInteractable(o, h),
      recenter: () => this.recenter(),
      getCaptionSystem: () => this.captionSystem,
      settings: this.settings
    });
    this.floorMesh = floor; // teleport target surface
    this._homePanelTexture = panelTex; // kept for explicit disposal
    return env;
  }

  /**
   * Setup camera
   */
  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      90,  // FOV - will be adjusted by comfort system
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.6, 3); // Average eye height

    // Nest the camera in a player rig so the user can be moved/turned as a unit
    // (WebXR positions the headset relative to this rig's transform).
    this.playerRig = new THREE.Group();
    this.playerRig.name = 'playerRig';
    this.playerRig.add(this.camera);
    this.scene.add(this.playerRig);

    // Spatial window management for the in-VR browser panel (head-lock follow,
    // billboard, distance). Attached to the active tab's group when present.
    if (this.settings.enableWebPanel) {
      this.windowManager = new WindowManager(this.camera, {
        distance: this.settings.windowDistance
      });
      this._attachManagedWindow();
      this.windowManager.setFollow(this.settings.enableWindowFollow);
    }
  }

  /**
   * Set up WebXR controllers: ray pointer + rendered controller models, parented
   * to the player rig. Dispatches 'select' on hit so interactables can respond.
   */
  setupControllers() {
    const factory = new XRControllerModelFactory();

    // Profile-aware, dead-zone-filtered controller input.
    this.controllerInput = new VRControllerInput({
      deadZone: this.settings.controllerDeadZone
    });

    // Shared ray line geometry (pointing down -Z from the controller).
    const rayGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ]);

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      const ray = new THREE.Line(
        rayGeometry,
        new THREE.LineBasicMaterial({ color: 0x44aaff })
      );
      ray.name = 'pointerRay';
      ray.scale.z = 5;
      controller.add(ray);
      controller.addEventListener('selectstart', () => this.onControllerSelect(controller, true));
      controller.addEventListener('selectend', () => this.onControllerSelect(controller, false));
      // Keep the live XRInputSource so we can read per-frame gamepad state.
      controller.addEventListener('connected', (e) => {
        // Distinguish initial session-start connect (inputSource undefined) from
        // mid-session reconnect after a disconnect (inputSource was set to null).
        const wasDisconnected = controller.userData.inputSource === null;
        controller.userData.inputSource = e.data;
        const name = this.controllerInput.getDeviceName(e.data);
        console.debug(`VRApp: Controller connected — ${name}`);
        if (wasDisconnected) {
          const hand = e.data?.handedness;
          const msg = controllerReconnectMessage(hand);
          this.showVRToast(msg, { type: 'info' });
        }
      });
      controller.addEventListener('disconnected', () => {
        const hand = controller.userData.inputSource?.handedness;
        const msg = controllerDisconnectMessage(hand);
        this.showVRToast(msg, { type: 'warn' });
        if (controller.userData.inputSource) {
          this.controllerInput.forget(controller.userData.inputSource);
        }
        controller.userData.inputSource = null;
        this._cancelTeleportIfAimedBy(controller);
      });
      this.playerRig.add(controller);
      this.controllers.push(controller);

      // Teleport: squeeze (grip) to aim, release to move.
      controller.addEventListener('squeezestart', () => this.onTeleportStart(controller));
      controller.addEventListener('squeezeend', () => this.onTeleportEnd());

      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip));
      this.playerRig.add(grip);
      this.controllerGrips.push(grip);
    }

    // Teleport target marker (flat ring on the floor), hidden until aiming.
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.28, 32),
      new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.visible = false;
    this.scene.add(marker);
    this.teleport.marker = marker;

    console.debug('VRApp: Controllers ready');
  }

  /**
   * Build a world-space raycaster from a controller's pose.
   *
   * Reuses a single Raycaster and Matrix4 across frames instead of allocating
   * fresh ones each call — this method is invoked per controller per frame for
   * hover/select, so at 90 FPS with two controllers that's 720+ GC-pressuring
   * allocations per second otherwise. (Three.js perf best practice: avoid
   * `new` in the render loop.)
   */
  raycasterFromController(controller) {
    return controllerRay(controller);
  }

  onTeleportStart(controller) {
    if (!this.settings.enableTeleport || !this.floorMesh) {
      return;
    }
    this.teleport.active = true;
    this.teleport.controller = controller;
  }

  onTeleportEnd() {
    const t = this.teleport;
    if (t.active && t.valid && t.target) {
      // Move the rig by the delta between the head's ground position and the
      // target so the user ends up standing on the marker.
      const head = new THREE.Vector3();
      this.camera.getWorldPosition(head);
      this.playerRig.position.x += t.target.x - head.x;
      this.playerRig.position.z += t.target.z - head.z;

      // Cross-modal landing confirmation: haptic impact on the triggering
      // controller + caption for caption-enabled users.
      fireTeleportFeedback(t.controller, this.hapticFeedback, this.captionSystem);
    }
    this._resetTeleportAim();
  }

  /**
   * Clear teleport-aim state (active/controller/marker) WITHOUT completing a
   * move — unlike onTeleportEnd(), which this factors the shared reset out
   * of. Used both by onTeleportEnd()'s tail and by a controller disconnect
   * mid-aim, where completing the teleport to a stale raycast target would be
   * the wrong behavior (the user never released the squeeze intentionally).
   */
  _resetTeleportAim() {
    const t = this.teleport;
    t.active = false;
    t.valid = false;
    t.controller = null;
    if (t.marker) {
      t.marker.visible = false;
    }
  }

  /**
   * Cancel (not complete) an in-progress teleport aim if `controller` is the
   * one currently aiming. A disconnect (headset removed, VR session ends, or
   * a hand-tracking handoff) only ever fires 'disconnected' — never
   * 'squeezeend' — for whatever buttons happen to be held. Without this, a
   * mid-aim teleport (squeeze held, never released) left teleport.active
   * stuck true and the marker frozen at its last raycast position
   * indefinitely, since updateTeleport() has no inputSource guard of its own.
   */
  _cancelTeleportIfAimedBy(controller) {
    if (this.teleport.active && this.teleport.controller === controller) {
      this._resetTeleportAim();
    }
  }

  /**
   * Per-frame locomotion input: snap turn on the right thumbstick. Rotates the
   * whole player rig about the head so the user spins in place. (Smooth-move on
   * the left stick is intentionally deferred until comfort-vignette coupling is
   * wired, since continuous motion is the main sickness trigger.)
   */

  /**
   * Per-frame face-button / thumbstick-click input for all connected controllers.
   * Actions are bound to logical button names so they work across device families:
   *
   *   Right hand (or left in southpaw mode — dominant/pointer hand):
   *     faceA          → browser forward
   *     faceB          → browser back
   *     thumbstickClick → recenter view
   *
   *   Left hand (or right in southpaw mode — utility hand):
   *     faceA (X)      → toggle bookmarks/history panel
   *     faceB (Y)      → toggle settings panel
   *     menu           → toggle settings panel
   *     thumbstickClick → show/hide VR keyboard
   *
   * Haptic click feedback is fired on any justPressed event.
   */

  /** Rotate the player rig in place about the head by snapTurnAngle * direction. */

  /** Per-frame teleport aiming: project the controller ray onto the floor. */

  /**
   * Handle a controller select. On press (isStart), raycasts the controller
   * ray against the interactables registry and fires the hit object's
   * onSelect handler plus a 'qui-select' DOM-style event. On release, ends an
   * in-progress panel grab (grab-to-move) if this controller started one.
   */

  /**
   * WebPanel's move bar was selected — begin a WindowManager grab-to-move
   * drag on the panel it belongs to (the active tab's group, since the move
   * bar rides along with whichever panel is currently attached).
   */
  /**
   * Point the window manager at the browser window's managed transform.
   *
   * With TabManager this is its `rootGroup` — the tab strip and every panel are
   * children of it, so there is exactly one thing to move and it never changes
   * when the active tab does. Previously the manager was attached to the
   * *active panel's* group, which had to be re-synced on every tab switch and
   * left the tab strip behind whenever the panel was moved.
   * Falls back to a standalone `webPanel` when tabs are not in use.
   * @returns {boolean} true when a target is attached
   */
  _attachManagedWindow() {
    if (!this.windowManager) {
      return false;
    }
    const target = this.tabManager
      ? this.tabManager.rootGroup
      : (this.webPanel && this.webPanel.group);
    if (!target) {
      return false;
    }
    if (this.windowManager.target !== target) {
      this.windowManager.attach(target);
    }
    return true;
  }

  _onPanelGrabRequested(controller) {
    if (!this.windowManager || !controller) {
      return;
    }
    // Re-checked here rather than assumed: beginGrab() measures from the
    // target's current world position, so a detached or stale target would
    // compute the grab offset from the wrong place. Not gated on success —
    // WindowManager.beginGrab() already no-ops without a target.
    this._attachManagedWindow();
    this.windowManager.beginGrab(controller);
    this._grabController = controller;
    firePanelGrabFeedback(controller, this.hapticFeedback, this.captionSystem);
  }

  /**
   * Register a mesh as interactable. handlers: { onSelect, onHover, onHoverEnd }.
   * Returns the object for chaining.
   */
  registerInteractable(object, handlers = {}) {
    object.userData.interactable = handlers;
    if (!this.interactables.includes(object)) {
      this.interactables.push(object);
    }
    return object;
  }

  /** Remove an interactable from the registry. */
  unregisterInteractable(object) {
    const i = this.interactables.indexOf(object);
    if (i !== -1) {
      this.interactables.splice(i, 1);
    }
  }

  /**
   * Per-frame hover detection for each controller ray against interactables,
   * firing onHover/onHoverEnd as the hovered object changes.
   */
  updateHover() {
    if (this.interactables.length === 0) {
      return;
    }
    for (const controller of this.controllers) {
      const hit = this.raycasterFromController(controller)
        .intersectObjects(this.interactables, false)
        .find(h => isWorldVisible(h.object));
      const obj = hit ? hit.object : null;
      const prev = controller.userData.hovered || null;
      if (prev === obj) {
        continue;
      }
      if (prev && prev.userData.interactable && prev.userData.interactable.onHoverEnd) {
        prev.userData.interactable.onHoverEnd();
      }
      if (obj && obj.userData.interactable && obj.userData.interactable.onHover) {
        obj.userData.interactable.onHover();
      }
      controller.userData.hovered = obj;
    }
  }

  /** Return the player to the origin (useful after teleporting around). */
  recenter() {
    if (!this.playerRig) {
      return;
    }
    this.playerRig.position.set(0, 0, 0);
    this.playerRig.quaternion.identity();
    if (this.captionSystem && this.captionSystem.enabled) {
      this.captionSystem.show(t('vr.msg.recentered'));
    }
    console.debug('VRApp: recentered');
  }

  /**
   * Initialize all optimization systems
   */
  async initializeSystems() {
    const startTime = performance.now();

    // NFR-2: probe device capabilities first so downstream systems can
    // respect what the runtime actually supports.
    const compat = await this.deviceCompat.check();
    // Override targetFPS from device detection if not already user-specified.
    if (!this.settings._fpsOverridden) {
      this.settings.targetFPS = this.deviceCompat.targetFPS();
    }
    console.debug(`VRApp: Device tier=${compat.deviceTier}, targetFPS=${this.settings.targetFPS}`);

    // === TIER 1 SYSTEMS ===

    // 1. Fixed Foveated Rendering
    if (this.settings.enableFFR) {
      try {
        this.ffrSystem = new FFRSystem();
        console.debug('VRApp: FFR system ready');
      } catch (e) {
        console.error('VRApp: FFR init failed', e);
        this.showVRToast(t('vr.error.foveationUnavailable'), { type: 'warn' });
      }
    }

    // 2. Comfort System
    if (this.settings.enableComfort) {
      this.comfortSystem = new ComfortSystem(
        this.camera,
        this.renderer,
        { reduceMotion: osReducedMotion() }
      );
      this.comfortSystem.setPreset(this.settings.motionSensitivity);
      console.debug('VRApp: Comfort system initialized');
    }

    // === TIER 2 SYSTEMS ===

    // 5. Japanese IME — pass interactable hooks so the 3D keyboard keys can be
    // selected with a controller ray.
    this.japaneseIME = new JapaneseIME();
    this.vrKeyboard = new VRJapaneseKeyboard(this.scene, this.japaneseIME, {
      registerInteractable: (m, h) => this.registerInteractable(m, h),
      unregisterInteractable: (m) => this.unregisterInteractable(m),
      // Larger keys (bigger targets) for the large-text accessibility preference.
      scale: largeTextScale(getPrefs().largeText),
      onHoverCaption: (label) => {
        if (this.captionSystem?.enabled && this.settings.enableGazeDwell) {
          this.captionSystem.show(label);
        }
      },
      onCancel: () => {
        if (this.captionSystem && this.captionSystem.enabled) {
          this.captionSystem.show(t('vr.msg.keyboardCancelled'));
        }
      },
      // Frecency-ranked history/bookmark suggestions while typing (gaze-dwell
      // typing is ~8-10 WPM, so jumping to a known destination after a couple
      // of characters is the single biggest text-entry speedup available).
      suggestionProvider: (query) => this.bookmarks.search(query, 4, Date.now())
    });
    console.debug('VRApp: Japanese IME ready');

    // 6. Hand Tracking
    this.handTracking = new HandTracking(this.scene);
    // WCAG 4.1.3: announce hand-tracking state changes so users who rely on
    // hand input know when it becomes unavailable. Brief flickers are common,
    // so each hand's announcement is debounced: only fire if the state holds
    // for 600 ms, preventing a storm of "lost"/"regained" captions.
    // Tracked on `this` (not a closure-local) so dispose() can clear a pending
    // timer — otherwise a flicker just before teardown fires this callback
    // 600 ms later against a disposed captionSystem (same teardown-leak class
    // as the toast auto-dismiss timers and the TTS utterance).
    this._handTrackingTimers = {};
    this.handTracking.onTrackingChange((hand, tracked) => {
      clearTimeout(this._handTrackingTimers[hand]);
      this._handTrackingTimers[hand] = setTimeout(() => {
        if (this.captionSystem && this.captionSystem.enabled) {
          // Four explicit keys rather than composing "<hand> hand <state>":
          // word order and particles differ by language, so composition would
          // produce broken Japanese.
          this.captionSystem.show(t(
            hand === 'left'
              ? (tracked ? 'vr.msg.leftHandTracked' : 'vr.msg.leftHandLost')
              : (tracked ? 'vr.msg.rightHandTracked' : 'vr.msg.rightHandLost')
          ));
        }
      }, 600);
    });
    console.debug('VRApp: Hand tracking ready');

    // 6a. Haptic Feedback — wired to hand-tracking gesture callbacks in
    // onVRSessionStart() once a session and gamepads are available.
    try {
      this.hapticFeedback = new HapticFeedback();
      // Honour the persisted haptics preference so a user who turned haptics
      // off keeps that from startup, not just after re-toggling it live.
      this.hapticFeedback.setEnabled(this.settings.enableHaptics !== false);
      console.debug('VRApp: Haptic feedback ready');
    } catch (e) {
      console.error('VRApp: Haptic feedback init failed', e);
      this.showVRToast(t('vr.error.hapticUnavailable'), { type: 'warn' });
      // Set to null so notifyCrossModal() skips haptic gracefully
      this.hapticFeedback = null;
    }

    // 6b. Gaze-dwell interaction (FR-13.1, accessibility). Created always so it
    // can be toggled live from the settings panel; only active when enabled.
    this.gazeInteraction = new GazeInteraction(this.camera, {
      dwellTime: this.settings.gazeDwellTime,
      graceTime: this.settings.gazeGraceTime,
      // Honour the OS reduced-motion preference: static activation cue, no fade.
      reduceMotion: osReducedMotion(),
      // Honour high-contrast: full-opacity ring for visibility (WCAG 1.4.11).
      highContrast: prefersHighContrast()
    });
    this.gazeInteraction.setEnabled(this.settings.enableGazeDwell);
    console.debug('VRApp: Gaze-dwell interaction ready');

    // 6c. Semantic DOM overlay (2D / screen-reader accessibility, Phase 2).
    // A hidden ARIA-live region mirroring captions/toasts/settings state for
    // consumers outside the WebGL render (Quest dom-overlay accessibility
    // services, or assistive tech inspecting the page). Purely a redundant
    // announcement surface, so a failure here is console-only, not toast-worthy.
    try {
      this.semanticDOM = new SemanticDOM();
      console.debug('VRApp: Semantic DOM overlay ready');
    } catch (e) {
      console.error('VRApp: Semantic DOM overlay init failed', e);
      this.semanticDOM = null;
    }

    // 6d. In-VR captions (FR-13.1, accessibility). Created always so it can be
    // toggled live; only renders when enabled and lines are present.
    // Honour the user's accessibility preferences so low-vision users get
    // bigger, higher-contrast captions (reuses the same signals as the 2D layer).
    this.captionSystem = new CaptionSystem(this.camera, {
      scale: this.settings.captionScale,
      highContrast: prefersHighContrast(),
      lineDuration: this.settings.captionDuration * 1000,
      verticalOffset: this.settings.captionHeight,
      onShow: (text) => this.semanticDOM?.announceCaption(text)
    });
    this.captionSystem.setEnabled(this.settings.enableCaptions);
    console.debug('VRApp: Caption system ready');

    // 6e. Live-subscribe to OS accessibility signal changes (WCAG 2.3.3 /
    // 1.4.11). osReducedMotion()/prefersHighContrast() were otherwise only
    // read once, at each subsystem's construction above — an OS-level
    // preference toggled after the page has already loaded (e.g. from the
    // headset's system Quick Settings, without reloading the tab) would
    // never reach comfortSystem/gazeInteraction/captionSystem for the rest
    // of the page's lifetime, including across VR session enter/exit.
    this._setupOSAccessibilityListeners();

    // 7. Spatial Audio
    try {
      this.spatialAudio = new SpatialAudio();
      // Apply the persisted master-volume preference at startup so a user who
      // lowered/muted audio keeps that on the next load (not just live).
      this.spatialAudio.setMasterVolume((this.settings.masterVolume ?? 100) / 100);
      await this.loadAudioAssets();
      console.debug('VRApp: Spatial audio initialized');
    } catch (e) {
      console.error('VRApp: Spatial audio init failed', e);
      this.showVRToast(t('vr.error.spatialAudioUnavailable'), { type: 'warn' });
    }

    // 12. DevTools (development builds only; hidden until toggled with F12).
    // Dynamically imported so it is dropped from production bundles.
    if (import.meta.env.DEV) {
      const { DevTools } = await import('../dev/DevTools.js');
      this.devTools = new DevTools(this);
      this.devTools.initialize();
      console.debug('VRApp: DevTools ready (F12 to toggle)');
    }

    const loadTime = performance.now() - startTime;
    console.debug(`VRApp: All systems initialized in ${loadTime.toFixed(1)}ms`);
  }

  /**
   * Live-subscribe to OS accessibility signal changes (WCAG 2.3.3 / 1.4.11).
   * Called once from initializeSystems(). No-ops without matchMedia (test env
   * / non-browser). Listeners are detached in dispose().
   */
  _setupOSAccessibilityListeners() {
    if (typeof matchMedia === 'undefined') {
      return;
    }

    this._osMotionMQ = matchMedia('(prefers-reduced-motion: reduce)');
    this._onOSReducedMotionChange = (e) => {
      if (this.comfortSystem) {
        this.comfortSystem.setReducedMotion(e.matches);
      }
      if (this.gazeInteraction) {
        this.gazeInteraction.setReducedMotion(e.matches);
      }
    };
    this._osMotionMQ.addEventListener('change', this._onOSReducedMotionChange);

    // osHighContrast() ORs prefers-contrast and forced-colors, so either query
    // changing can flip the effective decision; both share the same handler.
    this._osContrastMQ = matchMedia('(prefers-contrast: more)');
    this._osForcedColorsMQ = matchMedia('(forced-colors: active)');
    this._onOSContrastChange = () => {
      const hc = prefersHighContrast();
      if (this.gazeInteraction) {
        this.gazeInteraction.setHighContrast(hc);
      }
      if (this.captionSystem) {
        this.captionSystem.setHighContrast(hc);
      }
    };
    this._osContrastMQ.addEventListener('change', this._onOSContrastChange);
    this._osForcedColorsMQ.addEventListener('change', this._onOSContrastChange);
  }

  /**
   * Register interaction sounds. No audio files are shipped — all feedback
   * sounds are short synthesized tones registered as procedural buffers.
   */
  async loadAudioAssets() {
    if (!this.spatialAudio) {
      return;
    }

    const PROCEDURAL = {
      click:   { freq: 880, duration: 0.06, decay: 45 },
      hover:   { freq: 620, duration: 0.045, decay: 60, gain: 0.5 },
      success: { freq: 520, endFreq: 784, duration: 0.14, decay: 12 },
      error:   { freq: 200, duration: 0.16, decay: 10 }
    };

    for (const [name, cfg] of Object.entries(PROCEDURAL)) {
      this.spatialAudio.registerProceduralBuffer(name, cfg);
      if (!this.spatialAudio.sources.has(name)) {
        this.spatialAudio.createSource(name, { volume: 0.6 });
      }
    }
  }

  /**
   * Setup WebXR
   */
  async onVRSessionStart() {
    return onVRSessionStart(this);
  }

  onVRSessionEnd() {
    return onVRSessionEnd(this);
  }

  setupVR() {
    // Add VR button to page
    const vrButton = VRButton.createButton(this.renderer);
    document.body.appendChild(vrButton);
    this.vrButton = vrButton;

    // Wire the landing-page "Enter VR" buttons (which dispatch a global
    // 'enter-vr' event) to the WebXR session request. Without this the
    // landing-page buttons dispatch an event that nothing handles.
    this.onEnterVRRequest = () => vrButton.click();
    window.addEventListener('enter-vr', this.onEnterVRRequest);

    // Pause immersive video when the tab/headset is hidden (e.g. headset removed).
    // Pause-only: do not auto-resume on re-show (gesture-gated autoplay is unreliable
    // and a removed headset signals intentional stop; tap HUD Play to continue).
    this.onDocumentVisibilityChange = () => {
      if (document.hidden && this.immersiveVideo && this.immersiveVideo.playing) {
        this.immersiveVideo.togglePause();
      }
    };
    document.addEventListener('visibilitychange', this.onDocumentVisibilityChange);

    // Controllers (ray pointer + rendered models) parented to the player rig.
    this.setupControllers();

    // Listen for VR session events
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.onVRSessionStart();
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.onVRSessionEnd();
    });
  }

  /**
   * Handle VR session start
   */

  /**
   * Handle VR session end
   */

  /**
   * FR-1.5: Create one XRQuadLayer per open WebPanel and wire it up.
   * Called from onVRSessionStart() after LayersSystem.initialize() succeeds.
   */
  _attachLayersToPanels(session) {
    const refSpace = this.renderer.xr.getReferenceSpace();
    if (!refSpace) {
      return;
    }

    const panels = this.tabManager
      ? this.tabManager.tabs
      : (this.webPanel ? [this.webPanel] : []);

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const layerId = `panel_chrome_${i}`;
      const quadLayer = this.layersSystem.createQuadLayer({
        id    : layerId,
        space : refSpace,
        // Chrome bar: same physical dimensions as the Three.js chromeMesh
        // (PANEL_W=1.6m, CHROME_H fraction=0.08 of PANEL_H=1.0m → 0.08m).
        width  : 1.6,
        height : 0.08,
        pixelWidth  : 2048,
        pixelHeight : 164 // 1024*0.08*2 — native-res equivalent
      });
      if (quadLayer) {
        // Pass the id + a detach callback so closing this tab mid-session
        // releases exactly its layer (see _detachPanelLayer).
        panel.enableLayerMode(quadLayer, this.layersSystem, layerId,
          (id) => this._detachPanelLayer(id));
      }
    }

    // Commit the layer stack: Three.js base layer + our panel quad layers.
    const baseLayer = this.renderer.xr.getBaseLayer
      ? this.renderer.xr.getBaseLayer()
      : null;
    this.layersSystem.updateRenderState(session, baseLayer);
    console.debug(`VRApp: LayersSystem attached ${this.layersSystem.count} quad layer(s)`);
  }

  /**
   * Release a single panel's XRQuadLayer mid-session (invoked when a tab is
   * closed, via WebPanel.disableLayerMode()'s detach callback). Reads the live
   * session + base layer so LayersSystem.removeLayer() can re-commit the render
   * state WITHOUT the closed tab's layer — otherwise the native layer stayed
   * registered in LayersSystem._layers and in the committed render state,
   * compositing a frozen "ghost chrome bar" and holding its GPU texture for the
   * rest of the session (compounding per closed tab). Session-end teardown does
   * NOT route through here — it bulk-disposes the whole LayersSystem instead.
   * @param {string} layerId
   */
  _detachPanelLayer(layerId) {
    if (!this.layersSystem) {
      return;
    }
    const session = this.renderer.xr.getSession
      ? this.renderer.xr.getSession()
      : null;
    const baseLayer = this.renderer.xr.getBaseLayer
      ? this.renderer.xr.getBaseLayer()
      : null;
    this.layersSystem.removeLayer(layerId, session, baseLayer);
  }

  /**
   * Main render loop
   */
  render(timestamp, xrFrame) {
    this.frameCount++;

    // Single frame clock: all systems share one dt (capped at 50 ms so a tab
    // resuming from background doesn't produce an enormous delta).
    const frameStart = performance.now();
    const dt = this._lastRenderTime
      ? Math.min((frameStart - this._lastRenderTime) / 1000, 0.05)
      : 0.016;
    this._lastRenderTime = frameStart;

    // Update systems
    this.updateSystems(timestamp, xrFrame, dt);

    // Render scene
    this.renderer.render(this.scene, this.camera);

    // Track performance
    const frameTime = performance.now() - frameStart;
    this.updatePerformanceMonitor(frameTime);

    // Dynamic quality adjustment (every 60 frames)
    if (this.frameCount % 60 === 0) {
      this.adjustQuality();
    }
  }

  /**
   * Update all systems
   */
  updateLocomotion(dt = 0.016) {
    return updateLocomotion(this, dt);
  }
  updateButtonInput() {
    return updateButtonInput(this);
  }
  snapTurn(direction, hand = null) {
    return snapTurn(this, direction, hand);
  }
  updateTeleport() {
    return updateTeleport(this);
  }
  onControllerSelect(controller, isStart) {
    return onControllerSelect(this, controller, isStart);
  }

  updateSystems(timestamp, xrFrame, dt = 0.016) {
    // Update comfort system (vignette, FOV)
    if (this.comfortSystem && this.settings.enableComfort) {
      this.comfortSystem.update(dt);
    }

    // Update FFR based on performance and predicted gaze (FR-4.2).
    if (this.ffrSystem && this.isVREnabled) {
      // Use the shared frame dt — no per-system timer needed.
      this.ffrSystem.trackHeadPose(this.camera.quaternion, dt);
      this.ffrSystem.updatePredictedGazeFoveation();

      // Also coarse-adjust based on frame-budget pressure.
      const targetFrameTime = 1000 / this.settings.targetFPS;
      if (this.performanceMonitor.frameTime > targetFrameTime) {
        this.ffrSystem.adjustIntensity(0.01);
      } else {
        this.ffrSystem.adjustIntensity(-0.01);
      }
    }

    // Update hand tracking
    if (this.handTracking && xrFrame) {
      const referenceSpace = this.renderer.xr.getReferenceSpace();
      this.handTracking.update(xrFrame, referenceSpace);
    }

    // Refresh gamepad list for haptic routing (safe no-op when no gamepads).
    if (this.hapticFeedback) {
      this.hapticFeedback.update();
    }

    // Update spatial audio listener position
    if (this.spatialAudio) {
      this.spatialAudio.updateListenerFromCamera(this.camera);
    }

    // FR-1.5: per-frame quad-layer canvas blit (only when dirty).
    if (this.layersSystem && this.layersSystem.isSupported && xrFrame) {
      const refSpace = this.renderer.xr.getReferenceSpace();
      const pose = refSpace ? xrFrame.getViewerPose(refSpace) : null;
      const views = pose ? pose.views : [];
      if (views.length > 0) {
        const panels = this.tabManager
          ? this.tabManager.tabs
          : (this.webPanel ? [this.webPanel] : []);
        for (const panel of panels) {
          panel.updateLayer(xrFrame, views);
        }
      }
    }

    // Update locomotion input (snap turn), face-button actions, teleport, and hover.
    this.updateLocomotion(dt);
    this.updateButtonInput();
    this.updateTeleport();
    this.updateHover();

    // FR-13.1: gaze-dwell selection (hands-free). dt is seconds; pass ms.
    if (this.gazeInteraction && this.gazeInteraction.enabled) {
      const activated = this.gazeInteraction.update(this.interactables, dt * 1000);
      if (activated) {
        // Parity with controller/pinch selection: confirm a hands-free gaze
        // activation on the non-visual channels too — a haptic click on any held
        // controller and a spatial click — so it isn't signalled by sight alone.
        if (this.hapticFeedback) {
          this.hapticFeedback.playPatternBothHands('click');
        }
        if (this.spatialAudio) {
          const pos = activated.getWorldPosition(new THREE.Vector3());
          this.spatialAudio.play('click', 'click', pos);
        }
      }
    }

    // FR-13.1: age out in-VR captions.
    if (this.captionSystem && this.captionSystem.enabled) {
      this.captionSystem.update(dt * 1000);
    }

    // Spatial window management: keep the active panel followed/billboarded.
    if (this.windowManager && (this.windowManager.followMode || this.windowManager.isGrabbing)) {
      // The managed target is TabManager's rootGroup, which does not change
      // with the active tab — so this only has to cover the case where the
      // browser window was built after the manager.
      this._attachManagedWindow();
      this.windowManager.update(dt * 1000);
    }

    // Keep the immersive video sphere centred on the head while it plays.
    if (this.immersiveVideo) {
      this.immersiveVideo.update(dt);
    }
  }

  /**
   * Update performance monitor
   */
  updatePerformanceMonitor(frameTime) {
    // Exponential moving average for smooth values
    const alpha = 0.1;
    this.performanceMonitor.frameTime =
      this.performanceMonitor.frameTime * (1 - alpha) + frameTime * alpha;

    this.performanceMonitor.fps = 1000 / this.performanceMonitor.frameTime;

    // Track memory usage
    if (performance.memory) {
      this.performanceMonitor.memoryUsed =
        performance.memory.usedJSHeapSize / 1024 / 1024; // MB
    }

    // Real GPU metrics from the renderer.
    const info = this.renderer.info;
    this.performanceMonitor.drawCalls = info.render.calls;
    this.performanceMonitor.triangles = info.render.triangles;
  }

  /**
   * Dynamic quality adjustment
   */
  adjustQuality() {
    const targetFrameTime = 1000 / this.settings.targetFPS;
    const currentFrameTime = this.performanceMonitor.frameTime;

    if (currentFrameTime > targetFrameTime * 1.2) {
      // Performance is poor, reduce quality
      this.reduceQuality();
    } else if (currentFrameTime < targetFrameTime * 0.8) {
      // Performance is good, increase quality
      this.increaseQuality();
    }
  }

  /**
   * Reduce rendering quality for better performance
   */
  reduceQuality() {
    // Increase FFR intensity
    if (this.ffrSystem) {
      this.ffrSystem.adjustIntensity(0.1);
    }

    // Reduce render scale (if implemented)
    // this.renderer.setPixelRatio(0.8);

    console.debug('VRApp: Quality reduced for performance');
  }

  /**
   * Increase rendering quality when performance allows
   */
  increaseQuality() {
    // Decrease FFR intensity
    if (this.ffrSystem) {
      this.ffrSystem.adjustIntensity(-0.1);
    }

    // Increase render scale (if implemented)
    // this.renderer.setPixelRatio(1.0);

    console.debug('VRApp: Quality increased');
  }

  /**
   * Get performance statistics
   */
  /**
   * Show the VR keyboard pre-filled with `prefill` and fire `onConfirm(text)`
   * when the user commits.  Falls back to window.prompt() when the VR keyboard
   * is not available (e.g. tests or desktop without XR).
   *
   * @param {string}   prefill   — initial text in the input buffer
   * @param {Function} onConfirm — called with the confirmed string
   */
  _requestVRKeyboardInput(prefill, onConfirm, prompt = 'Enter URL') {
    if (this.vrKeyboard) {
      this.vrKeyboard.setOnConfirm(onConfirm);
      this.japaneseIME.activate();
      // Pre-fill the composition buffer with the current URL so the user
      // can edit it rather than typing from scratch.
      if (prefill && prefill !== 'https://') {
        this.japaneseIME.compositionBuffer = prefill;
      } else {
        this.japaneseIME.compositionBuffer = '';
      }
      // Build (if needed) and show the 3D keyboard, then refresh its display.
      this.vrKeyboard.show();
      // WCAG 3.3.2 Labels or Instructions: announce what input is expected so
      // caption-reliant users know what the keyboard is for without having to
      // look at the visual prompt bar, which may be outside their focus area.
      if (this.captionSystem && this.captionSystem.enabled) {
        this.captionSystem.show(prompt);
      }
    } else {
      // Desktop / non-VR fallback (only reached when no VR keyboard exists, e.g.
      // desktop/2D, where window.prompt is the correct input).
      // eslint-disable-next-line no-alert
      const url = window.prompt('Enter URL', prefill);
      if (url) {
        onConfirm(url);
      }
    }
  }

  /**
   * Prompt for a video URL (via the VR keyboard, falling back to window.prompt
   * on desktop) and play it as an immersive 360°/180° video. Projection and
   * stereo layout are auto-detected from the URL.
   */
  _launchImmersiveVideo() {
    this._requestVRKeyboardInput('https://', (url) => {
      if (!url || !this.immersiveVideo) {
        return;
      }
      this.immersiveVideo.play(url, detectVideoFormat(url));
    }, 'Enter video URL');
  }

  /**
   * Navigate to a URL: records the visit in BookmarkStore history.
   * Call this whenever the in-VR panel loads a new page.
   */
  navigate(url, title = url) {
    this.bookmarks.addHistory(url, title);
    // Caption the page title so caption-enabled users who aren't looking at the
    // URL bar know which page loaded — the visual chrome update is the primary
    // channel but only helps users whose gaze is already on the panel.
    if (this.captionSystem && this.captionSystem.enabled) {
      const label = (title !== url) ? title : hostnameCaption(url);
      this.captionSystem.show(label);
    }
  }

  getPerformanceStats() {
    const info = this.renderer.info;
    const stats = {
      fps: Math.round(this.performanceMonitor.fps),
      frameTime: this.performanceMonitor.frameTime.toFixed(2) + 'ms',
      memory: this.performanceMonitor.memoryUsed.toFixed(1) + 'MB',
      drawCalls: this.performanceMonitor.drawCalls,
      triangles: this.performanceMonitor.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs ? info.programs.length : 0
    };

    // Add system-specific stats
    if (this.ffrSystem) {
      stats.ffrIntensity = (this.ffrSystem.intensity * 100).toFixed(0) + '%';
    }

    return stats;
  }

  /**
   * Cleanup and disposal
   */
  dispose() {
    console.debug('VRApp: Disposing...');

    // Stop render loop
    this.renderer.setAnimationLoop(null);

    // Remove WebGL context-loss listeners so a late event after teardown
    // doesn't fire a notification or try to restart the loop on a freed
    // renderer. Guard each side: setupRenderer() may not have run in a test.
    if (this.renderer && this.renderer.domElement) {
      if (this._onWebGLContextLost) {
        this.renderer.domElement.removeEventListener('webglcontextlost', this._onWebGLContextLost);
      }
      if (this._onWebGLContextRestored) {
        this.renderer.domElement.removeEventListener('webglcontextrestored', this._onWebGLContextRestored);
      }
    }
    this._onWebGLContextLost = null;
    this._onWebGLContextRestored = null;
    this._renderBound = null;

    // Detach the window resize listener and drop any pending trailing-edge
    // call so the debounced callback can't fire on a freed renderer.
    if (this._onWindowResize) {
      window.removeEventListener('resize', this._onWindowResize);
      if (typeof this._onWindowResize.cancel === 'function') {
        this._onWindowResize.cancel();
      }
      this._onWindowResize = null;
    }

    // Detach the OS accessibility signal (matchMedia) listeners so a change
    // after teardown doesn't touch already-disposed subsystems.
    if (this._osMotionMQ && this._onOSReducedMotionChange) {
      this._osMotionMQ.removeEventListener('change', this._onOSReducedMotionChange);
    }
    if (this._osContrastMQ && this._onOSContrastChange) {
      this._osContrastMQ.removeEventListener('change', this._onOSContrastChange);
    }
    if (this._osForcedColorsMQ && this._onOSContrastChange) {
      this._osForcedColorsMQ.removeEventListener('change', this._onOSContrastChange);
    }
    this._osMotionMQ = null;
    this._osContrastMQ = null;
    this._osForcedColorsMQ = null;
    this._onOSReducedMotionChange = null;
    this._onOSContrastChange = null;

    // Clear pending toast auto-dismiss timers so their callbacks don't fire
    // against a torn-down VRApp (this.camera nulled, GPU resources already
    // freed below). Without this the timer holds a closure over `this` and
    // surfaces as a console error or a test-leak warning after teardown.
    if (this._toastTimers) {
      this._toastTimers.forEach((t) => clearTimeout(t));
      this._toastTimers.clear();
    }

    // Clear pending hand-tracking debounce timers for the same reason: a hand
    // flicker just before teardown would otherwise fire its "hand lost/tracked"
    // caption 600 ms later against a disposed captionSystem.
    if (this._handTrackingTimers) {
      Object.values(this._handTrackingTimers).forEach((t) => clearTimeout(t));
      this._handTrackingTimers = {};
    }

    // Remove global listeners and DOM nodes added during setup
    if (this.onEnterVRRequest) {
      window.removeEventListener('enter-vr', this.onEnterVRRequest);
      this.onEnterVRRequest = null;
    }
    if (this.onDocumentVisibilityChange) {
      document.removeEventListener('visibilitychange', this.onDocumentVisibilityChange);
      this.onDocumentVisibilityChange = null;
    }
    if (this.vrButton && this.vrButton.parentNode) {
      this.vrButton.parentNode.removeChild(this.vrButton);
    }

    // Dispose systems
    if (this.comfortSystem) {
      this.comfortSystem.dispose();
    }
    if (this.ffrSystem) {
      this.ffrSystem.dispose();
    }
    if (this.vrKeyboard) {
      this.vrKeyboard.dispose(); this.vrKeyboard = null;
    } else if (this.japaneseIME) {
      this.japaneseIME.dispose(); this.japaneseIME = null;
    }
    if (this.handTracking) {
      this.handTracking.dispose();
    }
    if (this.hapticFeedback) {
      this.hapticFeedback.enabled = false; this.hapticFeedback = null;
    }
    if (this.gazeInteraction) {
      this.gazeInteraction.dispose();
    }
    if (this.captionSystem) {
      this.captionSystem.dispose();
    }
    if (this.semanticDOM) {
      this.semanticDOM.dispose();
    }
    if (this.spatialAudio) {
      this.spatialAudio.dispose();
    }
    if (this.windowManager) {
      this.windowManager.dispose();
    }
    if (this.layersSystem) {
      this.layersSystem.dispose(); this.layersSystem = null;
    }
    if (this.bookmarkPanel) {
      this.bookmarkPanel.dispose(); this.bookmarkPanel = null;
    }
    if (this.immersiveVideo) {
      this.immersiveVideo.dispose(); this.immersiveVideo = null;
    }
    if (this.tabManager) {
      this.tabManager.dispose();
    } else if (this.webPanel) {
      this.webPanel.dispose();
    }
    if (this.devTools) {
      this.devTools.dispose();
    }
    if (this._homePanelTexture) {
      this._homePanelTexture.dispose();
    }
    if (this._panelTextures) {
      this._panelTextures.forEach((t) => t.dispose());
    }
    // Dispose the shared button geometries once. The scene.traverse below would
    // also reach them via the button meshes, but disposing here keeps the cache
    // authoritative and BufferGeometry.dispose() is idempotent.
    if (this._sharedGeometries) {
      this._sharedGeometries.forEach((g) => g.dispose());
      this._sharedGeometries.clear();
    }

    // Dispose Three.js
    this.renderer.dispose();
    this.scene.traverse(object => {
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
}

/**
 * Usage Example:
 *
 * const app = new VRApp(document.getElementById('vr-container'));
 *
 * // Get performance stats
 * setInterval(() => {
 *   const stats = app.getPerformanceStats();
 *   console.debug('FPS:', stats.fps, 'Memory:', stats.memory);
 * }, 1000);
 *
 * // Cleanup on page unload
 * window.addEventListener('beforeunload', () => {
 *   app.dispose();
 * });
 */

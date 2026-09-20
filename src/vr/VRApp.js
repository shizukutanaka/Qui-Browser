/**
 * VR Application Main Controller
 * Integrates all Tier 1 optimizations for production-ready performance
 *
 * John Carmack principle: Systems integration is where performance lives or dies
 */

import * as THREE from 'three';

// Tier 1 Optimizations

// Tier 2 Features
import { resolveComfortPreset } from './comfort/ComfortSystem.js';
import { AccessibilityCoordinator } from './accessibility/AccessibilityCoordinator.js';
import { osReducedMotion, getPrefs, largeTextScale, prefersHighContrast } from '../a11y/accessibility.js';
import { t } from '../i18n/i18n.js';
import { normalizeProxyUrl, hostnameCaption } from './browser/urlDisplay.js';
import { showVRToast } from './ui/vrToast.js';
import { controllerRay } from './ui/canvasMesh.js';
import { isWorldVisible, updateLocomotion, updateButtonInput, snapTurn, updateTeleport, onControllerSelect, updateHover, onTeleportStart, onTeleportEnd, _resetTeleportAim, _cancelTeleportIfAimedBy } from './interaction/inputRouting.js';
import { createSettingsPanel } from './ui/settingsPanel.js';

import { resolveWindowDistance, firePanelGrabFeedback } from './browser/WindowManager.js';
import { buildBrowsingSystems } from './browser/browsingSystems.js';
import { detectVideoFormat } from './media/videoProjection.js';

import { BookmarkStore } from '../utils/BookmarkStore.js';
import { loadPersistedSettings, saveSettings, updateSetting } from '../utils/settingsStore.js';
import { createHomeEnvironment } from './homeEnvironment.js';
import { setupRenderer, setupScene, setupCamera, setupControllers, setupVR } from './setupStages.js';
import { initializeSystems, dispose } from './systemsLifecycle.js';
import { onVRSessionStart, onVRSessionEnd, _detachPanelLayer } from './sessionLifecycle.js';
import { DeviceCompatibility } from '../utils/DeviceCompatibility.js';
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
  setupRenderer() {
    return setupRenderer(this);
  }

  setupScene() {
    return setupScene(this);
  }

  setupCamera() {
    return setupCamera(this);
  }

  setupControllers() {
    return setupControllers(this);
  }

  setupVR() {
    return setupVR(this);
  }

  async initializeSystems() {
    return initializeSystems(this);
  }

  dispose() {
    return dispose(this);
  }

  onTeleportStart(controller) {
    return onTeleportStart(this, controller);
  }

  onTeleportEnd() {
    return onTeleportEnd(this);
  }

  _resetTeleportAim() {
    return _resetTeleportAim(this);
  }

  _cancelTeleportIfAimedBy(controller) {
    return _cancelTeleportIfAimedBy(this, controller);
  }

  updateHover() {
    return updateHover(this);
  }

  _detachPanelLayer(layerId) {
    return _detachPanelLayer(this, layerId);
  }

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

  /**
   * Setup scene
   */

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

  /**
   * Set up WebXR controllers: ray pointer + rendered controller models, parented
   * to the player rig. Dispatches 'select' on hit so interactables can respond.
   */

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


  /**
   * Clear teleport-aim state (active/controller/marker) WITHOUT completing a
   * move — unlike onTeleportEnd(), which this factors the shared reset out
   * of. Used both by onTeleportEnd()'s tail and by a controller disconnect
   * mid-aim, where completing the teleport to a stale raycast target would be
   * the wrong behavior (the user never released the squeeze intentionally).
   */

  /**
   * Cancel (not complete) an in-progress teleport aim if `controller` is the
   * one currently aiming. A disconnect (headset removed, VR session ends, or
   * a hand-tracking handoff) only ever fires 'disconnected' — never
   * 'squeezeend' — for whatever buttons happen to be held. Without this, a
   * mid-aim teleport (squeeze held, never released) left teleport.active
   * stuck true and the marker frozen at its last raycast position
   * indefinitely, since updateTeleport() has no inputSource guard of its own.
   */

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

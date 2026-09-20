/**
 * VR Application Main Controller
 * Integrates all Tier 1 optimizations for production-ready performance
 *
 * John Carmack principle: Systems integration is where performance lives or dies
 */

// Tier 1 Optimizations

// Tier 2 Features
import { resolveComfortPreset } from './comfort/ComfortSystem.js';
import { getPerformanceStats } from './perfBudget.js';
import { AccessibilityCoordinator } from './accessibility/AccessibilityCoordinator.js';
import { osReducedMotion, getPrefs, largeTextScale } from '../a11y/accessibility.js';
import { t } from '../i18n/i18n.js';
import { showVRToast } from './ui/vrToast.js';
import { controllerRay } from './ui/canvasMesh.js';
import { updateLocomotion, updateButtonInput, updateTeleport, onControllerSelect, updateHover, onTeleportEnd, _resetTeleportAim, _cancelTeleportIfAimedBy, requestVRKeyboardInput } from './interaction/inputRouting.js';
import { onWebPanelToggleChanged } from './ui/settingsPanel.js';

import { resolveWindowDistance } from './browser/WindowManager.js';
import { buildBrowsingSystems, _attachManagedWindow, _onPanelGrabRequested, _teardownBrowsingSystems } from './browser/browsingSystems.js';
import { requestReaderProxyInput, clearBrowsingHistory } from './browser/browserActions.js';

import { BookmarkStore } from '../utils/BookmarkStore.js';
import { loadPersistedSettings, updateSetting } from '../utils/settingsStore.js';
import { createHomeEnvironment } from './homeEnvironment.js';
import { dispose } from './systemsLifecycle.js';
import { initialize, render } from './frameLoop.js';
import { onVRSessionStart, onVRSessionEnd } from './sessionLifecycle.js';
import { DeviceCompatibility } from '../utils/DeviceCompatibility.js';

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
    const persisted = loadPersistedSettings(this.settings);
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

    // Stored so the caller can await staged boot — a constructor cannot return
    // a promise, but an unawaited initialize() would turn every boot failure
    // into a silent unhandledrejection instead of the app's error UI.
    this.initPromise = this.initialize();
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
   * Update a single setting and persist. Returns the new value.
   */
  updateSetting(key, value) {
    return updateSetting(this.settings, key, value);
  }

  /**
   * Initialize VR application
   */
  dispose() {
    return dispose(this);
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

  getPerformanceStats() {
    return getPerformanceStats(this);
  }

  updateLocomotion(dt) {
    return updateLocomotion(this, dt);
  }

  updateButtonInput() {
    return updateButtonInput(this);
  }

  updateTeleport() {
    return updateTeleport(this);
  }

  async initialize() {
    return initialize(this);
  }

  render(timestamp, xrFrame) {
    return render(this, timestamp, xrFrame);
  }

  _attachManagedWindow() {
    return _attachManagedWindow(this);
  }

  _onPanelGrabRequested(controller) {
    return _onPanelGrabRequested(this, controller);
  }

  _teardownBrowsingSystems() {
    return _teardownBrowsingSystems(this);
  }

  _onWebPanelToggleChanged(enabled) {
    return onWebPanelToggleChanged(this, enabled);
  }

  _requestReaderProxyInput() {
    return requestReaderProxyInput(this);
  }

  _clearBrowsingHistory() {
    return clearBrowsingHistory(this);
  }

  _requestVRKeyboardInput(prefill, onConfirm, prompt) {
    return requestVRKeyboardInput(this, prefill, onConfirm, prompt);
  }

  /**
   * Setup WebGL renderer
   */

  /**
   * Setup scene
   */

  // Context object handed to the ui/settingsButtons factories — keeps them
  // module-pure while reusing this instance's caches, registry and settings.

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

  /**
   * Expand / collapse one settings section and rebuild the panel.
   *
   * The panel's height and every row position depend on which sections are
   * open, so this rebuilds rather than hiding meshes in place: leaving stale
   * interactables registered at their old positions is how a panel ends up
   * with invisible controls that still take clicks.
   *
   * @param {string} sectionId

  /**
   * Repaint all settings-panel buttons in their idle (non-hover) state.
   * Called after appearance-affecting settings change (e.g. high-contrast) so
   * the whole panel updates atomically rather than one button at a time.

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

  /**
   * Clear all persisted browsing history (privacy). Fires a cross-modal
   * confirmation (caption + haptic + toast + semantic DOM) via showVRToast so
   * the destructive action is acknowledged on every channel (WCAG 4.1.3). If a
   * bookmark/history panel is open, refresh it so the cleared list shows.

  /**
   * Build the in-VR settings panel: a backing quad plus toggle buttons wired to
   * the runtime settings (all effects are immediate and safe).
   */
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
   * onSelect handler. On release, ends an
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

  /**
   * Register interaction sounds. No audio files are shipped — all feedback
   * sounds are short synthesized tones registered as procedural buffers.

  /**
   * Setup WebXR
   */
  onVRSessionEnd() {
    return onVRSessionEnd(this);
  }

  onControllerSelect(controller, isStart) {
    return onControllerSelect(this, controller, isStart);
  }

}

/**
 * Usage Example:
 *
 * const app = new VRApp(document.getElementById('app-container'));
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

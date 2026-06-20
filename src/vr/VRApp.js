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
import { LayersSystem } from './rendering/LayersSystem.js';
import { ComfortSystem, resolveComfortPreset, snapTurnLabel, fireTeleportFeedback, smoothMoveWarning } from './comfort/ComfortSystem.js';
import { ObjectPool, PoolManager } from '../utils/ObjectPool.js';
import { TextureManager } from '../utils/TextureManager.js';

// Tier 2 Features
import { JapaneseIME, VRJapaneseKeyboard } from './input/JapaneseIME.js';
import { VRControllerInput } from './input/VRControllerInput.js';
import { HandTracking } from './interaction/HandTracking.js';
import { HapticFeedback } from './interaction/HapticFeedback.js';
import { GazeInteraction } from './interaction/GazeInteraction.js';
import { CaptionSystem } from './accessibility/CaptionSystem.js';
import { notifyCrossModal, withSeverity, toastColors, toastFontPx, voiceCommandFeedback, voiceCommandFailedFeedback, voiceErrorNotification } from './accessibility/crossModal.js';
import { osReducedMotion, getPrefs, setPref, largeTextScale, prefersHighContrast } from '../a11y/accessibility.js';
import { buttonBg, buttonLineWidth, toggleIndicatorColors, buttonAccentColor } from './ui/buttonStyle.js';
import { SpatialAudio } from './audio/SpatialAudio.js';
import { MixedReality } from './ar/MixedReality.js';
import { ProgressiveLoader } from '../utils/ProgressiveLoader.js';

// Tier 3 / optional features (opt-in via settings, default off)
import { AIRecommendation } from '../ai/AIRecommendation.js';
import { VoiceCommands } from './input/VoiceCommands.js';
import { MultiplayerSystem } from './multiplayer/MultiplayerSystem.js';
import { AvatarSystem } from './multiplayer/AvatarSystem.js';
import { TabManager } from './browser/TabManager.js';
import { WindowManager, resolveWindowDistance } from './browser/WindowManager.js';
import { BookmarkPanel } from './browser/BookmarkPanel.js';
import { ImmersiveVideo } from './media/ImmersiveVideo.js';
import { detectVideoFormat } from './media/videoProjection.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';

import { BookmarkStore } from '../utils/BookmarkStore.js';
import { DeviceCompatibility } from '../utils/DeviceCompatibility.js';
import { disposeMonitoring } from '../monitoring.js';
import { stepValue, stepperRegion, formatValue, settingsButtonCaption, shouldAnnounceSettingsButton } from './settingsStepper.js';

// localStorage key for persisted user settings overrides.
const SETTINGS_KEY = 'qui-browser:settings';

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
    this.poolManager = null;
    this.textureManager = null;

    // Tier 2 systems
    this.japaneseIME = null;
    this.vrKeyboard = null;
    this.handTracking = null;
    this.hapticFeedback = null;
    this.gazeInteraction = null;
    this.captionSystem = null;
    this.spatialAudio = null;
    this.mixedReality = null;
    this.progressiveLoader = null;

    // Tier 3 systems (opt-in)
    this.aiRecommendation = null;
    this.voiceCommands = null;
    this.multiplayerSystem = null;
    this.avatarSystem = null;
    this.webPanel = null;
    this.tabManager = null;
    this.windowManager = null;
    this.bookmarkPanel = null;
    this.devTools = null;
    this.perfMonitorUI = null;
    this.webGPURenderer = null;
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
    this.interactables = []; // meshes registered with select/hover handlers
    this.settingsPanel = null;
    this.immersiveVideo = null; // 360°/180° video player (created in initializeSystems)
    this._panelTextures = []; // CanvasTextures to dispose on teardown

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
      maxFPS: 120,          // Quest 3 capability
      motionSensitivity: 'moderate',
      enableFFR: true,
      enableComfort: true,
      enableObjectPooling: true,
      enableTextureCompression: true,
      // Default home environment (floor + grid + sky + welcome panel). Doubles
      // as a static comfort "rest frame"; without it the scene is an empty void.
      enableHomeEnvironment: true,
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
      // In-VR settings panel (toggle buttons).
      enableSettingsPanel: true,
      // FR-13.1: gaze-dwell selection (hands-free accessibility). Look at an
      // interactable for gazeDwellTime ms to activate it. OFF by default.
      enableGazeDwell: false,
      gazeDwellTime: 1500, // ms
      // FR-13.1: in-VR captions/subtitles for recognized speech & system
      // events (accessibility). OFF by default.
      enableCaptions: false,

      enableWebPanel: false,  // FR-1.1: in-VR browsing panel (experimental)
      // Default search engine for non-URL input in the address bar
      // (key into urlResolver.SEARCH_ENGINES: duckduckgo|google|bing|ecosia).
      searchEngine: 'duckduckgo',
      // Spatial window management (parity with Wolvic/Quest browser): head-lock
      // follow keeps the active panel centred in view. OFF by default.
      enableWindowFollow: false,
      windowDistance: 2.0, // metres
      // Curved-screen mode for the browser content area (Quest-style). OFF.
      enableCurvedPanel: false,
      // Tier 3 / optional features — opt-in, default off so the base
      // experience is unchanged. Heavy/experimental features stay off.
      enableAI: false,
      enableVoice: false,
      enableMultiplayer: false,
      enablePerfMonitorUI: false,
      enableWebGPU: false, // experimental
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

  /**
   * Load persisted settings overrides from localStorage. Returns {} when none
   * exist or storage is unavailable. Only known keys are accepted so stale or
   * malformed entries cannot inject arbitrary fields.
   */
  loadPersistedSettings() {
    try {
      if (typeof localStorage === 'undefined') {
        return {};
      }
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }
      const allowed = {};
      for (const key of Object.keys(this.settings)) {
        if (key in parsed) {
          allowed[key] = parsed[key];
        }
      }
      return allowed;
    } catch (e) {
      console.warn('VRApp: failed to load persisted settings', e);
      return {};
    }
  }

  /**
   * Persist the current settings to localStorage. Safe to call from setting
   * toggles/UI; no-ops when storage is unavailable.
   */
  saveSettings() {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('VRApp: failed to persist settings', e);
    }
  }

  /**
   * Update a single setting and persist. Returns the new value.
   */
  updateSetting(key, value) {
    this.settings[key] = value;
    this.saveSettings();
    return value;
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

    // Start render loop
    this.renderer.setAnimationLoop(this.render.bind(this));

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
    if (this.settings.enableHomeEnvironment) {
      this.homeEnvironment = this.createHomeEnvironment();
      this.scene.add(this.homeEnvironment);
    }

    // Immersive 360°/180° video player. Lightweight until play() is called
    // (no video element or sphere is created up front), so it is always
    // available and launched on demand from the settings panel.
    this.immersiveVideo = new ImmersiveVideo(this.scene, this.camera, this.renderer, {
      registerInteractable: (m, h) => this.registerInteractable(m, h),
      unregisterInteractable: (m) => this.unregisterInteractable(m),
      onError: (msg) => this.showVRToast(msg, { type: 'error' }),
      onPlaybackChange: (state) => {
        if (this.captionSystem && this.captionSystem.enabled) {
          this.captionSystem.show(state === 'playing' ? 'Video: playing' : 'Video: paused');
        }
      }
    });

    // In-VR settings panel (toggle buttons wired to the persisted settings).
    if (this.settings.enableSettingsPanel) {
      this.settingsPanel = this.createSettingsPanel();
      this.scene.add(this.settingsPanel);
    }

    // FR-1.1/1.3: in-VR web browsing with tabs (each tab is a WebPanel).
    if (this.settings.enableWebPanel) {
      this.tabManager = new TabManager({
        scene: this.scene,
        registerInteractable: (m, h) => this.registerInteractable(m, h),
        unregisterInteractable: (m) => this.unregisterInteractable(m),
        onNavigate: (url, title) => this.navigate(url, title),
        onLoadError: (url) => this.showVRToast(`Failed to load: ${url}`, { type: 'error' }),
        position: { x: 0, y: 1.5, z: -2 },
        // Replace window.prompt() with the VR keyboard.  vrKeyboard is
        // initialised in initializeSystems() before this block runs.
        onUrlInputRequested: (prefill, onConfirm) =>
          this._requestVRKeyboardInput(prefill, onConfirm),
        searchEngine: this.settings.searchEngine,
        // FR-1.4: star button in the chrome bar toggles a persistent bookmark.
        isBookmarked: (url) => this.bookmarks.isBookmarked(url),
        onToggleBookmark: (url, title) => {
          const nowBookmarked = this.bookmarks.toggleBookmark(url, title);
          if (this.captionSystem && this.captionSystem.enabled) {
            this.captionSystem.show(nowBookmarked ? 'Bookmarked' : 'Bookmark removed');
          }
          return nowBookmarked;
        }
      });
      this.tabManager.addToScene();
      if (this.settings.enableCurvedPanel) {
        this.tabManager.setCurved(true);
      }
      this.tabManager.newTab(); // start with one blank tab
      // Convenience alias: the active tab's panel.
      this.webPanel = this.tabManager.getActiveTab();

      // FR-1.4: in-VR bookmarks & history panel. Selecting an entry navigates
      // the active tab. Toggled via the settings panel "Bookmarks" button.
      this.bookmarkPanel = new BookmarkPanel({
        scene: this.scene,
        registerInteractable: (m, h) => this.registerInteractable(m, h),
        unregisterInteractable: (m) => this.unregisterInteractable(m),
        store: this.bookmarks,
        scale: largeTextScale(getPrefs().largeText),
        onSelect: (url) => {
          const active = this.tabManager ? this.tabManager.getActiveTab() : this.webPanel;
          if (active) {
            active.navigate(url);
          }
        }
      });
      this.bookmarkPanel.addToScene();
    }

    console.debug('VRApp: Scene created');
  }

  /**
   * Build a canvas-textured toggle button bound to a boolean setting. Selecting
   * it flips and persists the setting, applies an optional live effect, and
   * redraws the ON/OFF state. Returns the button mesh (already registered as
   * interactable).
   */
  makeToggleButton(label, key, apply) {
    const w = 512;
    const h = 96;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._panelTextures.push(tex);

    const draw = (hover) => {
      const on = !!this.settings[key];
      const hc = prefersHighContrast();
      const ind = toggleIndicatorColors(on, hc);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = buttonBg(hover, hc);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = ind.border;
      ctx.lineWidth = buttonLineWidth(hover, hc);
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(label, 24, 62);
      ctx.textAlign = 'right';
      ctx.fillStyle = ind.label;
      ctx.fillText(on ? 'ON' : 'OFF', w - 24, 62);
      tex.needsUpdate = true;
    };
    draw(false);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.17),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    this.registerInteractable(mesh, {
      onSelect: () => {
        const value = !this.settings[key];
        this.updateSetting(key, value); // flips + persists (FR-9.1)
        if (apply) {
          apply(value);
        }
        draw(true);
        this._announceSettingsButton('toggle', label, value, {}, true);
      },
      onHover: () => {
        draw(true);
        this._announceSettingsButton('toggle', label, !!this.settings[key]);
      },
      onHoverEnd: () => draw(false)
    });
    mesh._redraw = () => draw(false);
    return mesh;
  }

  /**
   * Half-width (compact) variant of makeToggleButton for 2-column panel layout.
   * Uses a 256×96 canvas so text renders correctly at the narrower geometry size.
   */
  makeCompactToggleButton(label, key, apply) {
    const w = 256;
    const h = 96;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._panelTextures.push(tex);

    const draw = (hover) => {
      const on = !!this.settings[key];
      const hc = prefersHighContrast();
      const ind = toggleIndicatorColors(on, hc);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = buttonBg(hover, hc);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = ind.border;
      ctx.lineWidth = buttonLineWidth(hover, hc);
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(label, 14, 58);
      ctx.textAlign = 'right';
      ctx.fillStyle = ind.label;
      ctx.fillText(on ? 'ON' : 'OFF', w - 14, 58);
      tex.needsUpdate = true;
    };
    draw(false);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.43, 0.17),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    this.registerInteractable(mesh, {
      onSelect: () => {
        const value = !this.settings[key];
        this.updateSetting(key, value);
        if (apply) {
          apply(value);
        }
        draw(true);
        this._announceSettingsButton('toggle', label, value, {}, true);
      },
      onHover: () => {
        draw(true);
        this._announceSettingsButton('toggle', label, !!this.settings[key]);
      },
      onHoverEnd: () => draw(false)
    });
    mesh._redraw = () => draw(false);
    return mesh;
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
  showVRToast(message, { type = 'error', duration = 4000 } = {}) {
    if (!this.isVREnabled || !this.camera) {
      return;
    }

    const W = 512, H = 80;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Honour the high-contrast / large-text accessibility preferences (same
    // signals as the 2D layer and the caption panel).
    const c = toastColors(type, prefersHighContrast());
    const fontPx = toastFontPx(largeTextScale(getPrefs().largeText));

    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = c.bdr;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    // Prefix a severity glyph so the level reads without relying on colour alone.
    const labeled = withSeverity(message, type);
    ctx.fillStyle = c.fg;
    ctx.font = `bold ${fontPx}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labeled.length > 60 ? labeled.slice(0, 57) + '…' : labeled, W / 2, H / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.085),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })
    );
    // Centred slightly below eye level, 0.8 m in front.
    mesh.position.set(0, -0.12, -0.8);
    mesh.renderOrder = 999; // always on top
    this.camera.add(mesh);

    setTimeout(() => {
      this.camera.remove(mesh);
      mesh.geometry.dispose();
      tex.dispose();
      mesh.material.dispose();
    }, duration);

    // Accessibility equity: a toast must never be conveyed by sight alone, so
    // mirror it onto every available non-visual channel (haptic + captions).
    // The caption gets the same severity-labelled text the panel shows.
    notifyCrossModal(this.hapticFeedback, this.captionSystem, labeled, type);
  }

  /**
   * Build a canvas-textured action button (no on/off state). Selecting it runs
   * the supplied callback. Used for one-shot actions like opening a panel.
   * Returns the button mesh (already registered as interactable).
   */
  makeActionButton(label, onSelect) {
    const w = 512;
    const h = 96;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._panelTextures.push(tex);

    const draw = (hover) => {
      const hc = prefersHighContrast();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = buttonBg(hover, hc);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = buttonAccentColor('#5e72e4', hc);
      ctx.lineWidth = buttonLineWidth(hover, hc);
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(label, 24, 62);
      ctx.textAlign = 'right';
      ctx.fillStyle = buttonAccentColor('#8fa0ff', hc);
      ctx.fillText('▸', w - 24, 62);
      tex.needsUpdate = true;
    };
    draw(false);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.17),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    this.registerInteractable(mesh, {
      onSelect: () => {
        if (onSelect) {
          onSelect();
        }
        draw(true);
        this._announceSettingsButton('action', label, undefined, {}, true);
      },
      onHover: () => {
        draw(true);
        this._announceSettingsButton('action', label);
      },
      onHoverEnd: () => draw(false)
    });
    mesh._redraw = () => draw(false);
    return mesh;
  }

  /**
   * Build a canvas-textured numeric stepper bound to a numeric setting:
   * [ −  |  label: value  |  + ]. Selecting the left/right region steps the
   * value (clamped to min/max, snapped to step), persists it, and runs an
   * optional live-apply callback. Returns the button mesh (registered).
   *
   * @param {string} label
   * @param {string} key   setting key in this.settings
   * @param {object} cfg   { min, max, step, unit, apply }
   */
  makeStepperButton(label, key, cfg) {
    const { min, max, step, unit = '', apply } = cfg;
    const w = 512;
    const h = 96;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._panelTextures.push(tex);

    const draw = (hover) => {
      const value = this.settings[key];
      const hc = prefersHighContrast();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = buttonBg(hover, hc);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = buttonAccentColor('#5e72e4', hc);
      ctx.lineWidth = buttonLineWidth(hover, hc);
      ctx.strokeRect(2, 2, w - 4, h - 4);
      // − / + glyphs at the edges
      ctx.fillStyle = buttonAccentColor('#8fa0ff', hc);
      ctx.font = 'bold 54px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('−', w * 0.12, h / 2 + 18);
      ctx.fillText('+', w * 0.88, h / 2 + 18);
      // label + value in the middle
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(`${label}: ${formatValue(value, { step, unit })}`, w / 2, h / 2 + 11);
      tex.needsUpdate = true;
    };
    draw(false);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.17),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );

    const applyStep = (delta) => {
      const next = stepValue(this.settings[key], delta, { min, max, step });
      if (next !== this.settings[key]) {
        this.updateSetting(key, next); // persists (FR-9.1)
        if (apply) {
          apply(next);
        }
        this._announceSettingsButton('stepper', label, next, { step, unit }, true);
      }
      draw(true);
    };

    this.registerInteractable(mesh, {
      onSelect: (point) => {
        // Map the hit point to a horizontal fraction of the button to decide
        // whether the − or + region was pressed.
        let u = 0.5;
        if (point && mesh.worldToLocal) {
          const local = mesh.worldToLocal(point.clone());
          u = (local.x / 0.9) + 0.5; // PlaneGeometry width is 0.9
        }
        const region = stepperRegion(u);
        if (region === 'decrement') {
          applyStep(-1);
        } else if (region === 'increment') {
          applyStep(1);
        } else {
          draw(true);
        }
      },
      onHover: () => {
        draw(true);
        this._announceSettingsButton('stepper', label, this.settings[key], { step, unit });
      },
      onHoverEnd: () => draw(false)
    });
    mesh._redraw = () => draw(false);
    return mesh;
  }

  /**
   * Build a canvas-textured cycle button that steps through a fixed list of
   * string options for a settings key. Selecting it advances to the next option
   * (wrapping), persists the setting, and calls an optional live-apply callback.
   * Returns the button mesh (already registered as interactable).
   *
   * @param {string}   label   displayed on the left
   * @param {string}   key     setting key in this.settings
   * @param {string[]} options ordered list of allowed values
   * @param {Function} [apply] called with newValue after each cycle step
   */
  makeCycleButton(label, key, options, apply) {
    const w = 512;
    const h = 96;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._panelTextures.push(tex);

    const draw = (hover) => {
      const current = this.settings[key];
      const hc = prefersHighContrast();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = buttonBg(hover, hc);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = buttonAccentColor('#e4a85e', hc);
      ctx.lineWidth = buttonLineWidth(hover, hc);
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(label, 24, 62);
      ctx.textAlign = 'right';
      ctx.fillStyle = buttonAccentColor('#ffcc88', hc);
      ctx.fillText(`${current} ▸`, w - 24, 62);
      tex.needsUpdate = true;
    };
    draw(false);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.17),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    this.registerInteractable(mesh, {
      onSelect: () => {
        const idx = options.indexOf(this.settings[key]);
        const next = options[(idx + 1) % options.length];
        this.updateSetting(key, next);
        if (apply) {
          apply(next);
        }
        draw(true);
        this._announceSettingsButton('cycle', label, next, {}, true);
      },
      onHover: () => {
        draw(true);
        this._announceSettingsButton('cycle', label, this.settings[key]);
      },
      onHoverEnd: () => draw(false)
    });
    mesh._redraw = () => draw(false);
    return mesh;
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
   * Build the in-VR settings panel: a backing quad plus toggle buttons wired to
   * the runtime settings (all effects are immediate and safe).
   */
  createSettingsPanel() {
    const group = new THREE.Group();
    group.name = 'settingsPanel';
    // Collect per-button redraw callbacks so that appearance-affecting setting
    // changes (e.g. high-contrast) can repaint the whole panel in one shot.
    this._settingsPanelDrawers = [];

    const items = [
      ['High Contrast', 'highContrast', (v) => {
        setPref('highContrast', v);
        this._redrawSettingsPanel();
        if (this.bookmarkPanel && this.bookmarkPanel.visible) {
          this.bookmarkPanel._draw();
        }
        // Caption backing switches between semi-transparent (normal) and fully
        // opaque (HC) — update live so the effect is immediate, not deferred
        // until the next VR session restart.
        if (this.captionSystem) {
          this.captionSystem.setHighContrast(v);
        }
      }],
      ['Teleport', 'enableTeleport', null],
      ['Snap Turn', 'enableSnapTurn', null],
      ['Smooth Move', 'enableSmoothMove', (v) => {
        const msg = smoothMoveWarning(v, osReducedMotion());
        if (msg) {
          this.showVRToast(msg, { type: 'warn' });
        }
      }],
      ['Comfort', 'enableComfort', null],
      ['Foveation', 'enableFFR', (v) => {
        if (this.ffrSystem) {
          v ? this.ffrSystem.enable(0.5) : this.ffrSystem.disable();
        }
      }],
      ['Gaze Select', 'enableGazeDwell', (v) => {
        if (this.gazeInteraction) {
          this.gazeInteraction.setEnabled(v);
        }
      }],
      ['Captions', 'enableCaptions', (v) => {
        if (this.captionSystem) {
          this.captionSystem.setEnabled(v);
          if (v) {
            this.captionSystem.show('Captions enabled');
          }
        }
      }],
      ['Follow View', 'enableWindowFollow', (v) => {
        if (this.windowManager) {
          this.windowManager.setFollow(v);
        }
      }],
      ['Curved', 'enableCurvedPanel', (v) => {
        if (this.tabManager) {
          this.tabManager.setCurved(v);
        } else if (this.webPanel && this.webPanel.setCurved) {
          this.webPanel.setCurved(v);
        }
      }]
    ];

    // Numeric steppers for tunable parameters that were previously code-only.
    const steppers = [
      ['Snap Angle', 'snapTurnAngle', { min: 15, max: 90, step: 15, unit: '°' }],
      ['Move Speed', 'smoothMoveSpeed', { min: 0.5, max: 4.0, step: 0.5, unit: ' m/s' }],
      ['Gaze Time', 'gazeDwellTime', {
        min: 500, max: 3000, step: 250, unit: 'ms',
        apply: (v) => {
          if (this.gazeInteraction) {
            this.gazeInteraction.dwellTime = v;
          }
        }
      }],
      ['Panel Dist', 'windowDistance', {
        min: 0.6, max: 6.0, step: 0.2, unit: ' m',
        apply: (v) => {
          if (this.windowManager) {
            this.windowManager.setDistance(v);
          }
        }
      }]
    ];

    // Cycle buttons for enumerated settings (currently code-only or keyboard-shortcut-only).
    const COMFORT_PRESETS = ['sensitive', 'moderate', 'tolerant', 'disabled'];
    const SEARCH_ENGINES  = ['duckduckgo', 'google', 'bing', 'ecosia'];
    const cycles = [
      ['Comfort', 'motionSensitivity', COMFORT_PRESETS, (v) => {
        if (this.comfortSystem) {
          this.comfortSystem.setPreset(v);
        }
      }],
      ['Search', 'searchEngine', SEARCH_ENGINES, (v) => {
        if (this.tabManager) {
          this.tabManager.setSearchEngine(v);
        }
      }]
    ];

    // Action buttons (non-toggle). Only shown when their target exists.
    const actions = [];
    // Immersive 360°/180° video: prompt for a URL (VR keyboard) and play it.
    actions.push(['360° Video', () => this._launchImmersiveVideo()]);
    if (this.settings.enableWebPanel) {
      actions.push(['Bookmarks', () => {
        if (this.bookmarkPanel) {
          this.bookmarkPanel.toggle();
        }
      }]);
    }

    // Adaptive vertical layout.  Toggle items are shown in two columns so the
    // panel stays compact enough for all controls to be reachable from eye level.
    const ROW = 0.18;            // metres between rows
    const PAD = 0.14;            // top/bottom padding
    const toggleRows = Math.ceil(items.length / 2);
    const rowCount = toggleRows + steppers.length + cycles.length + actions.length;
    const height = rowCount * ROW + PAD;

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, height),
      new THREE.MeshBasicMaterial({ color: 0x0a0d14, transparent: true, opacity: 0.6 })
    );
    group.add(bg);

    // Start at the top of the stack, centred about y=0.
    let y = ((rowCount - 1) * ROW) / 2;

    // Toggles: two compact buttons per row at ±0.27 m (gap = 0.02 m between them).
    for (let i = 0; i < items.length; i += 2) {
      const [la, ka, aa] = items[i];
      const left = this.makeCompactToggleButton(la, ka, aa);
      left.position.set(-0.27, y, 0.01);
      group.add(left);
      this._settingsPanelDrawers.push(left._redraw);
      if (i + 1 < items.length) {
        const [lb, kb, ab] = items[i + 1];
        const right = this.makeCompactToggleButton(lb, kb, ab);
        right.position.set(0.27, y, 0.01);
        group.add(right);
        this._settingsPanelDrawers.push(right._redraw);
      }
      y -= ROW;
    }
    for (const [label, key, cfg] of steppers) {
      const btn = this.makeStepperButton(label, key, cfg);
      btn.position.set(0, y, 0.01);
      group.add(btn);
      this._settingsPanelDrawers.push(btn._redraw);
      y -= ROW;
    }
    for (const [label, key, opts, apply] of cycles) {
      const btn = this.makeCycleButton(label, key, opts, apply);
      btn.position.set(0, y, 0.01);
      group.add(btn);
      this._settingsPanelDrawers.push(btn._redraw);
      y -= ROW;
    }
    for (const [label, onSelect] of actions) {
      const btn = this.makeActionButton(label, onSelect);
      btn.position.set(0, y, 0.01);
      group.add(btn);
      this._settingsPanelDrawers.push(btn._redraw);
      y -= ROW;
    }

    // Front-left of the user, angled toward them.
    group.position.set(-1.4, 1.5, -2.0);
    group.rotation.y = Math.PI / 8;
    return group;
  }

  /**
   * Build a lightweight default environment: gradient sky dome, floor with a
   * reference grid, and a welcome panel. Kept cheap for Quest-class GPUs
   * (basic materials, no shadows). Returns a Group added to the scene.
   */
  createHomeEnvironment() {
    const env = new THREE.Group();
    env.name = 'homeEnvironment';

    // Gradient sky dome (inside-out sphere, vertex-interpolated colors).
    const skyGeo = new THREE.SphereGeometry(500, 24, 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1b2a4a) },
        bottomColor: { value: new THREE.Color(0x0a0d14) }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp((normalize(vWorldPos).y + 1.0) * 0.5, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
        }
      `
    });
    env.add(new THREE.Mesh(skyGeo, skyMat));

    // Floor (subtle, non-reflective).
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x141821 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.name = 'floor';
    this.floorMesh = floor; // teleport target surface
    env.add(floor);

    // Reference grid — a static rest frame that reduces vection/sickness.
    const grid = new THREE.GridHelper(60, 60, 0x335577, 0x223344);
    grid.position.y = 0.001; // avoid z-fighting with the floor
    env.add(grid);

    // Welcome panel rendered from a canvas texture.
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#3a6ea5';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px sans-serif';
    ctx.fillText('Qui Browser VR', canvas.width / 2, 120);
    ctx.fillStyle = '#a0b4d0';
    ctx.font = '40px sans-serif';
    ctx.fillText('Welcome — look around to begin', canvas.width / 2, 190);

    const panelTex = new THREE.CanvasTexture(canvas);
    panelTex.colorSpace = THREE.SRGBColorSpace;
    this._homePanelTexture = panelTex; // kept for explicit disposal
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.6),
      new THREE.MeshBasicMaterial({ map: panelTex, transparent: true })
    );
    panel.position.set(0, 1.6, -2.5);
    env.add(panel);

    // Make the panel a working "Recenter" button (also exercises the
    // interactable + hover pipeline end-to-end).
    this.registerInteractable(panel, {
      onSelect: () => this.recenter(),
      onHover: () => panel.material.color.set(0x88bbff),
      onHoverEnd: () => panel.material.color.set(0xffffff)
    });

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
      const active = this.tabManager && this.tabManager.getActiveTab();
      if (active && active.group) {
        this.windowManager.attach(active.group);
      }
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
      deadZone: this.settings.controllerDeadZone,
      southpaw: this.settings.southpaw
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
        controller.userData.inputSource = e.data;
        const name = this.controllerInput.getDeviceName(e.data);
        console.debug(`VRApp: Controller connected — ${name}`);
      });
      controller.addEventListener('disconnected', () => {
        if (controller.userData.inputSource) {
          this.controllerInput.forget(controller.userData.inputSource);
        }
        controller.userData.inputSource = null;
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

  /** Build a world-space raycaster from a controller's pose. */
  raycasterFromController(controller) {
    const m = new THREE.Matrix4().extractRotation(controller.matrixWorld);
    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(m);
    return raycaster;
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
    t.active = false;
    t.valid = false;
    t.controller = null;
    if (t.marker) {
      t.marker.visible = false;
    }
  }

  /**
   * Per-frame locomotion input: snap turn on the right thumbstick. Rotates the
   * whole player rig about the head so the user spins in place. (Smooth-move on
   * the left stick is intentionally deferred until comfort-vignette coupling is
   * wired, since continuous motion is the main sickness trigger.)
   */
  updateLocomotion(dt = 0.016) {
    if (!this.playerRig) {
      return;
    }

    // Southpaw swaps which hand drives snap-turn (typically right) vs move (left).
    const turnHand  = this.settings.southpaw ? 'left'  : 'right';
    const moveHand  = this.settings.southpaw ? 'right' : 'left';
    // Snap activation and hysteresis thresholds.
    const snapThreshold = 0.7;
    const snapRelease   = 0.3;

    let smoothMoving = false;
    for (const controller of this.controllers) {
      const src = controller.userData.inputSource;
      if (!src) {
        continue;
      }

      // Use profile-aware axis reading with configured dead zone.
      const snap = this.controllerInput
        ? this.controllerInput.read(src)
        : { axes: { stickX: 0, stickY: 0 }, buttons: {}, hand: src.handedness };

      const { stickX: x = 0, stickY: y = 0 } = snap.axes;

      // Turn hand: snap turn.
      if (this.settings.enableSnapTurn && snap.hand === turnHand) {
        if (Math.abs(x) > snapThreshold && !controller.userData.snapLatched) {
          this.snapTurn(x > 0 ? -1 : 1, snap.hand); // push right → turn clockwise
          controller.userData.snapLatched = true;
        } else if (Math.abs(x) < snapRelease) {
          controller.userData.snapLatched = false;
        }
      }

      // Move hand: smooth locomotion (opt-in) in the head's facing plane.
      if (this.settings.enableSmoothMove && snap.hand === moveHand && Math.hypot(x, y) > 0) {
        const q = new THREE.Quaternion();
        this.camera.getWorldQuaternion(q);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        right.y = 0;
        right.normalize();
        const move = new THREE.Vector3()
          .addScaledVector(forward, -y) // stick up → forward
          .addScaledVector(right, x);
        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(this.settings.smoothMoveSpeed * dt);
          this.playerRig.position.add(move);
          smoothMoving = true;
        }
      }
    }

    // Engage the comfort vignette while continuously moving.
    if (this.comfortSystem) {
      this.comfortSystem.externalMotion = smoothMoving;
    }
  }

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
  updateButtonInput() {
    if (!this.controllerInput) {
      return;
    }

    // Which hand is which depends on southpaw setting.
    const pointerHand = this.settings.southpaw ? 'left'  : 'right';
    const utilityHand = this.settings.southpaw ? 'right' : 'left';

    for (const controller of this.controllers) {
      const src = controller.userData.inputSource;
      if (!src) {
        continue;
      }

      const snap = this.controllerInput.read(src);
      const hand = snap.hand;
      const btn  = snap.buttons;

      // Play a brief haptic click for any face/thumb button press.
      const anyJustPressed = Object.values(btn).some(b => b.justPressed);
      if (anyJustPressed && this.hapticFeedback) {
        this.hapticFeedback.playPattern(hand, 'click');
      }

      if (hand === pointerHand) {
        // Browser navigation — available only when a tab is open.
        const tab = this.tabManager?.getActiveTab();
        if (tab) {
          if (btn.faceA?.justPressed) {
            tab.goForward?.();
          }
          if (btn.faceB?.justPressed) {
            tab.goBack?.();
          }
        }
        // Recenter: snap the player rig back to the origin.
        if (btn.thumbstickClick?.justPressed) {
          this.recenter();
        }

      } else if (hand === utilityHand) {
        // Toggle bookmarks/history panel.
        if (btn.faceA?.justPressed && this.bookmarkPanel) {
          this.bookmarkPanel.toggle();
        }
        // Toggle settings panel.
        if ((btn.faceB?.justPressed || btn.menu?.justPressed) && this.settingsPanel) {
          this.settingsPanel.visible = !this.settingsPanel.visible;
          this.settingsPanel.mesh && (this.settingsPanel.mesh.visible = this.settingsPanel.visible);
          // Caption so users who rely on text feedback know whether the panel
          // opened or closed — the face/menu button click haptic is generic
          // and doesn't distinguish panel-open from panel-close.
          if (this.captionSystem && this.captionSystem.enabled) {
            this.captionSystem.show(`Settings: ${this.settingsPanel.visible ? 'open' : 'closed'}`);
          }
        }
        // Toggle VR keyboard.
        if (btn.thumbstickClick?.justPressed && this.vrKeyboard) {
          this.vrKeyboard.visible ? this.vrKeyboard.hide() : this.vrKeyboard.show();
          if (this.captionSystem && this.captionSystem.enabled) {
            this.captionSystem.show(`Keyboard: ${this.vrKeyboard.visible ? 'open' : 'closed'}`);
          }
        }
      }
    }
  }

  /** Rotate the player rig in place about the head by snapTurnAngle * direction. */
  snapTurn(direction, hand = null) {
    const angleDeg = this.settings.snapTurnAngle || 30;
    const angle = direction * THREE.MathUtils.degToRad(angleDeg);
    const head = new THREE.Vector3();
    this.camera.getWorldPosition(head);
    const up = new THREE.Vector3(0, 1, 0);
    // Rotate the rig's origin around the head pivot, then rotate its orientation;
    // together this keeps the head fixed while turning the world.
    this.playerRig.position.sub(head).applyAxisAngle(up, angle).add(head);
    this.playerRig.rotateOnWorldAxis(up, angle);

    // Haptic confirmation on the triggering hand — same lightweight pulse as a
    // button click. Fires for all users: the turn always deserves tactile
    // acknowledgement regardless of whether it was animated.
    if (this.hapticFeedback && hand) {
      this.hapticFeedback.playPattern(hand, 'click');
    }

    // Directional caption specifically for reduced-motion users: without the
    // eased rotation animation there is no visual cue that the world moved, so
    // a caption provides the second orientation channel (WCAG 1.3.3).
    if (osReducedMotion() && this.captionSystem && this.captionSystem.enabled) {
      this.captionSystem.show(snapTurnLabel(direction, angleDeg));
    }
  }

  /** Per-frame teleport aiming: project the controller ray onto the floor. */
  updateTeleport() {
    const t = this.teleport;
    if (!t.active || !t.controller || !this.floorMesh) {
      return;
    }
    const hit = this.raycasterFromController(t.controller).intersectObject(this.floorMesh, false)[0];
    if (hit) {
      t.valid = true;
      t.target = hit.point.clone();
      if (t.marker) {
        t.marker.position.set(hit.point.x, hit.point.y + 0.01, hit.point.z);
        t.marker.visible = true;
      }
    } else {
      t.valid = false;
      if (t.marker) {
        t.marker.visible = false;
      }
    }
  }

  /**
   * Handle a controller select. Raycasts the controller ray against the scene
   * and forwards a 'qui-select' event on the first hit object (interactables
   * can listen). Kept minimal until the interactable registry lands.
   */
  onControllerSelect(controller, isStart) {
    if (!isStart || this.interactables.length === 0) {
      return;
    }
    const hit = this.raycasterFromController(controller).intersectObjects(this.interactables, false)[0];
    if (!hit) {
      return;
    }
    const handlers = hit.object.userData.interactable;
    if (handlers && handlers.onSelect) {
      handlers.onSelect({ intersection: hit, controller });
    }
    // Haptic click on the selecting hand confirms that the trigger registered
    // on an interactable, giving tactile parity with face-button presses.
    if (this.hapticFeedback) {
      const hand = controller.userData?.inputSource?.handedness || 'right';
      this.hapticFeedback.playPattern(hand, 'click');
    }
    // Also emit a DOM-style event for any external listeners.
    if (hit.object.dispatchEvent) {
      hit.object.dispatchEvent({ type: 'qui-select', intersection: hit, controller });
    }
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
      const hit = this.raycasterFromController(controller).intersectObjects(this.interactables, false)[0];
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

    // Use progressive loader for efficient initialization
    this.progressiveLoader = new ProgressiveLoader();
    this.progressiveLoader.callbacks.onProgress = (data) => {
      console.debug(`VRApp: Loading ${data.item.name} (${data.progress * 100}%)`);
    };

    // === TIER 1 SYSTEMS ===

    // 1. Fixed Foveated Rendering
    if (this.settings.enableFFR) {
      this.ffrSystem = new FFRSystem();
      console.debug('VRApp: FFR system ready');
    }

    // 2. Comfort System
    if (this.settings.enableComfort) {
      this.comfortSystem = new ComfortSystem(
        this.scene,
        this.camera,
        this.renderer,
        { reduceMotion: osReducedMotion() }
      );
      this.comfortSystem.setPreset(this.settings.motionSensitivity);
      console.debug('VRApp: Comfort system initialized');
    }

    // 3. Object Pooling
    if (this.settings.enableObjectPooling) {
      this.poolManager = new PoolManager();

      // Register common pools
      this.poolManager.register('vector3', new ObjectPool(THREE.Vector3, 100, 1000));
      this.poolManager.register('quaternion', new ObjectPool(THREE.Quaternion, 50, 500));
      this.poolManager.register('matrix4', new ObjectPool(THREE.Matrix4, 20, 200));

      console.debug('VRApp: Object pools initialized');
    }

    // 4. Texture Manager with KTX2 support
    if (this.settings.enableTextureCompression) {
      this.textureManager = new TextureManager(this.renderer);
      await this.textureManager.initializeKTX2();
      console.debug('VRApp: Texture manager ready with KTX2 support');
    }

    // === TIER 2 SYSTEMS ===

    // 5. Japanese IME — pass interactable hooks so the 3D keyboard keys can be
    // selected with a controller ray.
    this.japaneseIME = new JapaneseIME();
    this.vrKeyboard = new VRJapaneseKeyboard(this.scene, this.japaneseIME, {
      registerInteractable: (m, h) => this.registerInteractable(m, h),
      unregisterInteractable: (m) => this.unregisterInteractable(m),
      // Larger keys (bigger targets) for the large-text accessibility preference.
      scale: largeTextScale(getPrefs().largeText)
    });
    console.debug('VRApp: Japanese IME ready');

    // 6. Hand Tracking
    this.handTracking = new HandTracking(this.renderer, this.scene);
    console.debug('VRApp: Hand tracking ready');

    // 6a. Haptic Feedback — wired to hand-tracking gesture callbacks in
    // onVRSessionStart() once a session and gamepads are available.
    this.hapticFeedback = new HapticFeedback();
    console.debug('VRApp: Haptic feedback ready');

    // 6b. Gaze-dwell interaction (FR-13.1, accessibility). Created always so it
    // can be toggled live from the settings panel; only active when enabled.
    this.gazeInteraction = new GazeInteraction(this.camera, {
      dwellTime: this.settings.gazeDwellTime,
      // Honour the OS reduced-motion preference: static activation cue, no fade.
      reduceMotion: osReducedMotion()
    });
    this.gazeInteraction.setEnabled(this.settings.enableGazeDwell);
    console.debug('VRApp: Gaze-dwell interaction ready');

    // 6c. In-VR captions (FR-13.1, accessibility). Created always so it can be
    // toggled live; only renders when enabled and lines are present.
    // Honour the user's accessibility preferences so low-vision users get
    // bigger, higher-contrast captions (reuses the same signals as the 2D layer).
    this.captionSystem = new CaptionSystem(this.camera, {
      // Captions get a deliberately larger boost (1.4) than other surfaces:
      // they are transient and read at a glance, so legibility matters more.
      scale: largeTextScale(getPrefs().largeText, 1.4),
      highContrast: prefersHighContrast()
    });
    this.captionSystem.setEnabled(this.settings.enableCaptions);
    console.debug('VRApp: Caption system ready');

    // 7. Spatial Audio
    try {
      this.spatialAudio = new SpatialAudio();
      await this.loadAudioAssets();
      console.debug('VRApp: Spatial audio initialized');
    } catch (e) {
      console.error('VRApp: Spatial audio init failed', e);
      this.showVRToast('Spatial audio unavailable', { type: 'warn' });
    }

    // 8. Mixed Reality
    try {
      this.mixedReality = new MixedReality(this.renderer, this.scene);
      const mrSupport = await this.mixedReality.checkSupport();
      console.debug('VRApp: Mixed reality support:', mrSupport);
    } catch (e) {
      console.error('VRApp: Mixed reality init failed', e);
      // Not user-facing — MR is an optional enhancement.
    }

    // === TIER 3 / OPTIONAL SYSTEMS (opt-in, default off) ===

    // 9. AI Recommendations (FR-8.1).
    if (this.settings.enableAI) {
      this.aiRecommendation = new AIRecommendation();
      await this.aiRecommendation.initialize();
      // Seed the model with persisted browse history from BookmarkStore so
      // recommendations are meaningful from the first session.
      const seedHistory = this.bookmarks.getHistory(50);
      seedHistory.forEach(entry => {
        this.aiRecommendation.trackVisit(entry.url, entry.title, 0);
      });
      console.debug(`VRApp: AI recommendations ready (seeded with ${seedHistory.length} history entries)`);
    }

    // 10. Voice Commands
    if (this.settings.enableVoice) {
      this.voiceCommands = new VoiceCommands();
      const voiceReady = await this.voiceCommands.initialize();
      if (voiceReady) {
        // FR-13.1: caption recognized speech so it is visible in VR.
        this.voiceCommands.callbacks.onTranscript = (transcript, confidence, isFinal) => {
          if (isFinal && this.captionSystem) {
            this.captionSystem.show(transcript);
          }
        };
        // Mirror spoken responses (confirmations / errors) to captions too, so a
        // user who can speak but not hear sees whether a command was understood.
        this.voiceCommands.callbacks.onSpeak = (text) => {
          if (this.captionSystem) {
            this.captionSystem.show(text);
          }
        };
        // Haptic confirmation on every successful voice command — parity with
        // controller presses, gaze-dwell activation, teleport, and snap turn.
        // Voice is a hands-free modality, so both hands receive the click pulse.
        this.voiceCommands.callbacks.onCommand = (_key, _result) => {
          voiceCommandFeedback(this.hapticFeedback);
        };
        // Distinct double-bump on failure (no match or action exception) so a
        // user not looking at captions knows to try again without audio.
        this.voiceCommands.callbacks.onCommandFailed = (_info) => {
          voiceCommandFailedFeedback(this.hapticFeedback);
        };
        // Surface speech-recognition errors as VR toasts with cross-modal
        // feedback. Without this the recognizer goes silent and the user has
        // no way of knowing voice commands stopped working.
        this.voiceCommands.callbacks.onError = (errorCode) => {
          const { message, type } = voiceErrorNotification(errorCode);
          this.showVRToast(message, { type });
        };
        // Replace window.* default commands with VR-aware implementations that
        // route navigation and search through the live TabManager.
        this.voiceCommands.connectBrowser({
          tabManager:    this.tabManager,
          bookmarkPanel: this.bookmarkPanel,
          vrKeyboard:    this.vrKeyboard,
          onSearch: (query) => {
            const active = this.tabManager?.getActiveTab?.();
            if (active) {
              active.navigate(query);
            }
          }
        });
        // Begin listening immediately (user granted mic permission during initialize).
        this.voiceCommands.start();
        console.debug('VRApp: Voice commands ready and listening');
      } else {
        console.warn('VRApp: Voice commands unavailable (browser support or permission denied)');
        this.voiceCommands = null;
      }
    }

    // 11. Multiplayer — requires a signaling server; connect() is called on
    // demand by the caller, not here.
    if (this.settings.enableMultiplayer) {
      this.multiplayerSystem = new MultiplayerSystem(this.scene, this.spatialAudio);
      // FR-7.2: avatar presence + spatial voice — geometric avatars and
      // spatialized voice streams for remote peers.
      this.avatarSystem = new AvatarSystem(this.scene, this.spatialAudio);
      // Cross-modal peer-presence events: toast (visual) + haptic + caption so
      // a deaf user or someone not looking at the panel knows a peer has
      // joined or left without relying on spatial audio alone.
      this.multiplayerSystem.onPeerConnected = (_peerId) => {
        this.showVRToast('Player joined', { type: 'info' });
      };
      this.multiplayerSystem.onPeerDisconnected = (_peerId) => {
        this.showVRToast('Player left', { type: 'warn' });
      };
      console.debug('VRApp: Multiplayer system ready (call connect() to join a room)');
    }

    // 12. DevTools (development builds only; hidden until toggled with F12).
    // Dynamically imported so it is dropped from production bundles.
    if (import.meta.env && import.meta.env.DEV) {
      const { DevTools } = await import('../dev/DevTools.js');
      this.devTools = new DevTools(this);
      this.devTools.initialize();
      console.debug('VRApp: DevTools ready (F12 to toggle)');
    }

    // 13. Performance monitor overlay (opt-in)
    if (this.settings.enablePerfMonitorUI) {
      this.perfMonitorUI = new PerformanceMonitor();
      this.perfMonitorUI.initialize();
      console.debug('VRApp: Performance monitor UI ready');
    }

    // 14. WebGPU renderer (experimental, opt-in). Gated behind capability
    // detection; not yet integrated into the THREE render loop, so it is
    // instantiated for availability/probing only.
    if (this.settings.enableWebGPU) {
      if (typeof navigator !== 'undefined' && navigator.gpu) {
        const { WebGPURenderer } = await import('./rendering/WebGPURenderer.js');
        this.webGPURenderer = new WebGPURenderer();
        console.debug('VRApp: WebGPU available (experimental; not wired into the render loop yet)');
      } else {
        console.warn('VRApp: WebGPU requested but navigator.gpu is unavailable');
      }
    }

    const loadTime = performance.now() - startTime;
    console.debug(`VRApp: All systems initialized in ${loadTime.toFixed(1)}ms`);
  }

  /**
   * Load audio assets progressively
   */
  async loadAudioAssets() {
    // Add audio files to progressive loader
    const audioFiles = [
      { url: '/assets/sounds/click.mp3', name: 'click', type: 'audio', priority: 'primary' },
      { url: '/assets/sounds/hover.mp3', name: 'hover', type: 'audio', priority: 'secondary' },
      { url: '/assets/sounds/success.mp3', name: 'success', type: 'audio', priority: 'secondary' },
      { url: '/assets/sounds/error.mp3', name: 'error', type: 'audio', priority: 'secondary' }
    ];

    for (const file of audioFiles) {
      this.progressiveLoader.addResource(file, file.priority);
    }

    // Start progressive loading
    await this.progressiveLoader.start();

    // Load into spatial audio system
    for (const file of audioFiles) {
      const audio = this.progressiveLoader.get(file.name);
      if (audio) {
        await this.spatialAudio.loadAudio(file.url, file.name);
      }
    }
  }

  /**
   * Setup WebXR
   */
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
  async onVRSessionStart() {
    console.debug('VRApp: VR session started');
    this.isVREnabled = true;

    // Get XR session
    const session = this.renderer.xr.getSession();

    // Headset removed / system menu shown / session blurred: the DOM
    // 'visibilitychange' wired in setupVR() does NOT fire for this while an
    // immersive session is presenting — XRSession.visibilityState
    // ('hidden' | 'visible-blurred') is the authoritative signal. Pause the
    // immersive video so audio doesn't keep playing to an empty headset.
    if (session) {
      this.onXRVisibilityChange = () => {
        if (session.visibilityState !== 'visible'
            && this.immersiveVideo && this.immersiveVideo.playing) {
          this.immersiveVideo.togglePause();
        }
      };
      session.addEventListener('visibilitychange', this.onXRVisibilityChange);
    }

    // Initialize FFR for this session
    const gl = this.renderer.getContext();
    if (this.ffrSystem && session) {
      await this.ffrSystem.initialize(session, gl);
      this.ffrSystem.enable(0.5);
      console.debug('VRApp: FFR enabled for session');
    }

    // FR-1.5: WebXR Layers for sharp browser-panel text.
    // Initialise the binding and, if supported, attach a quad layer to every
    // open WebPanel so the chrome bar renders at native display resolution.
    if (this.settings.enableWebPanel && session) {
      this.layersSystem = new LayersSystem();
      const layersOk = this.layersSystem.initialize(session, gl);
      if (layersOk) {
        this._attachLayersToPanels(session);
      }
    }

    // Update comfort system FOV baseline for VR (reset to device-appropriate value).
    if (this.comfortSystem) {
      this.comfortSystem.settings.fov.baseFOV = 90;
    }

    // Initialize hand tracking
    if (this.handTracking && session) {
      await this.handTracking.initialize(session);

      // Register gesture callbacks
      this.handTracking.onGesture('pinch', (hand, _gesture) => {
        console.debug(`${hand} hand pinch detected`);
        // Play spatial sound at pinch position
        if (this.spatialAudio) {
          const pos = this.handTracking.getPinchPosition(hand);
          if (pos) {
            this.spatialAudio.play('click', 'click', pos);
          }
        }
        // Haptic confirmation on pinch (lightweight click feel).
        if (this.hapticFeedback) {
          this.hapticFeedback.playPattern(hand, 'click');
        }
      });

      this.handTracking.onGesture('grab', (hand) => {
        if (this.hapticFeedback) {
          this.hapticFeedback.playPattern(hand, 'impact');
        }
      });

      this.handTracking.onGesture('point', (hand, _gesture) => {
        console.debug(`${hand} hand pointing`);
      });
    }

    // Adjust render settings for VR
    this.renderer.setPixelRatio(1); // Don't use device pixel ratio in VR
  }

  /**
   * Handle VR session end
   */
  onVRSessionEnd() {
    console.debug('VRApp: VR session ended');
    this.isVREnabled = false;

    // Disable FFR
    if (this.ffrSystem) {
      this.ffrSystem.disable();
    }

    // Restore desktop FOV baseline when leaving VR.
    if (this.comfortSystem) {
      this.comfortSystem.settings.fov.baseFOV = this.camera.fov || 90;
    }

    // FR-1.5: detach layers from panels and dispose binding.
    if (this.layersSystem) {
      const panels = this.tabManager
        ? this.tabManager.tabs
        : (this.webPanel ? [this.webPanel] : []);
      for (const panel of panels) {
        panel.disableLayerMode();
      }
      this.layersSystem.dispose();
      this.layersSystem = null;
    }

    // The immersive video only makes sense inside the session; tear it down with
    // it so audio/GPU/sphere don't outlive the context that justified them.
    if (this.immersiveVideo) {
      this.immersiveVideo.stop();
    }

    // The XRSession is discarded on end (its visibilitychange listener dies with
    // it); just drop our reference so a stale closure can't be reused.
    this.onXRVisibilityChange = null;

    // Restore render settings
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

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
      const quadLayer = this.layersSystem.createQuadLayer({
        id    : `panel_chrome_${i}`,
        space : refSpace,
        // Chrome bar: same physical dimensions as the Three.js chromeMesh
        // (PANEL_W=1.6m, CHROME_H fraction=0.08 of PANEL_H=1.0m → 0.08m).
        width  : 1.6,
        height : 0.08,
        pixelWidth  : 2048,
        pixelHeight : 164 // 1024*0.08*2 — native-res equivalent
      });
      if (quadLayer) {
        panel.enableLayerMode(quadLayer, this.layersSystem);
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
   * Main render loop
   */
  render(timestamp, xrFrame) {
    this.frameCount++;

    // Rich perf monitor — begin-frame timing.
    if (this.perfMonitorUI) {
      this.perfMonitorUI.beginFrame();
    }

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

    // Rich perf monitor — end-frame metrics + UI.
    if (this.perfMonitorUI) {
      this.perfMonitorUI.endFrame(this.renderer);
    }

    // Dynamic quality adjustment (every 60 frames)
    if (this.frameCount % 60 === 0) {
      this.adjustQuality();
    }
  }

  /**
   * Update all systems
   */
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

    // Update mixed reality
    if (this.mixedReality && this.mixedReality.enabled && xrFrame) {
      this.mixedReality.update(xrFrame);
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
      // Track tab switches so the manager always drives the visible panel.
      const active = this.tabManager ? this.tabManager.getActiveTab() : this.webPanel;
      if (active && active.group && this.windowManager.target !== active.group) {
        this.windowManager.attach(active.group);
      }
      this.windowManager.update(dt * 1000);
    }

    // Keep the immersive video sphere centred on the head while it plays.
    if (this.immersiveVideo) {
      this.immersiveVideo.update(dt);
    }

    // Update scene objects using pools
    this.updateSceneWithPools();
  }

  /**
   * Detect user motion (simplified)
   */
  detectMotion() {
    if (!this.renderer.xr.isPresenting) {
      return false;
    }

    const session = this.renderer.xr.getSession();
    if (!session) {
      return false;
    }

    // In production, check controller velocity
    // For now, return false (stationary)
    return false;
  }

  /**
   * Example: Update scene using object pools
   */
  updateSceneWithPools() {
    if (!this.poolManager) {
      return;
    }

    // Example: Get temporary vectors from pool
    const vectorPool = this.poolManager.getPool('vector3');
    if (vectorPool) {
      const tempVector = vectorPool.acquire();

      // Use vector for calculations
      tempVector.set(
        Math.sin(this.frameCount * 0.01),
        0,
        Math.cos(this.frameCount * 0.01)
      );

      // Release back to pool when done
      vectorPool.release(tempVector);
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
   * Load texture using optimized texture manager
   */
  async loadTexture(url, options = {}) {
    if (this.textureManager) {
      return await this.textureManager.loadTexture(url, options);
    } else {
      // Fallback to standard Three.js loader
      const loader = new THREE.TextureLoader();
      return await loader.loadAsync(url);
    }
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
  _requestVRKeyboardInput(prefill, onConfirm) {
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
    });
  }

  /**
   * Navigate to a URL: records the visit in BookmarkStore history and feeds
   * it to the AI recommendation engine.  Call this whenever the in-VR panel
   * loads a new page (FR-1.1 prerequisite infrastructure).
   */
  navigate(url, title = url) {
    this.bookmarks.addHistory(url, title);
    if (this.aiRecommendation) {
      this.aiRecommendation.trackVisit(url, title, 0);
    }
    // Caption the page title so caption-enabled users who aren't looking at the
    // URL bar know which page loaded — the visual chrome update is the primary
    // channel but only helps users whose gaze is already on the panel.
    if (this.captionSystem && this.captionSystem.enabled) {
      let label = title !== url ? title : url;
      if (label === url) {
        try { label = new URL(url).hostname || url; } catch (_) { /* keep url as label */ }
      }
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

    if (this.textureManager) {
      const memStats = this.textureManager.getMemoryStats();
      stats.textureMemory = memStats.usedMB + '/' + memStats.maxMB + 'MB';
      stats.textureCompression = memStats.compressionRatio;
    }

    if (this.poolManager) {
      const poolStats = this.poolManager.getGlobalStats();
      stats.pooledObjects = poolStats.totalObjects;
      stats.gcPrevented = poolStats.totalGCPrevented;
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
    if (this.textureManager) {
      this.textureManager.dispose();
    }
    if (this.poolManager) {
      this.poolManager.dispose();
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
    if (this.spatialAudio) {
      this.spatialAudio.dispose();
    }
    if (this.mixedReality) {
      this.mixedReality.dispose();
    }
    if (this.progressiveLoader) {
      this.progressiveLoader.dispose();
    }
    if (this.aiRecommendation) {
      this.aiRecommendation.dispose();
    }
    if (this.voiceCommands) {
      this.voiceCommands.dispose();
    }
    if (this.multiplayerSystem) {
      this.multiplayerSystem.disconnect();
    }
    if (this.avatarSystem) {
      this.avatarSystem.dispose();
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
    if (this.perfMonitorUI) {
      this.perfMonitorUI.dispose();
    }
    if (this.webGPURenderer && this.webGPURenderer.dispose) {
      this.webGPURenderer.dispose();
    }
    if (this._homePanelTexture) {
      this._homePanelTexture.dispose();
    }
    if (this._panelTextures) {
      this._panelTextures.forEach((t) => t.dispose());
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
 * // Load optimized texture
 * const texture = await app.loadTexture('assets/wood.ktx2', {
 *   preferKTX2: true
 * });
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

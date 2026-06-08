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
import { ComfortSystem } from './comfort/ComfortSystem.js';
import { ObjectPool, PoolManager } from '../utils/ObjectPool.js';
import { TextureManager } from '../utils/TextureManager.js';

// Tier 2 Features
import { JapaneseIME, VRJapaneseKeyboard } from './input/JapaneseIME.js';
import { HandTracking } from './interaction/HandTracking.js';
import { SpatialAudio } from './audio/SpatialAudio.js';
import { MixedReality } from './ar/MixedReality.js';
import { ProgressiveLoader } from '../utils/ProgressiveLoader.js';

// Tier 3 / optional features (opt-in via settings, default off)
import { AIRecommendation } from '../ai/AIRecommendation.js';
import { VoiceCommands } from './input/VoiceCommands.js';
import { MultiplayerSystem } from './multiplayer/MultiplayerSystem.js';
import { AvatarSystem } from './multiplayer/AvatarSystem.js';
import { WebPanel } from './browser/WebPanel.js';
import { TabManager } from './browser/TabManager.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';

import { BookmarkStore } from '../utils/BookmarkStore.js';
import { DeviceCompatibility } from '../utils/DeviceCompatibility.js';

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
    this.devTools = null;
    this.perfMonitorUI = null;
    this.webGPURenderer = null;
    this.homeEnvironment = null;

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
    this.floorMesh = null;
    this.teleport = { active: false, controller: null, marker: null, target: null, valid: false };
    this.interactables = []; // meshes registered with select/hover handlers
    this.settingsPanel = null;
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
      // In-VR settings panel (toggle buttons).
      enableSettingsPanel: true,
      enableWebPanel: false,  // FR-1.1: in-VR browsing panel (experimental)
      // Tier 3 / optional features — opt-in, default off so the base
      // experience is unchanged. Heavy/experimental features stay off.
      enableAI: false,
      enableVoice: false,
      enableMultiplayer: false,
      enablePerfMonitorUI: false,
      enableWebGPU: false // experimental
    };

    // Merge any persisted user overrides (settings survive reloads).
    Object.assign(this.settings, this.loadPersistedSettings());

    this.initialize();
  }

  /**
   * Load persisted settings overrides from localStorage. Returns {} when none
   * exist or storage is unavailable. Only known keys are accepted so stale or
   * malformed entries cannot inject arbitrary fields.
   */
  loadPersistedSettings() {
    try {
      if (typeof localStorage === 'undefined') return {};
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const allowed = {};
      for (const key of Object.keys(this.settings)) {
        if (key in parsed) allowed[key] = parsed[key];
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
      if (typeof localStorage === 'undefined') return;
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
    console.log('VRApp: Initializing Qui Browser VR v2.0.0');

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

    console.log('VRApp: Initialization complete');
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

    console.log('VRApp: Renderer initialized');
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
        position: { x: 0, y: 1.5, z: -2 }
      });
      this.tabManager.addToScene();
      this.tabManager.newTab(); // start with one blank tab
      // Convenience alias: the active tab's panel.
      this.webPanel = this.tabManager.getActiveTab();
    }

    console.log('VRApp: Scene created');
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
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = hover ? 'rgba(40,60,90,0.95)' : 'rgba(16,20,30,0.92)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = on ? '#44ff88' : '#667788';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(label, 24, 62);
      ctx.textAlign = 'right';
      ctx.fillStyle = on ? '#44ff88' : '#8899aa';
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
        if (apply) apply(value);
        draw(true);
      },
      onHover: () => draw(true),
      onHoverEnd: () => draw(false)
    });
    return mesh;
  }

  /**
   * Build the in-VR settings panel: a backing quad plus toggle buttons wired to
   * the runtime settings (all effects are immediate and safe).
   */
  createSettingsPanel() {
    const group = new THREE.Group();
    group.name = 'settingsPanel';

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.35),
      new THREE.MeshBasicMaterial({ color: 0x0a0d14, transparent: true, opacity: 0.6 })
    );
    group.add(bg);

    const items = [
      ['Teleport', 'enableTeleport', null],
      ['Snap Turn', 'enableSnapTurn', null],
      ['Smooth Move', 'enableSmoothMove', null],
      ['Comfort', 'enableComfort', null],
      ['Foveation', 'enableFFR', (v) => {
        if (this.ffrSystem) { v ? this.ffrSystem.enable(0.5) : this.ffrSystem.disable(); }
      }]
    ];

    let y = 0.46;
    for (const [label, key, apply] of items) {
      const btn = this.makeToggleButton(label, key, apply);
      btn.position.set(0, y, 0.01);
      group.add(btn);
      y -= 0.22;
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
  }

  /**
   * Set up WebXR controllers: ray pointer + rendered controller models, parented
   * to the player rig. Dispatches 'select' on hit so interactables can respond.
   */
  setupControllers() {
    const factory = new XRControllerModelFactory();

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
      // Keep the live XRInputSource so we can read the thumbstick (snap turn).
      controller.addEventListener('connected', (e) => { controller.userData.inputSource = e.data; });
      controller.addEventListener('disconnected', () => { controller.userData.inputSource = null; });
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

    console.log('VRApp: Controllers ready');
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
    if (!this.settings.enableTeleport || !this.floorMesh) return;
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
    }
    t.active = false;
    t.valid = false;
    t.controller = null;
    if (t.marker) t.marker.visible = false;
  }

  /**
   * Per-frame locomotion input: snap turn on the right thumbstick. Rotates the
   * whole player rig about the head so the user spins in place. (Smooth-move on
   * the left stick is intentionally deferred until comfort-vignette coupling is
   * wired, since continuous motion is the main sickness trigger.)
   */
  updateLocomotion(dt = 0.016) {
    if (!this.playerRig) return;

    let smoothMoving = false;
    for (const controller of this.controllers) {
      const src = controller.userData.inputSource;
      if (!src || !src.gamepad) continue;
      const axes = src.gamepad.axes;
      const x = axes.length >= 4 ? axes[2] : (axes[0] || 0); // thumbstick X
      const y = axes.length >= 4 ? axes[3] : (axes[1] || 0); // thumbstick Y

      // Right stick: snap turn.
      if (this.settings.enableSnapTurn && src.handedness === 'right') {
        if (Math.abs(x) > 0.7 && !controller.userData.snapLatched) {
          this.snapTurn(x > 0 ? -1 : 1); // push right → turn clockwise
          controller.userData.snapLatched = true;
        } else if (Math.abs(x) < 0.3) {
          controller.userData.snapLatched = false;
        }
      }

      // Left stick: smooth move (opt-in) in the head's facing plane.
      if (this.settings.enableSmoothMove && src.handedness === 'left' && Math.hypot(x, y) > 0.15) {
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
    if (this.comfortSystem) this.comfortSystem.externalMotion = smoothMoving;
  }

  /** Rotate the player rig in place about the head by snapTurnAngle * direction. */
  snapTurn(direction) {
    const angle = direction * THREE.MathUtils.degToRad(this.settings.snapTurnAngle || 30);
    const head = new THREE.Vector3();
    this.camera.getWorldPosition(head);
    const up = new THREE.Vector3(0, 1, 0);
    // Rotate the rig's origin around the head pivot, then rotate its orientation;
    // together this keeps the head fixed while turning the world.
    this.playerRig.position.sub(head).applyAxisAngle(up, angle).add(head);
    this.playerRig.rotateOnWorldAxis(up, angle);
  }

  /** Per-frame teleport aiming: project the controller ray onto the floor. */
  updateTeleport() {
    const t = this.teleport;
    if (!t.active || !t.controller || !this.floorMesh) return;
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
      if (t.marker) t.marker.visible = false;
    }
  }

  /**
   * Handle a controller select. Raycasts the controller ray against the scene
   * and forwards a 'qui-select' event on the first hit object (interactables
   * can listen). Kept minimal until the interactable registry lands.
   */
  onControllerSelect(controller, isStart) {
    if (!isStart || this.interactables.length === 0) return;
    const hit = this.raycasterFromController(controller).intersectObjects(this.interactables, false)[0];
    if (!hit) return;
    const handlers = hit.object.userData.interactable;
    if (handlers && handlers.onSelect) handlers.onSelect({ intersection: hit, controller });
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
    if (!this.interactables.includes(object)) this.interactables.push(object);
    return object;
  }

  /** Remove an interactable from the registry. */
  unregisterInteractable(object) {
    const i = this.interactables.indexOf(object);
    if (i !== -1) this.interactables.splice(i, 1);
  }

  /**
   * Per-frame hover detection for each controller ray against interactables,
   * firing onHover/onHoverEnd as the hovered object changes.
   */
  updateHover() {
    if (this.interactables.length === 0) return;
    for (const controller of this.controllers) {
      const hit = this.raycasterFromController(controller).intersectObjects(this.interactables, false)[0];
      const obj = hit ? hit.object : null;
      const prev = controller.userData.hovered || null;
      if (prev === obj) continue;
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
    if (!this.playerRig) return;
    this.playerRig.position.set(0, 0, 0);
    this.playerRig.quaternion.identity();
    console.log('VRApp: recentered');
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
    console.log(`VRApp: Device tier=${compat.deviceTier}, targetFPS=${this.settings.targetFPS}`);

    // Use progressive loader for efficient initialization
    this.progressiveLoader = new ProgressiveLoader();
    this.progressiveLoader.callbacks.onProgress = (data) => {
      console.log(`VRApp: Loading ${data.item.name} (${data.progress * 100}%)`);
    };

    // === TIER 1 SYSTEMS ===

    // 1. Fixed Foveated Rendering
    if (this.settings.enableFFR) {
      this.ffrSystem = new FFRSystem();
      console.log('VRApp: FFR system ready');
    }

    // 2. Comfort System
    if (this.settings.enableComfort) {
      this.comfortSystem = new ComfortSystem(
        this.scene,
        this.camera,
        this.renderer
      );
      this.comfortSystem.setPreset(this.settings.motionSensitivity);
      console.log('VRApp: Comfort system initialized');
    }

    // 3. Object Pooling
    if (this.settings.enableObjectPooling) {
      this.poolManager = new PoolManager();

      // Register common pools
      this.poolManager.register('vector3', new ObjectPool(THREE.Vector3, 100, 1000));
      this.poolManager.register('quaternion', new ObjectPool(THREE.Quaternion, 50, 500));
      this.poolManager.register('matrix4', new ObjectPool(THREE.Matrix4, 20, 200));

      console.log('VRApp: Object pools initialized');
    }

    // 4. Texture Manager with KTX2 support
    if (this.settings.enableTextureCompression) {
      this.textureManager = new TextureManager(this.renderer);
      await this.textureManager.initializeKTX2();
      console.log('VRApp: Texture manager ready with KTX2 support');
    }

    // === TIER 2 SYSTEMS ===

    // 5. Japanese IME
    this.japaneseIME = new JapaneseIME();
    this.vrKeyboard = new VRJapaneseKeyboard(this.scene, this.japaneseIME);
    console.log('VRApp: Japanese IME ready');

    // 6. Hand Tracking
    this.handTracking = new HandTracking(this.renderer, this.scene);
    console.log('VRApp: Hand tracking ready');

    // 7. Spatial Audio
    this.spatialAudio = new SpatialAudio();
    await this.loadAudioAssets();
    console.log('VRApp: Spatial audio initialized');

    // 8. Mixed Reality
    this.mixedReality = new MixedReality(this.renderer, this.scene);
    const mrSupport = await this.mixedReality.checkSupport();
    console.log('VRApp: Mixed reality support:', mrSupport);

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
      console.log(`VRApp: AI recommendations ready (seeded with ${seedHistory.length} history entries)`);
    }

    // 10. Voice Commands
    if (this.settings.enableVoice) {
      this.voiceCommands = new VoiceCommands();
      await this.voiceCommands.initialize();
      console.log('VRApp: Voice commands ready');
    }

    // 11. Multiplayer — requires a signaling server; connect() is called on
    // demand by the caller, not here.
    if (this.settings.enableMultiplayer) {
      this.multiplayerSystem = new MultiplayerSystem(this.scene, this.spatialAudio);
      // FR-7.2: avatar presence — geometric avatars for remote peers.
      this.avatarSystem = new AvatarSystem(this.scene);
      console.log('VRApp: Multiplayer system ready (call connect() to join a room)');
    }

    // 12. DevTools (development builds only; hidden until toggled with F12).
    // Dynamically imported so it is dropped from production bundles.
    if (import.meta.env && import.meta.env.DEV) {
      const { DevTools } = await import('../dev/DevTools.js');
      this.devTools = new DevTools(this);
      this.devTools.initialize();
      console.log('VRApp: DevTools ready (F12 to toggle)');
    }

    // 13. Performance monitor overlay (opt-in)
    if (this.settings.enablePerfMonitorUI) {
      this.perfMonitorUI = new PerformanceMonitor();
      this.perfMonitorUI.initialize();
      console.log('VRApp: Performance monitor UI ready');
    }

    // 14. WebGPU renderer (experimental, opt-in). Gated behind capability
    // detection; not yet integrated into the THREE render loop, so it is
    // instantiated for availability/probing only.
    if (this.settings.enableWebGPU) {
      if (typeof navigator !== 'undefined' && navigator.gpu) {
        const { WebGPURenderer } = await import('./rendering/WebGPURenderer.js');
        this.webGPURenderer = new WebGPURenderer();
        console.log('VRApp: WebGPU available (experimental; not wired into the render loop yet)');
      } else {
        console.warn('VRApp: WebGPU requested but navigator.gpu is unavailable');
      }
    }

    const loadTime = performance.now() - startTime;
    console.log(`VRApp: All systems initialized in ${loadTime.toFixed(1)}ms`);
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
    console.log('VRApp: VR session started');
    this.isVREnabled = true;

    // Get XR session
    const session = this.renderer.xr.getSession();

    // Initialize FFR for this session
    if (this.ffrSystem && session) {
      const gl = this.renderer.getContext();
      await this.ffrSystem.initialize(session, gl);
      this.ffrSystem.setEnabled(true);
      console.log('VRApp: FFR enabled for session');
    }

    // Update comfort system for VR
    if (this.comfortSystem) {
      this.comfortSystem.enterVR();
    }

    // Initialize hand tracking
    if (this.handTracking && session) {
      await this.handTracking.initialize(session);

      // Register gesture callbacks
      this.handTracking.onGesture('pinch', (hand, gesture) => {
        console.log(`${hand} hand pinch detected`);
        // Play spatial sound at pinch position
        if (this.spatialAudio) {
          const pos = this.handTracking.getPinchPosition(hand);
          if (pos) {
            this.spatialAudio.play('click', 'click', pos);
          }
        }
      });

      this.handTracking.onGesture('point', (hand, gesture) => {
        console.log(`${hand} hand pointing`);
      });
    }

    // Adjust render settings for VR
    this.renderer.setPixelRatio(1); // Don't use device pixel ratio in VR
  }

  /**
   * Handle VR session end
   */
  onVRSessionEnd() {
    console.log('VRApp: VR session ended');
    this.isVREnabled = false;

    // Disable FFR
    if (this.ffrSystem) {
      this.ffrSystem.setEnabled(false);
    }

    // Update comfort system
    if (this.comfortSystem) {
      this.comfortSystem.exitVR();
    }

    // Restore render settings
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  /**
   * Main render loop
   */
  render(timestamp, xrFrame) {
    this.frameCount++;

    // Rich perf monitor — begin-frame timing.
    if (this.perfMonitorUI) this.perfMonitorUI.beginFrame();

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
    if (this.perfMonitorUI) this.perfMonitorUI.endFrame(this.renderer);

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
      const isMoving = this.detectMotion();
      this.comfortSystem.update(isMoving);
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

    // Update spatial audio listener position
    if (this.spatialAudio) {
      this.spatialAudio.updateListenerFromCamera(this.camera);
    }

    // Update mixed reality
    if (this.mixedReality && this.mixedReality.enabled && xrFrame) {
      this.mixedReality.update(xrFrame);
    }

    // Update locomotion input (snap turn), teleport aiming, and hover
    this.updateLocomotion(dt);
    this.updateTeleport();
    this.updateHover();

    // Update scene objects using pools
    this.updateSceneWithPools();
  }

  /**
   * Detect user motion (simplified)
   */
  detectMotion() {
    if (!this.renderer.xr.isPresenting) return false;

    const session = this.renderer.xr.getSession();
    if (!session) return false;

    // In production, check controller velocity
    // For now, return false (stationary)
    return false;
  }

  /**
   * Example: Update scene using object pools
   */
  updateSceneWithPools() {
    if (!this.poolManager) return;

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

    console.log('VRApp: Quality reduced for performance');
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

    console.log('VRApp: Quality increased');
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
   * Navigate to a URL: records the visit in BookmarkStore history and feeds
   * it to the AI recommendation engine.  Call this whenever the in-VR panel
   * loads a new page (FR-1.1 prerequisite infrastructure).
   */
  navigate(url, title = url) {
    this.bookmarks.addHistory(url, title);
    if (this.aiRecommendation) {
      this.aiRecommendation.trackVisit(url, title, 0);
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
    console.log('VRApp: Disposing...');

    // Stop render loop
    this.renderer.setAnimationLoop(null);

    // Remove global listeners and DOM nodes added during setup
    if (this.onEnterVRRequest) {
      window.removeEventListener('enter-vr', this.onEnterVRRequest);
      this.onEnterVRRequest = null;
    }
    if (this.vrButton && this.vrButton.parentNode) {
      this.vrButton.parentNode.removeChild(this.vrButton);
    }

    // Dispose systems
    if (this.comfortSystem) this.comfortSystem.dispose();
    if (this.ffrSystem) this.ffrSystem.dispose();
    if (this.textureManager) this.textureManager.dispose();
    if (this.poolManager) this.poolManager.dispose();
    if (this.handTracking) this.handTracking.dispose();
    if (this.spatialAudio) this.spatialAudio.dispose();
    if (this.mixedReality) this.mixedReality.dispose();
    if (this.progressiveLoader) this.progressiveLoader.dispose();
    if (this.aiRecommendation) this.aiRecommendation.dispose();
    if (this.voiceCommands) this.voiceCommands.stop();
    if (this.multiplayerSystem) this.multiplayerSystem.disconnect();
    if (this.avatarSystem) this.avatarSystem.dispose();
    if (this.tabManager) this.tabManager.dispose();
    else if (this.webPanel) this.webPanel.dispose();
    if (this.devTools) this.devTools.dispose();
    if (this.perfMonitorUI) this.perfMonitorUI.dispose();
    if (this.webGPURenderer && this.webGPURenderer.dispose) this.webGPURenderer.dispose();
    if (this._homePanelTexture) this._homePanelTexture.dispose();
    if (this._panelTextures) this._panelTextures.forEach((t) => t.dispose());

    // Dispose Three.js
    this.renderer.dispose();
    this.scene.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    console.log('VRApp: Disposed');
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
 *   console.log('FPS:', stats.fps, 'Memory:', stats.memory);
 * }, 1000);
 *
 * // Cleanup on page unload
 * window.addEventListener('beforeunload', () => {
 *   app.dispose();
 * });
 */
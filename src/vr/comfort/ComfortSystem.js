/**
 * VR Comfort System
 * Reduces motion sickness through a camera-parented vignette that narrows
 * peripheral optical flow while the user is moving.
 *
 * The vignette is a gradient quad parented to the camera, not a post-process
 * pass: three.js updates the user camera's world matrix from the XR pose every
 * frame (WebXRManager.updateUserCamera), so children of it track the head in
 * both immersive and mirror rendering — where a screen-space render-target
 * pass would break stereo presentation entirely.
 */

import { t } from '../../i18n/i18n.js';

import * as THREE from 'three';

export class ComfortSystem {
  constructor(camera) {
    this.camera = camera;

    // External motion signal (smooth locomotion moves the rig, not the head, so
    // head-delta detection alone would miss it). OR'd into isMoving each frame.
    this.externalMotion = false;
    // Intensity of the external motion, 0..1 (normalized stick deflection).
    // Drives a speed-proportional vignette: restricting the periphery more than
    // the current optical flow warrants is itself a comfort/usability cost, so
    // the vignette target scales with how fast the user is actually gliding
    // (adaptive FOV restriction — Adaptive Field-of-view Restriction, VRST '22;
    // adaptive FFR+FoV, arXiv:2502.03419). Defaults to 1 so callers that only
    // set the boolean keep the pre-existing full-intensity behavior.
    this.externalMotionLevel = 1;

    // Comfort settings
    this.settings = {
      preset: 'moderate',
      vignette: {
        enabled: true,
        intensity: 0.4,      // 0-1 range — caps the vignette opacity
        smoothing: 0.1       // Transition speed
      }
    };

    // Motion detection
    this.lastPosition = new THREE.Vector3();
    this.lastRotation = 0;
    this.isMoving = false;
    this.isRotating = false;
    this.currentVignette = 0;

    // Initialize the vignette quad
    this.setupVignette();
  }

  /**
   * Build the vignette quad: a canvas radial gradient (transparent centre,
   * opaque black rim) on a plane fixed in front of the camera. Depth reads and
   * writes are off so it always composes over the scene.
   */
  setupVignette() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.55, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    this.vignetteTexture = new THREE.CanvasTexture(canvas);
    this.vignetteMaterial = new THREE.MeshBasicMaterial({
      map: this.vignetteTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: 0
    });

    // 2 m × 2 m at 0.6 m ≈ ±118° of coverage — spans past the edges of every
    // supported headset's display FOV.
    this.vignetteMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.vignetteMaterial
    );
    this.vignetteMesh.position.z = -0.6;
    this.vignetteMesh.renderOrder = 999;
    this.vignetteMesh.frustumCulled = false;
    this.vignetteMesh.visible = false;
    this.camera.add(this.vignetteMesh);
  }

  /**
   * Update comfort system each frame
   */
  update(deltaTime) {
    if (!this.camera) {
      return;
    }

    // Detect movement
    this.detectMotion();

    // Update vignette effect
    if (this.settings.vignette.enabled) {
      this.updateVignette(deltaTime);
    }
  }

  /**
   * Detect user motion
   */
  detectMotion() {
    const currentPosition = this.camera.position;
    const currentRotation = this.camera.rotation.y;

    // Calculate movement distance
    const moveDistance = currentPosition.distanceTo(this.lastPosition);
    const rotDistance = Math.abs(currentRotation - this.lastRotation);

    // Head-delta motion kept separate from the external locomotion signal so
    // updateVignette() can scale the external contribution by its level while
    // head/camera motion always counts as full-strength motion.
    this._headMoving = moveDistance > 0.001; // ~1mm threshold
    // Update motion flags (OR in any external locomotion signal)
    this.isMoving = this._headMoving || this.externalMotion;
    this.isRotating = rotDistance > 0.001; // ~0.05 degree threshold

    // Store current values for next frame
    this.lastPosition.copy(currentPosition);
    this.lastRotation = currentRotation;
  }

  /**
   * Update vignette intensity based on motion.
   *
   * The target scales with how much optical flow the user is actually being
   * exposed to, rather than snapping to full strength for any motion at all:
   * over-restricting the periphery during slow drift is itself a
   * comfort/usability cost (adaptive FOV restriction — VRST '22; adaptive
   * FFR+FoV, arXiv:2502.03419). Head-tracked movement and rotation still count
   * as full-strength motion (their real-world speed isn't measurable here);
   * smooth locomotion contributes proportionally to externalMotionLevel
   * (normalized stick deflection set per-frame by VRApp.updateLocomotion()).
   */
  updateVignette(deltaTime = 0.016) {
    const externalLevel = this.externalMotion
      ? Math.max(0, Math.min(1, this.externalMotionLevel))
      : 0;
    const motionLevel = Math.max(
      (this._headMoving || this.isRotating) ? 1 : 0,
      externalLevel
    );
    const targetVignette = this.settings.vignette.intensity * motionLevel;

    // Frame-rate independent exponential chase: `smoothing` is the fraction
    // of the remaining gap closed per 16.67 ms, so the vignette's attack and
    // release rates hold at any display rate (72–120 Hz). A per-frame `*s`
    // chase would converge ~1.7× faster at 120 Hz than at 72 Hz — the
    // timing of a vestibular protection must not depend on the refresh
    // rate. Also exact over any dt: a long frame can't under-chase and
    // never overshoots (a stays in [0,1]).
    const dt = Math.max(0, deltaTime);
    const s = Math.min(1, Math.max(0, this.settings.vignette.smoothing));
    const a = 1 - Math.pow(1 - s, dt / 0.016667);
    this.currentVignette += (targetVignette - this.currentVignette) * a;

    // Apply to the quad; skip its draw call entirely once it has faded out.
    if (this.vignetteMaterial) {
      this.vignetteMaterial.opacity = this.currentVignette;
      this.vignetteMesh.visible = this.currentVignette > 0.01;
    }
  }

  setPreset(preset) {
    // Each preset explicitly sets `enabled`. This is required because settings
    // are merged with Object.assign: switching FROM 'disabled' (which sets
    // enabled:false) TO a protective preset must re-enable the vignette.
    // Omitting `enabled: true` here would leave a user who picked 'disabled'
    // and then switched to 'sensitive' with NO comfort mitigation at all — the
    // exact opposite of their request.
    const presets = {
      'sensitive': {
        vignette: { enabled: true, intensity: 0.8 }
      },
      'moderate': {
        vignette: { enabled: true, intensity: 0.4 }
      },
      'tolerant': {
        vignette: { enabled: true, intensity: 0.2 }
      },
      'disabled': {
        vignette: { enabled: false }
      }
    };

    const presetSettings = presets[preset];
    if (!presetSettings) {
      return;
    }

    // Apply preset settings
    Object.assign(this.settings.vignette, presetSettings.vignette);

    this.settings.preset = preset;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.vignetteMesh) {
      this.camera?.remove(this.vignetteMesh);
      this.vignetteMesh.geometry.dispose();
    }
    if (this.vignetteMaterial) {
      this.vignetteMaterial.dispose();
    }
    if (this.vignetteTexture) {
      this.vignetteTexture.dispose();
    }
  }
}

/** Comfort preset keys, ordered most → least protective. */
export const COMFORT_PRESET_KEYS = ['sensitive', 'moderate', 'tolerant', 'disabled'];

/**
 * Resolve the comfort preset to use at startup.
 *
 * Precedence:
 *   1. An explicit, valid persisted user choice always wins — if the user has
 *      picked a preset we never override it.
 *   2. Otherwise, if the OS signals prefers-reduced-motion, default to the most
 *      protective preset ('sensitive') instead of 'moderate'. The OS already
 *      told us this user is motion-sensitive, so they should not have to find
 *      and crank the in-VR comfort menu themselves.
 *   3. Otherwise fall back to 'moderate'.
 *
 * Pure / dependency-free so the precedence logic is unit-testable.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.reducedMotion=false] - OS prefers-reduced-motion signal
 * @param {string}  [opts.persisted=null]      - persisted motionSensitivity, if any
 * @returns {string} a key from COMFORT_PRESET_KEYS
 */
export function resolveComfortPreset({ reducedMotion = false, persisted = null } = {}) {
  if (persisted && COMFORT_PRESET_KEYS.includes(persisted)) {
    return persisted;
  }
  if (reducedMotion) {
    return 'sensitive';
  }
  return 'moderate';
}

/**
 * Build a directional caption for a snap-turn confirmation.
 *
 * The snap turn itself is instantaneous (applied to the player rig by
 * VRApp.snapTurn); this caption is the second, non-visual channel that tells
 * the user which way the world snapped. Pure so it is unit-testable.
 *
 * @param {number} direction   +1 = clockwise (right), -1 = counter-clockwise (left)
 * @param {number} angleDeg    magnitude of the snap in degrees
 * @returns {string}           e.g. "↺ Left 30°" or "↻ Right 30°"
 */
export function snapTurnLabel(direction, angleDeg) {
  return direction > 0
    ? `↻ ${t('vr.value.right')} ${angleDeg}°`
    : `↺ ${t('vr.value.left')} ${angleDeg}°`;
}

/**
 * Fire cross-modal feedback on a successful teleport landing.
 *
 * Teleport is the recommended comfort locomotion (smooth move is off by default
 * precisely because it triggers motion sickness). Yet until now the landing was
 * completely silent — no haptic, no caption. Both channels are useful to all
 * users (not just reduced-motion): a heavier 'impact' pulse confirms the jump
 * registered, and the caption serves users whose captions are enabled.
 *
 * Unlike snap-turn, the caption is NOT gated on prefers-reduced-motion because
 * teleport is always instant (there is no animation to suppress); the caption
 * is general landing confirmation, not a substitute for a missing animation.
 *
 * Pure / dependency-free so it is unit-testable.
 *
 * @param {object|null} controller  WebXR controller object (userData.inputSource.handedness)
 * @param {object|null} haptic      HapticFeedback instance, or null
 * @param {object|null} captions    CaptionSystem instance, or null
 */
export function fireTeleportFeedback(controller, haptic, captions) {
  if (haptic) {
    const hand = controller?.userData?.inputSource?.handedness || 'right';
    haptic.playPattern(hand, 'impact');
  }
  if (captions && captions.enabled) {
    captions.show(t('vr.msg.teleported'));
  }
}

/**
 * Return a caution message when enabling smooth locomotion while the OS
 * prefers-reduced-motion flag is set, otherwise null.
 *
 * Smooth (continuous) locomotion is the primary VR motion-sickness trigger;
 * the setting is off by default for exactly this reason. When a
 * vestibular-sensitive user (signalled by the OS) opts in anyway, a visible
 * warning gives them the chance to reconsider before experiencing nausea.
 * The warning fires only when the feature is being *enabled* (not disabled)
 * so it never nags users who are turning it off.
 *
 * Pure / dependency-free so it is unit-testable.
 *
 * @param {boolean} enabledNow  - the value the toggle is about to take (true = on)
 * @param {boolean} reduceMotion - OS prefers-reduced-motion signal
 * @returns {string|null} warning message, or null when no warning is needed
 */
export function smoothMoveWarning(enabledNow, reduceMotion) {
  if (enabledNow && reduceMotion) {
    return t('vr.msg.smoothMoveWarning');
  }
  return null;
}

/**
 * Usage Example:
 *
 * const comfort = new ComfortSystem(camera);
 * comfort.setPreset('moderate');
 *
 * // In animation loop
 * comfort.update(deltaTime);
 * // Feed smooth-locomotion state so the vignette engages while gliding:
 * comfort.externalMotion = gliding;
 * comfort.externalMotionLevel = stickDeflection; // 0..1
 */

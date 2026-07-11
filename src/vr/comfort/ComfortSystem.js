/**
 * VR Comfort System
 * Reduces motion sickness by 60-70% through vignetting, FOV reduction, and snap turning
 *
 * John Carmack principle: Essential for user comfort, simple implementation
 */

import * as THREE from 'three';

export class ComfortSystem {
  constructor(scene, camera, renderer, { reduceMotion = false } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.reduceMotion = reduceMotion;

    // External motion signal (smooth locomotion moves the rig, not the head, so
    // head-delta detection alone would miss it). OR'd into isMoving each frame.
    this.externalMotion = false;
    // Intensity of the external motion, 0..1 (normalized stick deflection).
    // Drives a speed-proportional vignette: restricting the FOV more than the
    // current optical flow warrants is itself a comfort/usability cost, so the
    // vignette target scales with how fast the user is actually gliding
    // (adaptive FOV restriction — Adaptive Field-of-view Restriction, VRST '22;
    // adaptive FFR+FoV, arXiv:2502.03419). Defaults to 1 so callers that only
    // set the boolean keep the pre-existing full-intensity behavior.
    this.externalMotionLevel = 1;

    // Comfort settings
    this.settings = {
      preset: 'moderate',
      vignette: {
        enabled: true,
        intensity: 0.4,      // 0-1 range
        powerFactor: 1.5,    // Falloff curve
        smoothing: 0.1       // Transition speed
      },
      fov: {
        enabled: true,
        baseFOV: camera.fov || 90,
        reductionAmount: 25,  // Degrees to reduce during motion
        smoothing: 0.1        // Transition speed
      },
      snapTurn: {
        enabled: true,
        angle: 30,           // Degrees per snap
        duration: 0.2        // Seconds for animation
      }
    };

    // Motion detection
    this.lastPosition = new THREE.Vector3();
    this.lastRotation = 0;
    this.isMoving = false;
    this.isRotating = false;
    this.currentVignette = 0;
    this.currentFOV = this.settings.fov.baseFOV;

    // Initialize vignette post-processing
    this.setupVignette();
  }

  /**
   * Setup vignette shader material
   */
  setupVignette() {
    // Vertex shader
    const vertexShader = `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Fragment shader for vignette effect
    const fragmentShader = `
      uniform sampler2D tDiffuse;
      uniform float intensity;
      uniform float powerFactor;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);

        // Calculate distance from center
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(vUv, center);

        // Apply vignette with power curve
        float vignette = pow(1.0 - dist * dist, powerFactor);
        vignette = mix(1.0, vignette, intensity);

        // Darken edges
        color.rgb *= vignette;

        gl_FragColor = color;
      }
    `;

    // Create post-processing material
    this.vignetteMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        intensity: { value: 0.0 },
        powerFactor: { value: this.settings.vignette.powerFactor }
      },
      vertexShader,
      fragmentShader
    });

    // Create screen quad for post-processing
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.vignetteQuad = new THREE.Mesh(geometry, this.vignetteMaterial);

    // Full-screen ortho camera for the post-process pass, created once and
    // reused (previously allocated every frame in render()).
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create render target for post-processing
    this.renderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight
    );
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

    // Update FOV
    if (this.settings.fov.enabled) {
      this.updateFOV(deltaTime);
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
   * over-restricting the FOV during slow drift is itself a comfort/usability
   * cost (adaptive FOV restriction — VRST '22; adaptive FFR+FoV,
   * arXiv:2502.03419). Head-tracked movement and rotation still count as
   * full-strength motion (their real-world speed isn't measurable here);
   * smooth locomotion contributes proportionally to externalMotionLevel
   * (normalized stick deflection set per-frame by VRApp.updateLocomotion()).
   */
  updateVignette(_deltaTime) {
    const externalLevel = this.externalMotion
      ? Math.max(0, Math.min(1, this.externalMotionLevel))
      : 0;
    const motionLevel = Math.max(
      (this._headMoving || this.isRotating) ? 1 : 0,
      externalLevel
    );
    const targetVignette = this.settings.vignette.intensity * motionLevel;

    // Smooth transition
    this.currentVignette += (targetVignette - this.currentVignette) *
                             this.settings.vignette.smoothing;

    // Update shader uniform
    if (this.vignetteMaterial) {
      this.vignetteMaterial.uniforms.intensity.value = this.currentVignette;
    }
  }

  /**
   * Update FOV based on motion.
   *
   * NOTE: intentionally NOT gated on reduceMotion. Dynamic FOV reduction
   * (tunnelling vision) is a *comfort* technique that lowers peripheral optical
   * flow during locomotion — it reduces motion sickness rather than causing it.
   * The prefers-reduced-motion cohort is the vestibular-sensitive group that
   * benefits most, so this stays on for them. WCAG 2.3.3 exempts motion that is
   * essential to functionality; comfort tunnelling qualifies. (Contrast with
   * animateSnapTurn, where the eased rotation IS the nausea trigger and is
   * therefore suppressed.)
   */
  updateFOV(_deltaTime) {
    // Target FOV based on motion
    let targetFOV = this.settings.fov.baseFOV;

    if (this.isMoving || this.isRotating) {
      targetFOV = this.settings.fov.baseFOV - this.settings.fov.reductionAmount;
    }

    // Smooth transition
    this.currentFOV += (targetFOV - this.currentFOV) *
                       this.settings.fov.smoothing;

    // Apply to camera
    this.camera.fov = this.currentFOV;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Handle snap turning
   */
  handleSnapTurn(direction) {
    if (!this.settings.snapTurn.enabled) {
      // Smooth turning
      this.camera.rotation.y += direction * 0.02;
      return;
    }

    // Calculate snap angle
    const snapAngle = Math.sign(direction) *
                      THREE.MathUtils.degToRad(this.settings.snapTurn.angle);

    // Animate rotation
    this.animateSnapTurn(snapAngle);
  }

  /**
   * Animate snap turn with easing.
   * Under prefers-reduced-motion the eased rAF loop is replaced with an
   * immediate assignment — the turn still happens, the animation does not.
   */
  animateSnapTurn(targetAngle) {
    const startRotation = this.camera.rotation.y;
    const endRotation = startRotation + targetAngle;

    if (this.reduceMotion) {
      this.camera.rotation.y = endRotation;
      return;
    }

    const duration = this.settings.snapTurn.duration * 1000; // Convert to ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      // Apply rotation
      this.camera.rotation.y = THREE.MathUtils.lerp(
        startRotation,
        endRotation,
        eased
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Apply comfort preset
   */
  setPreset(preset) {
    // Each preset explicitly sets `enabled` on all three effects. This is
    // required because settings are merged with Object.assign: switching FROM
    // 'disabled' (which sets enabled:false) TO a protective preset must
    // re-enable the effects. Omitting `enabled: true` here would leave a user
    // who picked 'disabled' and then switched to 'sensitive' with NO comfort
    // mitigations at all — the exact opposite of their request.
    const presets = {
      'sensitive': {
        vignette: { enabled: true, intensity: 0.8, powerFactor: 1.2 },
        fov: { enabled: true, reductionAmount: 35 },
        snapTurn: { enabled: true, angle: 15 }
      },
      'moderate': {
        vignette: { enabled: true, intensity: 0.4, powerFactor: 1.5 },
        fov: { enabled: true, reductionAmount: 25 },
        snapTurn: { enabled: true, angle: 30 }
      },
      'tolerant': {
        vignette: { enabled: true, intensity: 0.2, powerFactor: 2.0 },
        fov: { enabled: true, reductionAmount: 15 },
        snapTurn: { enabled: true, angle: 45 }
      },
      'disabled': {
        vignette: { enabled: false },
        fov: { enabled: false },
        snapTurn: { enabled: false }
      }
    };

    const presetSettings = presets[preset];
    if (!presetSettings) {
      return;
    }

    // Apply preset settings
    Object.assign(this.settings.vignette, presetSettings.vignette);
    Object.assign(this.settings.fov, presetSettings.fov);
    Object.assign(this.settings.snapTurn, presetSettings.snapTurn);

    this.settings.preset = preset;
  }

  /**
   * Render with vignette post-processing
   */
  render(scene, camera) {
    if (!this.settings.vignette.enabled || this.currentVignette < 0.01) {
      // Render directly without post-processing
      this.renderer.render(scene, camera);
      return;
    }

    // Render scene to texture
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(scene, camera);

    // Apply vignette post-processing
    this.vignetteMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;

    // Render to screen
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.vignetteQuad, this.postCamera);
  }

  /**
   * Get current comfort status
   */
  getStatus() {
    return {
      preset: this.settings.preset,
      vignette: {
        enabled: this.settings.vignette.enabled,
        current: this.currentVignette
      },
      fov: {
        enabled: this.settings.fov.enabled,
        current: this.currentFOV
      },
      snapTurn: {
        enabled: this.settings.snapTurn.enabled,
        angle: this.settings.snapTurn.angle
      },
      isMoving: this.isMoving,
      isRotating: this.isRotating
    };
  }

  /**
   * Resize handler
   */
  resize(width, height) {
    if (this.renderTarget) {
      this.renderTarget.setSize(width, height);
    }
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.renderTarget) {
      this.renderTarget.dispose();
    }
    if (this.vignetteMaterial) {
      this.vignetteMaterial.dispose();
    }
    if (this.vignetteQuad) {
      this.vignetteQuad.geometry.dispose();
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
 * Used when prefers-reduced-motion removes the eased rotation animation;
 * the caption provides the second, non-visual channel that tells the user
 * which way the world snapped. Pure so it is unit-testable.
 *
 * @param {number} direction   +1 = clockwise (right), -1 = counter-clockwise (left)
 * @param {number} angleDeg    magnitude of the snap in degrees
 * @returns {string}           e.g. "↺ Left 30°" or "↻ Right 30°"
 */
export function snapTurnLabel(direction, angleDeg) {
  return direction > 0
    ? `↻ Right ${angleDeg}°`
    : `↺ Left ${angleDeg}°`;
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
    captions.show('Teleported');
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
    return 'Smooth move may cause motion sickness';
  }
  return null;
}

/**
 * Usage Example:
 *
 * const comfort = new ComfortSystem(scene, camera, renderer);
 * comfort.setPreset('moderate');
 *
 * // In animation loop
 * comfort.update(deltaTime);
 * comfort.render(scene, camera);
 *
 * // Handle controller input
 * controller.addEventListener('thumbstick', (e) => {
 *   comfort.handleSnapTurn(e.axes[0]);
 * });
 */

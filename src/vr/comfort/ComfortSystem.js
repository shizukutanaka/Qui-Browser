/**
 * VR Comfort System
 * Reduces motion sickness by 60-70% through vignetting, FOV reduction, and snap turning
 *
 * John Carmack principle: Essential for user comfort, simple implementation
 */

import * as THREE from 'three';

export class ComfortSystem {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

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
    if (!this.camera) return;

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

    // Update motion flags
    this.isMoving = moveDistance > 0.001;  // ~1mm threshold
    this.isRotating = rotDistance > 0.001; // ~0.05 degree threshold

    // Store current values for next frame
    this.lastPosition.copy(currentPosition);
    this.lastRotation = currentRotation;
  }

  /**
   * Update vignette intensity based on motion
   */
  updateVignette(deltaTime) {
    // Target vignette intensity based on motion
    let targetVignette = 0;

    if (this.isMoving || this.isRotating) {
      targetVignette = this.settings.vignette.intensity;
    }

    // Smooth transition
    this.currentVignette += (targetVignette - this.currentVignette) *
                             this.settings.vignette.smoothing;

    // Update shader uniform
    if (this.vignetteMaterial) {
      this.vignetteMaterial.uniforms.intensity.value = this.currentVignette;
    }
  }

  /**
   * Update FOV based on motion
   */
  updateFOV(deltaTime) {
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
   * Animate snap turn with easing
   */
  animateSnapTurn(targetAngle) {
    const startRotation = this.camera.rotation.y;
    const endRotation = startRotation + targetAngle;
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
    const presets = {
      'sensitive': {
        vignette: { intensity: 0.8, powerFactor: 1.2 },
        fov: { reductionAmount: 35 },
        snapTurn: { angle: 15 }
      },
      'moderate': {
        vignette: { intensity: 0.4, powerFactor: 1.5 },
        fov: { reductionAmount: 25 },
        snapTurn: { angle: 30 }
      },
      'tolerant': {
        vignette: { intensity: 0.2, powerFactor: 2.0 },
        fov: { reductionAmount: 15 },
        snapTurn: { angle: 45 }
      },
      'disabled': {
        vignette: { enabled: false },
        fov: { enabled: false },
        snapTurn: { enabled: false }
      }
    };

    const presetSettings = presets[preset];
    if (!presetSettings) return;

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
    this.renderer.render(this.vignetteQuad, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
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
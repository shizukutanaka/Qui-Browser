/**
 * Fixed Foveated Rendering (FFR) System
 * Reduces GPU load by 25-40% by lowering resolution at screen edges
 *
 * John Carmack principle: Simple, effective, necessary
 */

export class FFRSystem {
  constructor() {
    this.enabled = false;
    this.intensity = 0.5; // 0-1 range
    this.projectionLayer = null;
    this.glBinding = null;
    // FR-4.2: predicted gaze foveation via head-motion stability.
    // True eye tracking (XREyeTracking) is Quest-Pro-only; as a practical
    // approximation we observe head angular velocity — a still head implies
    // fixation (periphery can be lower-res), a moving head implies scanning
    // (need uniform quality).
    this._prevHeadQuat = null;   // {x,y,z,w} from the previous frame
    this._headVelocity = 0;      // smoothed angular velocity (rad/s)
    this.predictedGazeEnabled = false;
  }

  /**
   * Initialize FFR with WebXR session
   * @param {XRSession} session - Active WebXR session
   * @param {WebGLRenderingContext} gl - WebGL context
   */
  async initialize(session, gl, xrManager = null) {
    if (!session || !gl) {
      console.warn('FFRSystem: Invalid session or GL context');
      return false;
    }

    this._xrManager = xrManager;

    // The session's base layer carries its own fixedFoveation and needs no
    // 'layers' grant — three's WebXRManager.setFoveation writes it. It is both
    // the fallback when XRWebGLBinding is unavailable AND a second write
    // target on runtimes that have layers (quad layers would otherwise render
    // unfoveated content next to a foveated base).
    this._baseFoveation = xrManager
      && typeof xrManager.setFoveation === 'function'
      && session.renderState
      && session.renderState.baseLayer
      && 'fixedFoveation' in session.renderState.baseLayer;

    try {
      // Create XR WebGL binding
      this.glBinding = new XRWebGLBinding(session, gl);

      // Get projection layer for FFR control
      const projectionLayer = this.glBinding.getProjectionLayer();

      if (projectionLayer && typeof projectionLayer.fixedFoveation !== 'undefined') {
        this.projectionLayer = projectionLayer;
        this.enabled = true;
        console.debug('FFRSystem: Initialized successfully');
        return true;
      }
      this.projectionLayer = null;
      console.warn('FFRSystem: No foveatable projection layer');
    } catch (error) {
      console.debug('FFRSystem: XRWebGLBinding unavailable', error);
    }

    if (this._baseFoveation) {
      this.enabled = true;
      console.debug('FFRSystem: Initialized via base-layer fixedFoveation');
      return true;
    }

    console.warn('FFRSystem: Fixed foveation not supported on this device');
    return false;
  }

  /**
   * Write a foveation value to every available target (projection layer +
   * base layer). Base-layer writes are a no-op on runtimes without support.
   */
  _writeFoveation(value) {
    if (this.projectionLayer) {
      this.projectionLayer.fixedFoveation = value;
    }
    if (this._baseFoveation) {
      try {
        this._xrManager.setFoveation(value);
      } catch (e) {
        console.debug('FFRSystem: base-layer foveation write skipped', e);
      }
    }
  }

  /**
   * Enable FFR with specified intensity
   * @param {number} intensity - Foveation level (0-1)
   */
  enable(intensity = 0.5) {
    if (!this.enabled) {
      console.warn('FFRSystem: Not initialized');
      return;
    }

    // Clamp intensity between 0 and 1
    this.intensity = Math.max(0, Math.min(1, intensity));
    this._writeFoveation(this.intensity);

    console.debug(`FFRSystem: Enabled with intensity ${this.intensity}`);
  }

  /**
   * Disable FFR (set to no foveation)
   */
  disable() {
    if (!this.enabled) {
      return;
    }

    this._writeFoveation(0);
    console.debug('FFRSystem: Disabled');
  }

  /**
   * Nudge intensity up or down by delta and clamp to [0, 1].
   * Intended for coarse load-driven adjustments made in the render loop.
   * Works on top of whatever intensity was set by enable() or
   * updatePredictedGazeFoveation().
   */
  adjustIntensity(delta) {
    if (!this.enabled) {
      return;
    }
    this.intensity = Math.max(0, Math.min(1, this.intensity + delta));
    this._writeFoveation(this.intensity);
  }

  /**
   * Record the current head quaternion for velocity estimation.
   * Call once per frame from the VR render loop.
   *
   * @param {{ x:number, y:number, z:number, w:number }} quat - Head quaternion
   * @param {number} dtSeconds - Elapsed seconds since last call
   */
  trackHeadPose(quat, dtSeconds) {
    if (this._prevHeadQuat && dtSeconds > 0) {
      // Angular velocity: 2·acos(|q1·q2|) / dt
      const dot = Math.abs(
        this._prevHeadQuat.x * quat.x +
        this._prevHeadQuat.y * quat.y +
        this._prevHeadQuat.z * quat.z +
        this._prevHeadQuat.w * quat.w
      );
      const angleDelta = 2 * Math.acos(Math.min(1, dot));
      const angularVelocity = angleDelta / dtSeconds;
      // Smooth with an EMA (fast rise, slow decay) to avoid flickering.
      this._headVelocity = this._headVelocity * 0.8 + angularVelocity * 0.2;
      this.predictedGazeEnabled = true;
    }
    // Mutate the stored quaternion in place to avoid a per-frame allocation.
    if (!this._prevHeadQuat) {
      this._prevHeadQuat = { x: 0, y: 0, z: 0, w: 1 };
    }
    this._prevHeadQuat.x = quat.x;
    this._prevHeadQuat.y = quat.y;
    this._prevHeadQuat.z = quat.z;
    this._prevHeadQuat.w = quat.w;
  }

  /**
   * Adjust fixedFoveation based on head-motion stability (FR-4.2 predicted
   * gaze foveation).  Still head → high intensity (safe to reduce peripheral
   * resolution).  Moving head → low intensity (user may be scanning the edge).
   *
   * Intended to be called after trackHeadPose() in the same frame.
   */
  updatePredictedGazeFoveation() {
    if (!this.predictedGazeEnabled || !this.enabled) {
      return;
    }

    const SLOW = 0.05;  // rad/s — below this: fixating
    const FAST = 0.50;  // rad/s — above this: scanning
    const t = Math.max(0, Math.min(1,
      (this._headVelocity - SLOW) / (FAST - SLOW)
    ));

    // Still head (t=0) → intensity 0.8; fast head (t=1) → intensity 0.2.
    const target = 0.8 - 0.6 * t;
    this.intensity += (target - this.intensity) * 0.1;
    this._writeFoveation(Math.max(0, Math.min(1, this.intensity)));
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.disable();
    this.projectionLayer = null;
    this.glBinding = null;
    this._xrManager = null;
    this._baseFoveation = false;
    this.enabled = false;
  }
}

/**
 * Usage Example:
 *
 * const ffrSystem = new FFRSystem();
 *
 * // In XR session start
 * await ffrSystem.initialize(xrSession, gl);
 * ffrSystem.enable(0.5); // Medium foveation
 *
 * // In render loop — nudge on sustained load pressure
 * ffrSystem.adjustIntensity(delta);
 *
 * // Cleanup
 * ffrSystem.dispose();
 */

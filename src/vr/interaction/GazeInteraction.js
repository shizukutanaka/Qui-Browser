/**
 * FR-13.1: Gaze-dwell interaction — a hands-free accessibility path.
 *
 * Casts a ray straight out of the headset (head-gaze) and, when it rests on a
 * registered interactable continuously for `dwellTime` ms, fires that object's
 * onSelect handler — exactly the same handler the controller ray uses.  This
 * lets one-handed or no-controller users operate every UI element (settings
 * toggles, browser chrome, the recenter panel) by simply looking at them.
 *
 * A reticle attached to the camera gives feedback: a faint dot normally, and a
 * fill disc that grows from 0→1 as the dwell timer charges.  Looking away
 * cancels and resets the timer (no accidental activations).
 *
 * Opt-in via VRApp.settings.enableGazeDwell (default off) so the controller
 * experience is unchanged for users who don't need it.
 */

import * as THREE from 'three';

const RETICLE_DISTANCE = 2.0; // metres in front of the camera
const RING_OPACITY = 0.35;    // resting opacity of the outline ring
const CONFIRM_MS = 250;       // duration of the activation-confirmation flash

export class GazeInteraction {
  /**
   * @param {THREE.Camera} camera
   * @param {object} [opts]
   * @param {number} [opts.dwellTime=1500] — ms of continuous gaze to trigger
   * @param {number} [opts.graceTime=300]  — ms an off-target slip is forgiven
   *   before the accumulated dwell is discarded. Tolerates tremor / nystagmus
   *   so an unsteady gaze can still complete a selection.
   */
  constructor(camera, { dwellTime = 1500, graceTime = 300 } = {}) {
    this.camera = camera;
    this.dwellTime = dwellTime;
    this.graceTime = graceTime;
    this.enabled = false;

    // Dwell state
    this._target   = null; // interactable currently gazed at
    this._elapsed  = 0;     // ms accumulated on the current target
    this._fired    = false; // guard so onSelect fires once per dwell
    this._confirmMs = 0;    // remaining ms of the activation-confirmation flash
    this._graceMs   = 0;    // ms spent slipped off the held target (grace window)

    this._raycaster = new THREE.Raycaster();
    this._buildReticle();
  }

  // ── Reticle ─────────────────────────────────────────────────────────────────

  _buildReticle() {
    this.reticle = new THREE.Group();
    this.reticle.name = 'gazeReticle';
    this.reticle.position.set(0, 0, -RETICLE_DISTANCE);

    // Outline ring — marks the gaze point.
    const ringGeo = new THREE.RingGeometry(0.018, 0.024, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: RING_OPACITY, depthTest: false
    });
    this._ring = new THREE.Mesh(ringGeo, ringMat);
    this._ring.renderOrder = 999;
    this.reticle.add(this._ring);

    // Progress fill — scales 0→1 while dwelling.
    const fillGeo = new THREE.CircleGeometry(0.016, 24);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x44ff88, transparent: true, opacity: 0.9, depthTest: false
    });
    this._fill = new THREE.Mesh(fillGeo, fillMat);
    this._fill.renderOrder = 1000;
    this._fill.scale.setScalar(0.001);
    this.reticle.add(this._fill);

    this.reticle.visible = false;
    // Parent to the camera so it tracks head movement.
    this.camera.add(this.reticle);
  }

  // ── Control ──────────────────────────────────────────────────────────────────

  setEnabled(value) {
    this.enabled = !!value;
    this.reticle.visible = this.enabled;
    if (!this.enabled) {
      this._reset();
    }
    return this.enabled;
  }

  _reset() {
    this._target  = null;
    this._elapsed = 0;
    this._fired   = false;
    this._confirmMs = 0;
    this._graceMs   = 0;
    if (this._fill) {
      this._fill.scale.setScalar(0.001);
    }
    if (this._ring) {
      this._ring.material.opacity = RING_OPACITY;
    }
  }

  /**
   * Decay the activation-confirmation flash. The outline ring pulses to full
   * opacity on activation and fades back to its resting level, giving gaze
   * users the "it fired" cue that controller/pinch users get from haptics —
   * and one that works even with no controller in hand.
   */
  _tickConfirm(dtMs) {
    if (this._confirmMs <= 0) {
      return;
    }
    this._confirmMs = Math.max(0, this._confirmMs - dtMs);
    if (this._ring) {
      const r = this._confirmMs / CONFIRM_MS; // 1 → 0
      this._ring.material.opacity = RING_OPACITY + (1 - RING_OPACITY) * r;
    }
  }

  // ── Per-frame update ─────────────────────────────────────────────────────────

  /**
   * Advance the dwell timer for this frame.
   *
   * @param {THREE.Object3D[]} interactables — same registry the controllers use
   * @param {number} dtMs — frame delta in milliseconds
   * @returns {THREE.Object3D|null} the object activated this frame, else null
   */
  update(interactables, dtMs) {
    if (!this.enabled || !interactables || interactables.length === 0) {
      if (this._target) {
        this._reset();
      }
      return null;
    }

    this._tickConfirm(dtMs);

    const hit = this._raycastGaze(interactables);
    const obj = hit ? hit.object : null;

    if (obj === this._target) {
      // Still resting on the same target (or both null): no slip in progress.
      this._graceMs = 0;
    } else if (obj) {
      // Gaze landed on a DIFFERENT interactable — an intentional move. Restart.
      this._onTargetChange(this._target, obj);
      this._target  = obj;
      this._elapsed = 0;
      this._fired   = false;
      this._graceMs = 0;
    } else if (this._target && !this._fired && this._graceMs + dtMs < this.graceTime) {
      // Gaze slipped off onto nothing while charging. Forgive brief slips
      // (tremor / nystagmus): hold the accumulated dwell — without charging —
      // for graceTime ms so a return to the same target resumes rather than
      // restarts. The hover highlight is kept (no onHoverEnd) during the slip.
      this._graceMs += dtMs;
      this._updateFill(Math.min(this._elapsed / this.dwellTime, 1));
      return null;
    } else {
      // Grace exhausted (or no target to hold) — release.
      this._onTargetChange(this._target, null);
      this._target  = null;
      this._elapsed = 0;
      this._fired   = false;
      this._graceMs = 0;
    }

    if (!this._target) {
      this._updateFill(0);
      return null;
    }

    // Charge the dwell timer.
    this._elapsed += dtMs;
    const progress = Math.min(this._elapsed / this.dwellTime, 1);
    this._updateFill(progress);

    if (progress >= 1 && !this._fired) {
      this._fired = true;
      // Kick off the confirmation flash (full-opacity ring, decays via _tickConfirm).
      this._confirmMs = CONFIRM_MS;
      if (this._ring) {
        this._ring.material.opacity = 1;
      }
      const handlers = this._target.userData && this._target.userData.interactable;
      if (handlers && handlers.onSelect) {
        handlers.onSelect({ intersection: hit, gaze: true });
      }
      return this._target;
    }
    return null;
  }

  /** Fire hover enter/leave so the gaze path matches controller hover feedback. */
  _onTargetChange(prev, next) {
    if (prev && prev.userData && prev.userData.interactable &&
        prev.userData.interactable.onHoverEnd) {
      prev.userData.interactable.onHoverEnd();
    }
    if (next && next.userData && next.userData.interactable &&
        next.userData.interactable.onHover) {
      next.userData.interactable.onHover();
    }
  }

  /** Build a world-space gaze ray from the camera and intersect interactables. */
  _raycastGaze(interactables) {
    const origin = new THREE.Vector3();
    const dir    = new THREE.Vector3(0, 0, -1);
    this.camera.getWorldPosition(origin);
    this.camera.getWorldQuaternion(this._tmpQuat || (this._tmpQuat = new THREE.Quaternion()));
    dir.applyQuaternion(this._tmpQuat).normalize();
    this._raycaster.set(origin, dir);
    return this._raycaster.intersectObjects(interactables, false)[0] || null;
  }

  _updateFill(progress) {
    if (!this._fill) {
      return;
    }
    // Avoid a zero scale (degenerate matrix); clamp to a tiny minimum.
    this._fill.scale.setScalar(Math.max(progress, 0.001));
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  dispose() {
    if (this.reticle) {
      if (this.camera && this.camera.remove) {
        this.camera.remove(this.reticle);
      }
      this.reticle.traverse(obj => {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          obj.material.dispose();
        }
      });
    }
    this._reset();
    this.reticle = null;
  }
}

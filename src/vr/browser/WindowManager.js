/**
 * Spatial window management for in-VR browser panels.
 *
 * Brings Qui Browser to parity with Wolvic / Meta Quest Browser window
 * handling, which research shows are the headline ergonomics features users
 * expect from a VR browser:
 *
 *   - Head-lock / "follow view": the panel smoothly tracks the user's gaze so
 *     it stays centred in the field of view (ideal for video and narrow-FOV
 *     headsets). Wolvic calls this "head lock".
 *   - Billboard: the panel always faces the user without repositioning.
 *   - Distance adjust: pull the window closer or push it farther away.
 *   - Grab-to-move: while a controller "holds" the move bar, the panel rides
 *     with the controller (Wolvic's move bar / Quest's grab-reposition).
 *
 * The class operates on any THREE.Object3D (typically a WebPanel's group) and a
 * camera. The per-frame transform maths are deterministic and unit-tested
 * without a GPU.
 */

import * as THREE from 'three';

export class WindowManager {
  /**
   * @param {THREE.Camera} camera
   * @param {object} [opts]
   * @param {number} [opts.distance=2.0]     — follow / placement distance (m)
   * @param {number} [opts.minDistance=0.6]
   * @param {number} [opts.maxDistance=6.0]
   * @param {number} [opts.followLerp=0.15]  — 0–1 smoothing per frame at 60fps
   */
  constructor(camera, { distance = 2.0, minDistance = 0.6, maxDistance = 6.0,
    followLerp = 0.15 } = {}) {
    this.camera = camera;
    this.distance = distance;
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
    this.followLerp = followLerp;

    this.target = null;        // managed Object3D (panel group)
    this.followMode = false;   // head-lock
    this.billboard = false;    // face user without following position
    this._grab = null;         // { controller, distance } while grabbing

    // Scratch objects (avoid per-frame allocation).
    this._camPos   = new THREE.Vector3();
    this._camQuat  = new THREE.Quaternion();
    this._forward  = new THREE.Vector3();
    this._targetPos = new THREE.Vector3();
    this._grabPos  = new THREE.Vector3();
    this._grabQuat = new THREE.Quaternion();
    this._grabFwd  = new THREE.Vector3();
  }

  // ── Attach / detach ──────────────────────────────────────────────────────────

  /** Manage the given object (a panel group). */
  attach(object3D) {
    this.target = object3D; return this;
  }
  detach() {
    this.target = null; this._grab = null;
  }

  // ── Mode control ─────────────────────────────────────────────────────────────

  setFollow(value) {
    this.followMode = !!value;
    return this.followMode;
  }
  setBillboard(value) {
    this.billboard = !!value;
    return this.billboard;
  }

  setDistance(d) {
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, d));
    return this.distance;
  }
  nudgeDistance(delta) {
    return this.setDistance(this.distance + delta);
  }

  // ── Grab-to-move ─────────────────────────────────────────────────────────────

  /**
   * Begin dragging the panel with a controller. The panel keeps its current
   * distance from the controller and rides along until endGrab().
   * @param {THREE.Object3D} controller
   */
  beginGrab(controller) {
    if (!this.target || !controller) {
      return;
    }
    const cPos = new THREE.Vector3();
    controller.getWorldPosition(cPos);
    const tPos = new THREE.Vector3();
    this.target.getWorldPosition(tPos);
    this._grab = { controller, distance: cPos.distanceTo(tPos) };
  }

  endGrab() {
    this._grab = null;
  }

  get isGrabbing() {
    return !!this._grab;
  }

  // ── Per-frame update ─────────────────────────────────────────────────────────

  /**
   * Update the managed panel's transform for this frame.
   * Precedence: grab > follow. Billboard orientation is applied in follow and
   * grab modes (and standalone when billboard is on but follow is off).
   *
   * @param {number} [dtMs=16] — frame delta (ms); scales the follow lerp
   */
  update(dtMs = 16) {
    if (!this.target) {
      return;
    }

    this.camera.getWorldPosition(this._camPos);
    this.camera.getWorldQuaternion(this._camQuat);
    // Camera forward = -Z of its orientation.
    this._forward.set(0, 0, -1).applyQuaternion(this._camQuat).normalize();

    if (this._grab) {
      this._updateGrab();
      return;
    }

    if (this.followMode) {
      this._targetPos.copy(this._camPos).addScaledVector(this._forward, this.distance);
      // Frame-rate-independent smoothing.
      const t = Math.min(1, this.followLerp * (dtMs / 16.6667));
      this.target.position.lerp(this._targetPos, t);
      this._faceUser();
    } else if (this.billboard) {
      this._faceUser();
    }
  }

  _updateGrab() {
    this._grab.controller.getWorldPosition(this._grabPos);
    this._grab.controller.getWorldQuaternion(this._grabQuat);
    this._grabFwd.set(0, 0, -1).applyQuaternion(this._grabQuat).normalize();
    this.target.position.copy(this._grabPos).addScaledVector(this._grabFwd, this._grab.distance);
    this._faceUser();
  }

  /** Orient the panel so its +Z face points at the user. */
  _faceUser() {
    // Setting the panel's orientation to the camera's makes its +Z normal point
    // back toward the viewer (see WindowManager docs/tests).
    this.target.quaternion.copy(this._camQuat);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  dispose() {
    this.target = null;
    this._grab = null;
  }
}
